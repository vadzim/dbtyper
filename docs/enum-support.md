# Enum types (PostgreSQL)

A PostgreSQL enum is typed as the union of its labels, and the labels are checked at compile time. This page describes what the parser does with `CREATE TYPE … AS ENUM`. SQLite has no enum types.

## Declaring

```sql
create type mood as enum ('sad', 'ok');
alter type mood add value 'happy';
create type app.status as enum ('draft', 'published'); -- schema-qualified
drop type mood;
```

- `ADD VALUE` changes the union of labels, also in columns created before. `RENAME VALUE`, and `ADD VALUE IF NOT EXISTS | BEFORE | AFTER`, are not parsed yet (a compile error).
- An empty enum, a non-string label and a missing `AS ENUM` are compile errors.
- An enum belongs to a schema, as a table does; `schema.type` names it from another schema.
- An enum column may be an array (`mood[]`); its row type is a `readonly` array of the label union.

## Result types

A column of enum type `mood` is typed `"sad" | "ok" | "happy"` in a result row, with `| null` when the column is nullable. A cast gives the same: `select 'ok'::mood as m` is `{ m: "sad" | "ok" | "happy" }`.

## What is checked

The enum is a comparison class of its own (EXPR-26 in the spec). A string literal is accepted where PostgreSQL accepts an untyped literal for the enum, and it must be one of the labels.

| SQL                                                                              | Result                                                                 |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `where v = 'ok'`, `v in ('sad', 'happy')`, `v between 'sad' and 'ok'`, `<>`      | accepted                                                               |
| `case v when 'ok' then …`, `coalesce(v, 'ok'::mood)`, `order by v`, `group by v` | accepted                                                               |
| `insert … values ('ok')`, `update … set v = 'ok'`                                | accepted                                                               |
| `where v = 'bad'`, `v in ('ok', 'nope')`, `insert … values ('bad')`              | error 2511 "'bad' is not a value of enum mood"                         |
| `where v = 1`, `where v = true`, `where v = text_column`                         | error 2500 "Incompatible types in comparison"                          |
| `where v = other_enum_column`, an insert of a label of another enum              | error 2500 / 2507 (a value of another enum)                            |
| `insert … values (null)` or `set v = null` for a NOT NULL column                 | error 2700                                                             |
| `where v = $1`                                                                   | the parameter is typed as the label union (`"sad" \| "ok" \| "happy"`) |

A column of a type dbtyper has no TypeScript type for (an extension type such as `vector`) can be created, and a query that returns it is error 3506 with the hint to select it `::text`.

## Not checked

- The runtime value: the type is what the PostgreSQL type says, dbtyper never changes what the client returns.

## Tests

- `test/dialects/pgt-12-15-22-arrays-enums-domains.test-d.ts`: result types, labels, errors, parameters.
- `test/integration/ddl/` (`create-type-*`, `enum-lifecycle-*`): declaring, altering and dropping.
- `test/integration/insert/`, `update/`, `select/`, `expressions/` (`*enum*`): enums in statements and expressions.
