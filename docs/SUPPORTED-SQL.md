# Supported SQL

This page lists the SQL that the dbtyper type-level parser reads and checks. It is the same for migrations (`apply`) and for queries (`query`, `stream`); what a statement does to the schema is noted per statement. Everything is parsed in the dialect of the driver of the chain (PostgreSQL or SQLite).

SQL that is not listed is either skipped (see "Statements that are skipped") or a compile error with a code from [ERROR_CODES.md](./ERROR_CODES.md). The untyped methods `queryUntyped` and `streamUntyped` never parse the SQL, and are the way to run what the parser does not support yet.

## Statements

| Statement                                                                                                                                                          | What the parser does                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `CREATE TABLE`, `CREATE VIEW`, `CREATE SCHEMA`, `CREATE TYPE`, `CREATE DOMAIN`, `ALTER TABLE`, `ALTER TYPE`, `DROP TABLE`, `DROP VIEW`, `DROP SCHEMA`, `DROP TYPE` | Parsed and checked; they change the schema of the chain (a statement passed to `query` is checked but changes nothing).           |
| `CREATE OR REPLACE VIEW`, `CREATE MATERIALIZED VIEW`, `DROP MATERIALIZED VIEW`                                                                                     | PostgreSQL: parsed like a view. SQLite: error 1900.                                                                               |
| `SELECT`, `WITH … SELECT`                                                                                                                                          | Parsed and checked; the result is the row type.                                                                                   |
| `INSERT`, `UPDATE`, `DELETE`, also after `WITH …`                                                                                                                  | Parsed and checked; the result is `[]`, or the rows of `RETURNING`.                                                               |
| `CREATE INDEX` (PostgreSQL), `GRANT`, `REVOKE`, `TRUNCATE`, `SET`, `BEGIN`, `COMMIT`, `COPY`, `PRAGMA` and the like                                                | Skipped up to the next `;` (brackets must balance); no check, no schema change. A `query` of such a statement is typed `unknown`. |
| Any other first word (`selec`, `udpate`)                                                                                                                           | Compile error 1930 (1931 with a "did you mean" hint). `ATTACH`, `DETACH` and `CREATE VIRTUAL TABLE` in SQLite are error 1916.     |

A script may hold several statements. They are applied in order, each sees the schema changes of the ones before it, and the first wrong statement is the error. A statement ends with `;` or at the end of the text. A script may have at most 2500 statements (error 1919).

Keywords are case-insensitive. Unquoted identifiers are folded to lower case, quoted ones keep their spelling. `--` and nested `/* */` comments are whitespace. PostgreSQL also reads `$$…$$` and `$tag$…$tag$` strings; SQLite reads `[bracket]` and backtick identifiers.

## Dialects

- The driver declares the dialect (`"postgres"` or `"sqlite"`), and every migration, query and stream of the chain is parsed in it.
- Syntax of the other engine is a compile error: 1900 (PostgreSQL-only syntax in a SQLite chain, such as `::`, `$n`, `DROP TABLE … CASCADE`), 1901 (SQLite-only syntax in a PostgreSQL chain, such as `INSERT OR …`, `REPLACE INTO`, backtick identifiers). The list is the data table in `src/core/dialect.ts`.
- A PostgreSQL chain starts with the schema `public`: the first migration may be `create table …`. `create schema public;` is error 3200, `create schema if not exists public;` does nothing. A `defaultSchema` other than `public` must be created.
- A SQLite chain starts with the schemas `main` (the default) and `temp`. `CREATE SCHEMA` is an error there.
- SQLite: `CREATE [UNIQUE] INDEX name ON table …` keeps only the index name on its table (an unknown table is error 2200; the columns and `WHERE` are not checked); `DROP INDEX` removes it, `DROP TABLE` drops it with the table. A table in FROM, JOIN, UPDATE and DELETE may be followed by `INDEXED BY name` (the index must be one of that table's, else error 2221) or `NOT INDEXED`; neither changes a type. In PostgreSQL both are error 1901.
- Column types come from the driver's type map: `PostgresTypeMap` and `SqliteTypeMap` (see the README). A type spelling that is not in the map is error 3506.

## CREATE TABLE, CREATE VIEW

- `CREATE [TEMP] TABLE [IF NOT EXISTS] [schema.]name (column definitions, table constraints)`; columns keep their declaration order. Column constraints in any order: `NULL`, `NOT NULL`, `DEFAULT`, `PRIMARY KEY`, `UNIQUE`, `CHECK`, `REFERENCES`, `COLLATE`, generated columns. Table constraints: `PRIMARY KEY`, `UNIQUE`, `FOREIGN KEY`, `CHECK`, with or without `CONSTRAINT name`.
- A `DEFAULT` must fit the column type; a `REFERENCES` target must exist; a column name may appear once; a generated column cannot be written by INSERT or UPDATE.
- `CREATE TABLE … AS SELECT …` makes a table of the output columns of the query, all nullable.
- With `IF NOT EXISTS`, an existing table is kept as it is.
- `CREATE VIEW [schema.]name [(column names)] AS SELECT …` (or `AS WITH … SELECT …`): the query is checked and its output columns become the view's columns.
- PostgreSQL: enums (`CREATE TYPE … AS ENUM`, a column of it is the union of its labels), domains, arrays (`int[]`, `text[]`), `ALTER TYPE … ADD VALUE`. SQLite: `STRICT` and `WITHOUT ROWID` tables, `INTEGER PRIMARY KEY` as the rowid, type affinity names, a single-quoted column name (`'order' INTEGER`), a bare name as DEFAULT (`DEFAULT standard` is the text `'standard'`).

## ALTER TABLE, DROP

- `ALTER TABLE [schema.]name action[, action …]` applies, in order: `ADD [COLUMN]`, `DROP [COLUMN]`, `RENAME [COLUMN] a TO b`, `RENAME TO`, `ALTER COLUMN … TYPE`, `SET`/`DROP NOT NULL`, `SET`/`DROP DEFAULT`, `ADD CONSTRAINT`. A missing table or column, a view, or an unsupported action is a compile error. In SQLite the actions are those SQLite has; of `ALTER [COLUMN] c …` only `SET NOT NULL` and `DROP NOT NULL` (they need SQLite 3.53 or later at run time).
- `DROP TABLE`, `DROP VIEW`, `DROP SCHEMA`, `DROP TYPE` with `IF EXISTS` (and `CASCADE` / `RESTRICT` on PostgreSQL). `DROP TABLE` of a view is an error.
- `CREATE SCHEMA [IF NOT EXISTS] name`, `DROP SCHEMA [IF EXISTS] name`: PostgreSQL only.

## SELECT

- Select list: `*`, `t.*`, `schema.t.*`, columns (bare, `alias.col`, `table.col`, `schema.table.col`), expressions, function calls, with or without `AS`. A bare `*` must be the only item, and only over one table (error 3401 over joins). Two output columns with the same name are error 3410.
- `DISTINCT`, and in PostgreSQL `DISTINCT ON`.
- `FROM` is optional (`select 1 as one`). Items: `[schema.]table [AS] alias`, a view, a CTE, a derived table `(select …) [AS] alias` (the alias is required). PostgreSQL also has `unnest(…)` and `generate_series(…)`; SQLite has `json_each(json [, path])` and `json_tree(json [, path])` with the columns `key`, `value`, `type`, `atom`, `id`, `parent`, `fullkey`, `path` (the arguments may use the items before them: `from t, json_each(t.tags) j`; a call with no argument or more than two is error 1937, and outside FROM it is an unknown function, 3619).
- Joins: `[INNER] JOIN`, `LEFT`/`RIGHT`/`FULL [OUTER] JOIN` and `CROSS JOIN`; `ON` takes any boolean condition, `USING (columns)` and `NATURAL JOIN` work too. Columns on the optional side of an outer join are nullable.
- `WITH name AS (select …), …` (a CTE may be used in FROM and JOIN), `WITH RECURSIVE`; a CTE may not refer to an earlier CTE of the same list yet. A CTE body may be `VALUES (…), (…)`: its columns are `column1`, `column2`, … (or the CTE's column list), each of the common type of its cells (3409 for incompatible cells, 3417 for rows of different lengths).
- `WITH …` may also precede `INSERT`, `UPDATE` and `DELETE` (SQLite also `REPLACE`): the CTEs are FROM items of the `INSERT … SELECT`, of `UPDATE … FROM` and of the subqueries of SET, WHERE and RETURNING; the target is always a table, never a CTE of that name.
- `UNION [ALL]`, `INTERSECT`, `EXCEPT`: the names come from the first SELECT, the column types are merged, and the column counts must agree.
- `WHERE`, `GROUP BY` (columns, expressions, output positions), `HAVING`, `ORDER BY` (columns, expressions, positions, output aliases; `ASC`/`DESC`), `LIMIT`, `OFFSET`, `FETCH FIRST n ROWS ONLY`. A column in the list that is outside an aggregate and is not a `GROUP BY` key is error 3403.
- Subqueries in expressions: scalar `(select …)`, `IN (select …)`, `EXISTS (select …)`, `x = ANY (…)`. They see the columns of the outer `FROM` in `WHERE`, not in the select list and not in derived tables.
- Window functions: `function(…) OVER (PARTITION BY … ORDER BY …)`.
- Not supported yet (a compile error; use `queryUntyped`): a comma-separated `FROM` list (except a `,` before SQLite's `json_each`/`json_tree`, a `CROSS JOIN`), the hidden `json`/`root` columns of `json_each`/`json_tree` and `jsonb_each`/`jsonb_tree`, `LATERAL`, `NULLS FIRST/LAST`, `FOR UPDATE` and other locking clauses, `COLLATE` in an expression, an output alias without `AS`, typing `VALUES (…)` and `TABLE t` as queries.

## INSERT, UPDATE, DELETE

- `INSERT INTO [schema.]table [(columns)] VALUES (…), (…)` and `INSERT INTO … SELECT …` (both with `ON CONFLICT` and `RETURNING`). Every value is checked against its column; `NULL` for a NOT NULL column is an error; a NOT NULL column without a default that is missing from the column list is error 3300.
- `ON CONFLICT [(columns)] DO NOTHING` and `DO UPDATE SET … [WHERE …]`, where `excluded.column` is in scope. SQLite also has `INSERT OR …` and `REPLACE INTO`.
- `UPDATE table SET column = value, … [FROM other] [WHERE …]`, `DELETE FROM table [USING other] [WHERE …]`; the `WHERE` follows the rules of a SELECT `WHERE`.
- `RETURNING *`, `t.*`, columns or expressions with `AS`: the result is the typed rows. Without `RETURNING` the result is `[]`.

## Expressions

- Literals (string, number, boolean, `NULL`), columns, parameters (`:name`, `$n` in PostgreSQL, `?`, `?NNN`, `:name`, `@name` in SQLite), parentheses.
- Operators: `+ - * / % ^`, unary `-`, `||`, comparisons, `AND`, `OR`, `NOT`, `IS [NOT] NULL`, `IS [NOT] DISTINCT FROM`, `[NOT] IN (list)`, `[NOT] BETWEEN`, `[NOT] LIKE`, `ILIKE`, array operators `@> <@ &&`. Operands must be compatible: the comparison classes are numeric, text, boolean, uuid, date and time, json, array, and enum for PostgreSQL. In SQLite a NUMERIC-affinity value (`NUMERIC`, `STRING`, `NUMBER`, any unknown type name) is compatible with text and numbers, as operand and in INSERT, UPDATE and DEFAULT. A mismatch is error 2500 and its relatives.
- `NULL` is tested with `IS NULL` only: `= null`, `<> null`, and `NULL` in arithmetic or `BETWEEN` are errors.
- `CASE WHEN … THEN … ELSE … END` and `CASE x WHEN …`; without `ELSE` the result is nullable.
- `CAST(x AS type)`, and `x::type` in PostgreSQL.
- A condition (`WHERE`, `HAVING`, `ON`, `CASE WHEN`) must be boolean.
- A result is nullable when any operand is nullable, except for null-aware forms (`IS NULL`, `EXISTS`, `COALESCE`).

## Functions

A function must be in the function catalog of the dialect (PostgreSQL or SQLite); an unknown one is error 3619, a schema-qualified one 3617. The catalog covers aggregates (`count`, `sum`, `avg`, `min`, `max` and more), `coalesce`, text, numeric, date and time, JSON and array functions, window functions (`row_number`, `rank`, `lag`, `lead`, …) and `now()`. Arity and argument types are checked, and the result type is per dialect. Users cannot declare their own functions yet.

## Statements that are skipped

Skipped statements are not checked, change nothing in the schema, and are typed `unknown` by `query`. Most are harmless (`GRANT`, `SET`, `BEGIN`, PostgreSQL's `CREATE INDEX`, `COMMENT`). Some of them change the schema in the real database, and later queries then fail against the old schema: PostgreSQL `CREATE TEMP TABLE`, `ALTER SCHEMA … RENAME`, `ALTER VIEW …`. Keep such changes out of the typed chain.

Very long statements are a limit of the TypeScript compiler, not of dbtyper: an expression with about thirty chained `+`, more than about 200 positional parameters, or a very long migration chain can end in TypeScript's own "excessively deep" error (TS2589) instead of a dbtyper error. Split the statement or the migration.
