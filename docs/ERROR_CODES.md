# Error code reference

<!-- Generated from src/dbtyper-error.ts by scripts/gen-error-codes.ts (npm run gen-error-codes). Do not edit by hand. -->

dbtyper has **306 active error codes** and 68 retired ones. A compile error is the TypeScript type `DbtyperError<Code, Message>`; the code is the number in `__sql_parser_error_code__`, the text is in `__sql_parser_error__`. A `…` in a message marks a place where dbtyper inserts a name or a value (a table, a column, a type).

A code is never reused. A removed error stays in the registry as `OBSOLETE_<code>_<name>` (see the end of this page), because codes are used in online help.

## Ranges

| Range     | Category                      | Active codes |
| --------- | ----------------------------- | -----------: |
| 1000-1099 | Lexer/Tokenization            |           10 |
| 1100-1199 | Parser/SELECT Statement       |           22 |
| 1200-1299 | Parser/INSERT Statement       |           18 |
| 1300-1399 | Parser/UPDATE Statement       |            4 |
| 1400-1499 | Parser/DELETE Statement       |            2 |
| 1500-1599 | Parser/CREATE TABLE           |           16 |
| 1600-1699 | Parser/ALTER TABLE            |            5 |
| 1700-1799 | Parser/DROP TABLE             |            4 |
| 1800-1899 | Parser/CREATE/ALTER/DROP TYPE |           11 |
| 1900-1999 | Other-dialect syntax          |           15 |
| 2100-2199 | Validation/Statement          |           10 |
| 2200-2299 | Resolution/Table-Schema       |            4 |
| 2300-2399 | Resolution/Column             |            4 |
| 2400-2499 | Resolution/Other              |            5 |
| 2500-2599 | Type/Compatibility            |           11 |
| 2600-2699 | Type/Boolean                  |            7 |
| 2700-2799 | Type/NULL Handling            |            5 |
| 2800-2899 | Type/Text Operations          |            7 |
| 2900-2999 | Type/Numeric Operations       |            1 |
| 3000-3099 | Type/Array Operations         |            2 |
| 3100-3199 | Type/Subquery                 |            4 |
| 3200-3299 | Semantic/Duplicate-Existence  |           12 |
| 3300-3399 | Semantic/Constraint           |            6 |
| 3400-3499 | Semantic/SELECT               |           14 |
| 3500-3599 | Semantic/Statement            |           10 |
| 3600-3699 | Semantic/Function             |           20 |
| 3700-3799 | DDL/CREATE SCHEMA             |            3 |
| 3800-3899 | DDL/DROP SCHEMA               |            2 |
| 3900-3999 | DDL/CREATE VIEW               |            8 |
| 4000-4099 | DDL/ALTER TYPE                |            3 |
| 4100-4199 | DDL/Misc                      |            6 |
| 4200-4299 | DML/JOIN                      |            2 |
| 4300-4399 | DML/CASE                      |            2 |
| 4400-4499 | DML/BETWEEN-IN                |            3 |
| 4500-4599 | DML/CAST                      |            5 |
| 4600-4699 | DML/Window Function           |            4 |
| 4700-4799 | DML/Array                     |            3 |
| 4800-4899 | DML/Operator                  |            5 |
| 4900-4999 | DML/EXISTS                    |            2 |
| 5000-5099 | DML/Misc Expression           |           10 |
| 5100-5199 | Type-Data/VARCHAR-NUMERIC     |            6 |
| 5300-5399 | Type-Data/FETCH-LIMIT         |            4 |
| 5400-5499 | Type-Data/Misc                |            9 |

## 1000-1099: Lexer/Tokenization

| Code | Name                         | Message                                                                                                                            |
| ---- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1001 | `UNCLOSED_QUOTED_IDENTIFIER` | Unclosed quoted identifier literal                                                                                                 |
| 1002 | `UNCLOSED_STRING_LITERAL`    | Unclosed string literal                                                                                                            |
| 1003 | `UNCLOSED_TAGGED_STRING`     | Unclosed tagged string                                                                                                             |
| 1004 | `WRONG_STRING_TAG`           | Wrong string tag                                                                                                                   |
| 1005 | `UNBALANCED_PARENTHESES`     | Unbalanced parentheses                                                                                                             |
| 1006 | `TOKEN_NOT_FOUND`            | Statement is not closed: an expected closing token was not found (for example a trigger with BEGIN but no END, or a missing \`)\`) |
| 1007 | `UNEXPECTED_TOKEN`           | Unexpected token at: …                                                                                                             |
| 1008 | `CLOSING_BRACKET_NOT_FOUND`  | Closing bracket not found: …                                                                                                       |
| 1009 | `UNMATCHED_CLOSING_BRACKET`  | Unmatched closing bracket: …                                                                                                       |
| 1010 | `INVALID_INDEXED_PARAM`      | Invalid indexed parameter: …                                                                                                       |

## 1100-1199: Parser/SELECT Statement

| Code | Name                                              | Message                                         |
| ---- | ------------------------------------------------- | ----------------------------------------------- |
| 1100 | `EXPECTED_SELECT_AFTER_WITH`                      | Expected SELECT after WITH clause               |
| 1101 | `EXPECTED_SELECT_IN_SUBQUERY`                     | Expected SELECT in subquery                     |
| 1102 | `EXPECTED_SELECT_IN_DERIVED_TABLE`                | Expected SELECT in derived table                |
| 1103 | `EXPECTED_SELECT_IN_EXISTS_SUBQUERY`              | Expected SELECT in EXISTS subquery              |
| 1104 | `EXPECTED_SELECT_OR_WITH_AFTER_AS_IN_CREATE_VIEW` | Expected SELECT or WITH after AS in CREATE VIEW |
| 1105 | `EXPECTED_SEMICOLON`                              | Expected semicolon after …                      |
| 1106 | `EXPECTED_FROM_AFTER_SELECT_LIST`                 | Expected FROM after SELECT list                 |
| 1107 | `EXPECTED_BY_AFTER_GROUP`                         | Expected BY after GROUP                         |
| 1108 | `EXPECTED_BY_AFTER_ORDER`                         | Expected BY after ORDER                         |
| 1109 | `EXPECTED_BY_AFTER_ORDER_IN_OVER_CLAUSE`          | Expected BY after ORDER in OVER clause          |
| 1110 | `EXPECTED_BY_AFTER_PARTITION`                     | Expected BY after PARTITION                     |
| 1111 | `EXPECTED_CTE_NAME_IN_WITH`                       | Expected CTE name in WITH                       |
| 1112 | `EXPECTED_ALIAS_AFTER_CTE`                        | Expected alias after CTE                        |
| 1113 | `EXPECTED_ALIAS_AFTER_DERIVED_TABLE`              | Expected alias after derived table              |
| 1114 | `EXPECTED_ALIAS_NAME_AFTER_AS`                    | Expected alias name after AS                    |
| 1115 | `EXPECTED_ALIAS_OR_JOIN_CLAUSE_AFTER_TABLE`       | Expected alias or join clause after table       |
| 1116 | `EXPECTED_OPEN_PAREN_AFTER_AS_IN_WITH`            | Expected open paren after AS in WITH            |
| 1117 | `EXPECTED_END_AFTER_CASE`                         | Expected END after CASE                         |
| 1118 | `EXPECTED_WHEN_AFTER_CASE_EXPRESSION`             | Expected WHEN after CASE expression             |
| 1119 | `EXPECTED_WHEN_ELSE_OR_END_IN_CASE`               | Expected WHEN ELSE or END in CASE               |
| 1120 | `EXPECTED_TABLE_NAME`                             | Expected table name …                           |
| 1121 | `EXPECTED_TABLE_NAME_OR_OPEN_PAREN_IN_FROM`       | Expected table name or \`(\` in FROM            |

## 1200-1299: Parser/INSERT Statement

| Code | Name                                                         | Message                                                   |
| ---- | ------------------------------------------------------------ | --------------------------------------------------------- |
| 1200 | `EXPECTED_INTO_AFTER_INSERT`                                 | Expected INTO after INSERT                                |
| 1202 | `EXPECTED_OPEN_PAREN_AFTER_VALUES_IN_INSERT`                 | Expected \`(\` after VALUES in INSERT                     |
| 1203 | `EXPECTED_CLOSE_PAREN_AFTER_INSERT_VALUES`                   | Expected \`)\` after INSERT values                        |
| 1204 | `EXPECTED_OPEN_PAREN_AFTER_COMMA_BETWEEN_INSERT_VALUES_ROWS` | Expected \`(\` after \`,\` between INSERT VALUES rows     |
| 1205 | `EXPECTED_OPEN_PAREN_COLUMN_LIST_AFTER_TABLE_IN_INSERT`      | Expected \`(\` (column list) after table in INSERT        |
| 1206 | `EXPECTED_COLUMN_NAME`                                       | Expected column name …                                    |
| 1207 | `EXPECTED_COMMA_OR_CLOSE_PAREN_IN_INSERT_COLUMN_LIST`        | Expected \`,\` or \`)\` in INSERT column list             |
| 1208 | `EXPECTED_COMMA_BETWEEN_INSERT_VALUES`                       | Expected \`,\` between INSERT values                      |
| 1209 | `EXPECTED_VALUES_OR_SELECT_AFTER_COLUMN_LIST_IN_INSERT`      | Expected VALUES or SELECT after column list in INSERT     |
| 1210 | `EXPECTED_CONFLICT_AFTER_ON_IN_INSERT`                       | Expected CONFLICT after ON in INSERT                      |
| 1211 | `EXPECTED_OPEN_PAREN_AFTER_ON_CONFLICT_IN_INSERT`            | Expected \`(\` after ON CONFLICT in INSERT                |
| 1213 | `EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ON_CONFLICT_COLUMN_LIST`   | Expected \`,\` or \`)\` in ON CONFLICT column list        |
| 1214 | `EXPECTED_DO_AFTER_ON_CONFLICT_COLUMN_LIST_IN_INSERT`        | Expected DO after ON CONFLICT column list in INSERT       |
| 1215 | `EXPECTED_DO_AFTER_ON_CONFLICT_COLUMNS_IN_INSERT`            | Expected DO after ON CONFLICT columns in INSERT           |
| 1216 | `EXPECTED_UPDATE_AFTER_DO_IN_INSERT_ON_CONFLICT`             | Expected UPDATE or NOTHING after DO in INSERT ON CONFLICT |
| 1217 | `EXPECTED_SET_AFTER_UPDATE_IN_INSERT_ON_CONFLICT`            | Expected SET after UPDATE in INSERT ON CONFLICT           |
| 1219 | `EXPECTED_EQUALS_AFTER_COLUMN_IN_ON_CONFLICT_UPDATE`         | Expected \`=\` after column in ON CONFLICT UPDATE         |
| 1226 | `EXPECTED_VALUES_AFTER_DEFAULT_IN_INSERT`                    | Expected VALUES after DEFAULT in INSERT                   |

## 1300-1399: Parser/UPDATE Statement

| Code | Name                                                       | Message                                                     |
| ---- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| 1300 | `EXPECTED_SET_IN_UPDATE`                                   | Expected SET in UPDATE                                      |
| 1301 | `EXPECTED_SET_AFTER_TABLE_IN_UPDATE`                       | Expected SET after table in UPDATE                          |
| 1304 | `EXPECTED_EQUALS_AFTER_COLUMN_IN_UPDATE_SET`               | Expected \`=\` after column in UPDATE SET                   |
| 1305 | `EXPECTED_COMMA_FROM_WHERE_OR_END_AFTER_UPDATE_ASSIGNMENT` | Expected \`,\`, FROM, WHERE, or end after UPDATE assignment |

## 1400-1499: Parser/DELETE Statement

| Code | Name                                            | Message                                       |
| ---- | ----------------------------------------------- | --------------------------------------------- |
| 1400 | `EXPECTED_FROM_AFTER_DELETE`                    | Expected FROM after DELETE                    |
| 1405 | `EXPECTED_ALIAS_OR_END_OF_TABLE_IN_DELETE_FROM` | Expected alias or end of table in DELETE FROM |

## 1500-1599: Parser/CREATE TABLE

| Code | Name                                                     | Message                                                         |
| ---- | -------------------------------------------------------- | --------------------------------------------------------------- |
| 1501 | `EXPECTED_OPEN_PAREN_BEFORE_COLUMN_LIST_IN_CREATE_TABLE` | Expected \`(\` before column list in CREATE TABLE               |
| 1502 | `EXPECTED_CLOSE_PAREN_BEFORE_END_OF_CREATE_TABLE`        | Expected \`)\` before end of CREATE TABLE                       |
| 1504 | `EXPECTED_COLUMN_TYPE_IN_CREATE_TABLE`                   | Expected column type in CREATE TABLE                            |
| 1505 | `EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION`  | Expected \`,\` or \`)\` after column definition                 |
| 1507 | `EXPECTED_NOT_AFTER_IF_IN_CREATE_TABLE`                  | Expected \`not\` after \`IF\` in CREATE TABLE                   |
| 1508 | `EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_TABLE`           | Expected \`exists\` after \`IF NOT\` in CREATE TABLE            |
| 1509 | `EXPECTED_DEFAULT_VALUE`                                 | Expected DEFAULT value                                          |
| 1510 | `EXPECTED_NULL_AFTER_NOT`                                | Expected NULL after NOT                                         |
| 1511 | `EXPECTED_SELECT_OR_WITH_AFTER_AS_IN_CREATE_TABLE`       | Expected SELECT or WITH after AS in CREATE TABLE                |
| 1512 | `EXPECTED_KEY_AFTER_PRIMARY_OR_FOREIGN_IN_CREATE_TABLE`  | Expected KEY after PRIMARY or FOREIGN in CREATE TABLE           |
| 1513 | `EXPECTED_OPEN_PAREN_IN_CREATE_TABLE_CONSTRAINT`         | Expected \`(\` in CREATE TABLE constraint                       |
| 1514 | `EXPECTED_CONSTRAINT_AFTER_NAME_IN_CREATE_TABLE`         | Expected a constraint after the constraint name in CREATE TABLE |
| 1515 | `EXPECTED_CONSTRAINT_NAME_IN_CREATE_TABLE`               | Expected constraint name after CONSTRAINT in CREATE TABLE       |
| 1516 | `EXPECTED_REFERENCES_AFTER_FOREIGN_KEY`                  | Expected REFERENCES after FOREIGN KEY (columns) in CREATE TABLE |
| 1517 | `EXPECTED_ALWAYS_AFTER_GENERATED`                        | Expected ALWAYS after GENERATED in CREATE TABLE                 |
| 1518 | `EXPECTED_AS_AFTER_GENERATED_ALWAYS`                     | Expected AS after GENERATED ALWAYS in CREATE TABLE              |

## 1600-1699: Parser/ALTER TABLE

| Code | Name                                           | Message                                         |
| ---- | ---------------------------------------------- | ----------------------------------------------- |
| 1601 | `EXPECTED_TABLE_AFTER_ALTER`                   | Expected TABLE after ALTER                      |
| 1607 | `EXPECTED_COLUMN_TYPE_IN_ALTER_TABLE`          | Expected column type in ALTER TABLE             |
| 1608 | `EXPECTED_TYPE_SET_OR_DROP_AFTER_ALTER_COLUMN` | Expected TYPE, SET, or DROP after ALTER COLUMN  |
| 1609 | `EXPECTED_NULL_AFTER_SET_NOT`                  | Expected NULL after SET NOT                     |
| 1610 | `EXPECTED_EXISTS_AFTER_IF_IN_ALTER_TABLE`      | Expected \`exists\` after \`IF\` in ALTER TABLE |

## 1700-1799: Parser/DROP TABLE

| Code | Name                                              | Message                                           |
| ---- | ------------------------------------------------- | ------------------------------------------------- |
| 1702 | `EXPECTED_EXISTS_AFTER_IF_IN_DROP_TABLE`          | Expected \`exists\` after \`IF\` in DROP TABLE    |
| 1703 | `EXPECTED_DOT_OR_END_OF_TABLE_NAME_IN_DROP_TABLE` | Expected \`.\` or end of table name in DROP TABLE |
| 1705 | `EXPECTED_EXISTS_AFTER_IF_IN_DROP_VIEW`           | Expected \`exists\` after \`IF\` in DROP VIEW     |
| 1706 | `EXPECTED_VIEW_NAME_IN_DROP_VIEW`                 | Expected view name in DROP VIEW                   |

## 1800-1899: Parser/CREATE/ALTER/DROP TYPE

| Code | Name                                                            | Message                                                 |
| ---- | --------------------------------------------------------------- | ------------------------------------------------------- |
| 1803 | `EXPECTED_AS_AFTER_TYPE_NAME_IN_CREATE_TYPE`                    | Expected \`as\` after type name in CREATE TYPE          |
| 1804 | `EXPECTED_ENUM_AFTER_AS_IN_CREATE_TYPE`                         | Expected \`enum\` after \`AS\` in CREATE TYPE           |
| 1805 | `EXPECTED_OPEN_PAREN_BEFORE_ENUM_VALUES_IN_CREATE_TYPE`         | Expected \`(\` before enum values in CREATE TYPE        |
| 1806 | `EXPECTED_STRING_LITERAL_FOR_ENUM_VALUE_IN_CREATE_TYPE`         | Expected string literal for enum value in CREATE TYPE   |
| 1807 | `EXPECTED_STRING_LITERAL_FOR_ENUM_VALUE_IN_ALTER_TYPE`          | Expected string literal for enum value in ALTER TYPE    |
| 1808 | `EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_ENUM_VALUE_IN_CREATE_TYPE` | Expected \`,\` or \`)\` after enum value in CREATE TYPE |
| 1813 | `EXPECTED_ADD_IN_ALTER_TYPE`                                    | Expected \`add\` in ALTER TYPE                          |
| 1814 | `EXPECTED_VALUE_AFTER_ADD_IN_ALTER_TYPE`                        | Expected \`value\` after \`ADD\` in ALTER TYPE          |
| 1815 | `EXPECTED_NOT_AFTER_IF_IN_CREATE_TYPE`                          | Expected \`not\` after \`IF\` in CREATE TYPE            |
| 1816 | `EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_TYPE`                   | Expected \`exists\` after \`IF NOT\` in CREATE TYPE     |
| 1817 | `EXPECTED_EXISTS_AFTER_IF_IN_DROP_TYPE`                         | Expected \`exists\` after \`IF\` in DROP TYPE           |

## 1900-1999: Other-dialect syntax

| Code | Name                                      | Message                                                                                                                      |
| ---- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1900 | `POSTGRES_ONLY_SYNTAX`                    | … is PostgreSQL-only; this database is ……                                                                                    |
| 1901 | `SQLITE_ONLY_SYNTAX`                      | … is SQLite-only; this database is ……                                                                                        |
| 1910 | `STRICT_TABLE_TYPE_NOT_ALLOWED`           | STRICT tables allow only INT, INTEGER, REAL, TEXT, BLOB, ANY                                                                 |
| 1911 | `AUTOINCREMENT_NEEDS_INTEGER_PRIMARY_KEY` | AUTOINCREMENT is allowed only on a column declared INTEGER PRIMARY KEY                                                       |
| 1912 | `EXPECTED_TABLE_OPTION_IN_CREATE_TABLE`   | Expected STRICT or WITHOUT ROWID                                                                                             |
| 1913 | `WITHOUT_ROWID_NEEDS_PRIMARY_KEY`         | WITHOUT ROWID tables need a PRIMARY KEY                                                                                      |
| 1914 | `SQLITE_ADD_COLUMN_RESTRICTED`            | SQLite cannot ADD COLUMN with …                                                                                              |
| 1915 | `SQLITE_NO_SCHEMAS`                       | SQLite has no schemas; drop the schema qualifier, or use main or temp                                                        |
| 1916 | `SQLITE_UNSUPPORTED_STATEMENT`            | … is not supported in migrations                                                                                             |
| 1917 | `REGEXP_NEEDS_FUNCTION`                   | REGEXP needs a user function regexp(pattern, text); register one or use LIKE or GLOB                                         |
| 1918 | `EXPECTED_CONFLICT_ACTION_AFTER_OR`       | Expected ABORT, FAIL, IGNORE, REPLACE or ROLLBACK after OR                                                                   |
| 1919 | `TOO_MANY_STATEMENTS`                     | A script may have at most … statements; split it into several migrations                                                     |
| 1920 | `UNKNOWN_CONFLICT_ACTION`                 | Expected ROLLBACK, ABORT, FAIL, IGNORE or REPLACE after ON CONFLICT                                                          |
| 1930 | `UNKNOWN_STATEMENT`                       | Unknown statement keyword …. If this is SQL dbtyper does not know, run it with queryUntyped or streamUntyped                 |
| 1931 | `UNKNOWN_STATEMENT_DID_YOU_MEAN`          | Unknown statement keyword …; did you mean …? If this is SQL dbtyper does not know, run it with queryUntyped or streamUntyped |

## 2100-2199: Validation/Statement

| Code | Name                                | Message                                                                                         |
| ---- | ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| 2107 | `INVALID_ALTER_TABLE_NAME`          | Invalid ALTER TABLE name (internal parser error; please report this SQL as a dbtyper issue)     |
| 2108 | `INVALID_CREATE_TABLE_NAME_PARSE`   | Invalid CREATE TABLE name (internal parser error; please report this SQL as a dbtyper issue)    |
| 2109 | `INVALID_DROP_TABLE_PARSE`          | Invalid DROP TABLE statement (internal parser error; please report this SQL as a dbtyper issue) |
| 2110 | `INVALID_CREATE_TYPE_NAME_PARSE`    | Invalid CREATE TYPE name (internal parser error; please report this SQL as a dbtyper issue)     |
| 2111 | `INVALID_ALTER_TYPE_PARSE`          | Invalid ALTER TYPE statement (internal parser error; please report this SQL as a dbtyper issue) |
| 2112 | `INVALID_DROP_TYPE_PARSE`           | Invalid DROP TYPE statement (internal parser error; please report this SQL as a dbtyper issue)  |
| 2116 | `INVALID_NUMBER`                    | Invalid number                                                                                  |
| 2117 | `INVALID_NUMBER_FOR_VARCHAR_LENGTH` | Invalid number for VARCHAR length                                                               |
| 2118 | `INVALID_PRECISION_NUMBER`          | Invalid precision number                                                                        |
| 2119 | `INVALID_SCALE_NUMBER`              | Invalid scale number                                                                            |

## 2200-2299: Resolution/Table-Schema

| Code | Name                      | Message                         |
| ---- | ------------------------- | ------------------------------- |
| 2200 | `UNKNOWN_TABLE`           | Unknown table … in …            |
| 2207 | `UNKNOWN_SCHEMA_OR_TABLE` | Unknown schema or table … in …  |
| 2214 | `UNKNOWN_SCHEMA`          | Unknown schema … for …          |
| 2220 | `UNKNOWN_CONSTRAINT`      | Unknown constraint … on table … |

## 2300-2399: Resolution/Column

| Code | Name                                 | Message                        |
| ---- | ------------------------------------ | ------------------------------ |
| 2300 | `UNKNOWN_COLUMN`                     | Unknown column … in …          |
| 2306 | `UNKNOWN_COLUMN_SCHEMA_TABLE_COLUMN` | Unknown column ….….…           |
| 2307 | `UNKNOWN_QUALIFIED_COLUMN`           | Unknown qualified column ….…   |
| 2308 | `UNKNOWN_ALIAS_IN_SELECT_STAR`       | Unknown alias in SELECT ... \* |

## 2400-2499: Resolution/Other

| Code | Name                                  | Message                                                                     |
| ---- | ------------------------------------- | --------------------------------------------------------------------------- |
| 2400 | `UNKNOWN_QUERY_PARAMETER`             | Unknown query parameter: …                                                  |
| 2403 | `POSITIONAL_PARAMETER_REQUIRES_ARRAY` | Positional parameter (?) requires array of parameters, not named parameters |
| 2404 | `POSITIONAL_PARAMETER_OUT_OF_BOUNDS`  | Positional parameter index … is out of bounds                               |
| 2405 | `CANNOT_INFER_PARAMETER_TYPE`         | cannot infer the type of parameter …; use CAST(… AS …)                      |
| 2406 | `PARAMETER_PROBE_READ`                | internal: a parameter was read                                              |

## 2500-2599: Type/Compatibility

| Code | Name                                     | Message                                    |
| ---- | ---------------------------------------- | ------------------------------------------ |
| 2500 | `INCOMPATIBLE_TYPES_IN_COMPARISON`       | Incompatible types in comparison           |
| 2501 | `INCOMPATIBLE_TYPES_IN_ARITHMETIC`       | Incompatible types in arithmetic           |
| 2502 | `INCOMPATIBLE_TYPES_IN_CASE`             | Incompatible types in CASE                 |
| 2503 | `INCOMPATIBLE_TYPES_IN_BETWEEN`          | Incompatible types in BETWEEN              |
| 2504 | `INCOMPATIBLE_TYPES_IN_IN_LIST`          | Incompatible types in IN list              |
| 2505 | `INCOMPATIBLE_TYPES_IN_IN_SUBQUERY`      | Incompatible types in IN subquery          |
| 2507 | `INCOMPATIBLE_VALUE_TYPE_FOR_COLUMN`     | Incompatible value type for column …       |
| 2508 | `INSERT_SELECT_TYPE_MISMATCH_FOR_COLUMN` | INSERT...SELECT type mismatch for column … |
| 2509 | `INCOMPATIBLE_PARAMETER_VALUE_TYPE`      | Incompatible value type for parameter …    |
| 2510 | `COLUMN_TYPE_MISMATCH`                   | column \`…\` is …                          |
| 2511 | `VALUE_NOT_IN_ENUM`                      | '…' is not a value of enum …               |

## 2600-2699: Type/Boolean

| Code | Name                                    | Message                                           |
| ---- | --------------------------------------- | ------------------------------------------------- |
| 2600 | `EXPRESSION_MUST_BE_BOOLEAN`            | Expression must be boolean, but has a type ….     |
| 2601 | `CASE_WHEN_MUST_BE_BOOLEAN`             | CASE WHEN must be boolean                         |
| 2602 | `NOT_REQUIRES_BOOLEAN_OPERAND`          | NOT requires a boolean operand                    |
| 2603 | `NOT_ARGUMENT_MUST_BE_BOOLEAN_NOT_NULL` | NOT argument must be boolean, not NULL            |
| 2604 | `AND_OPERANDS_MUST_BE_BOOLEAN`          | AND operands must be boolean                      |
| 2605 | `OR_OPERANDS_MUST_BE_BOOLEAN`           | OR operands must be boolean                       |
| 2606 | `NULL_NOT_VALID_BOOLEAN_OPERAND`        | NULL is not a valid boolean operand (use IS NULL) |

## 2700-2799: Type/NULL Handling

| Code | Name                                 | Message                                |
| ---- | ------------------------------------ | -------------------------------------- |
| 2700 | `NULL_NOT_ALLOWED_NOT_NULL_COLUMN`   | NULL not allowed for NOT NULL column … |
| 2701 | `NULL_NOT_ALLOWED_ARITHMETIC`        | NULL not allowed in arithmetic         |
| 2702 | `NULL_NOT_ALLOWED_IN_BETWEEN`        | NULL not allowed in BETWEEN            |
| 2703 | `NULL_NOT_ALLOWED_IN_LIKE`           | NULL not allowed in LIKE               |
| 2704 | `USE_IS_NULL_INSTEAD_OF_EQUALS_NULL` | Use IS NULL instead of = null          |

## 2800-2899: Type/Text Operations

| Code | Name                                        | Message                                 |
| ---- | ------------------------------------------- | --------------------------------------- |
| 2800 | `CONCAT_REQUIRES_AT_LEAST_ONE_TEXT_OPERAND` | \|\| requires at least one text operand |
| 2801 | `CANNOT_CONCATENATE_ARRAY_WITH_TEXT`        | Cannot concatenate array with text      |
| 2802 | `CANNOT_CONCATENATE_TEXT_WITH_ARRAY`        | Cannot concatenate text with array      |
| 2803 | `LIKE_LEFT_OPERAND_MUST_BE_TEXT`            | LIKE left operand must be text          |
| 2804 | `CANNOT_CONCATENATE_TEXT_WITH_TYPE`         | Cannot concatenate text with …          |
| 2805 | `CANNOT_CONCATENATE_TYPE_WITH_TEXT`         | Cannot concatenate … with text          |
| 2806 | `LIKE_PATTERN_MUST_BE_TEXT`                 | LIKE pattern must be text               |

## 2900-2999: Type/Numeric Operations

| Code | Name                            | Message                       |
| ---- | ------------------------------- | ----------------------------- |
| 2900 | `UNARY_MINUS_REQUIRES_A_NUMBER` | Unary minus requires a number |

## 3000-3099: Type/Array Operations

| Code | Name                                      | Message                                    |
| ---- | ----------------------------------------- | ------------------------------------------ |
| 3000 | `CANNOT_DETERMINE_TYPE_OF_EMPTY_ARRAY`    | Cannot determine type of empty array       |
| 3001 | `ANY_ALL_SOME_REQUIRES_ARRAY_OR_SUBQUERY` | ANY/ALL/SOME requires an array or subquery |

## 3100-3199: Type/Subquery

| Code | Name                                              | Message                                                                                                                    |
| ---- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 3100 | `SCALAR_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN` | Scalar subquery must project exactly one column                                                                            |
| 3101 | `IN_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN`     | IN subquery must project exactly one column                                                                                |
| 3102 | `SCALAR_SUBQUERY_COLUMN_INFERENCE_FAILED`         | Cannot infer the column of this scalar subquery; select exactly one column, or cast the result (internal inference failed) |
| 3103 | `IN_SUBQUERY_COLUMN_INFERENCE_FAILED`             | Cannot infer the column of this IN subquery; select exactly one column, or cast the result (internal inference failed)     |

## 3200-3299: Semantic/Duplicate-Existence

| Code | Name                                                  | Message                                              |
| ---- | ----------------------------------------------------- | ---------------------------------------------------- |
| 3200 | `SCHEMA_ALREADY_EXISTS_USE_IF_NOT_EXISTS`             | Schema already exists; use IF NOT EXISTS             |
| 3201 | `SCHEMA_DOES_NOT_EXIST_USE_IF_EXISTS`                 | Schema does not exist; use IF EXISTS                 |
| 3202 | `TABLE_ALREADY_EXISTS_USE_IF_NOT_EXISTS`              | Table already exists; use IF NOT EXISTS              |
| 3203 | `TABLE_DOES_NOT_EXIST`                                | Table does not exist                                 |
| 3204 | `TABLE_DOES_NOT_EXIST_USE_IF_EXISTS`                  | Table does not exist; use IF EXISTS                  |
| 3205 | `TYPE_ALREADY_EXISTS_USE_IF_NOT_EXISTS`               | Type already exists; use IF NOT EXISTS               |
| 3206 | `TYPE_DOES_NOT_EXIST_USE_IF_EXISTS`                   | Type does not exist; use IF EXISTS                   |
| 3207 | `TYPE_DOES_NOT_EXIST_OR_IS_NOT_AN_ENUM_USE_IF_EXISTS` | Type does not exist or is not an enum; use IF EXISTS |
| 3208 | `COLUMN_ALREADY_EXISTS`                               | Column … already exists                              |
| 3209 | `COLUMN_DOES_NOT_EXIST`                               | Column … does not exist                              |
| 3210 | `DUPLICATE_WITH_CLAUSE_NAME`                          | Duplicate WITH clause name                           |
| 3211 | `VIEW_OR_TABLE_ALREADY_EXISTS_IN_SCHEMA`              | View or table already exists in schema               |

## 3300-3399: Semantic/Constraint

| Code | Name                                        | Message                                   |
| ---- | ------------------------------------------- | ----------------------------------------- |
| 3300 | `MISSING_NOT_NULL_COLUMN_IN_INSERT`         | Missing NOT NULL column … in INSERT       |
| 3301 | `INSERT_COLUMN_LIST_MUST_NOT_BE_EMPTY`      | INSERT column list must not be empty      |
| 3302 | `ON_CONFLICT_COLUMN_LIST_MUST_NOT_BE_EMPTY` | ON CONFLICT column list must not be empty |
| 3303 | `IN_LIST_MUST_NOT_BE_EMPTY`                 | IN list must not be empty                 |
| 3304 | `EMPTY_ENUM_VALUES_LIST_IN_CREATE_TYPE`     | Empty enum values list in CREATE TYPE     |
| 3305 | `ENUM_VALUE_ALREADY_EXISTS`                 | Enum value already exists                 |

## 3400-3499: Semantic/SELECT

| Code | Name                                                                          | Message                                                                     |
| ---- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 3400 | `SELECT_STAR_MUST_BE_THE_ONLY_PROJECTION_IN_THE_LIST`                         | SELECT \* must be the only projection in the list                           |
| 3401 | `SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE`                                    | SELECT \* requires a single FROM table                                      |
| 3402 | `SCALAR_EXPRESSION_IN_SELECT_REQUIRES_AS_ALIAS`                               | Scalar expression in SELECT requires AS alias                               |
| 3403 | `GROUPED_SELECT_REQUIRES_COLUMN_TO_APPEAR_IN_GROUP_BY_OR_INSIDE_AN_AGGREGATE` | Grouped SELECT requires column to appear in GROUP BY or inside an aggregate |
| 3404 | `AMBIGUOUS_UNQUALIFIED_COLUMN`                                                | Ambiguous unqualified column …                                              |
| 3405 | `QUALIFIED_TABLE_STAR_IS_ONLY_VALID_IN_SELECT_LISTS`                          | Qualified table .\* is only valid in SELECT lists                           |
| 3406 | `SELECT_RESULT_COLUMN_INDEX_OUT_OF_BOUNDS`                                    | SELECT result column index out of bounds                                    |
| 3407 | `SELECT_RESULT_MISSING_COLUMN`                                                | SELECT result missing column                                                |
| 3408 | `SET_OPERATION_COLUMN_COUNT_MISMATCH`                                         | Each … query must have the same number of columns                           |
| 3409 | `SET_OPERATION_INCOMPATIBLE_TYPES`                                            | Incompatible types in … for column …                                        |
| 3410 | `DUPLICATE_OUTPUT_COLUMN`                                                     | Duplicate output column …; use AS to give one of them an alias              |
| 3411 | `JOIN_USING_COLUMN_NOT_FOUND`                                                 | Column … specified in USING clause does not exist in both join sides        |
| 3412 | `EXPECTED_SELECT_AFTER_SET_OPERATOR`                                          | Expected SELECT after UNION, INTERSECT or EXCEPT                            |
| 3413 | `CTE_COLUMN_LIST_MISMATCH`                                                    | WITH query … has a different number of columns than its column list         |

## 3500-3599: Semantic/Statement

| Code | Name                                        | Message                                                                                         |
| ---- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 3500 | `INSERT_SELECT_COLUMN_COUNT_MISMATCH`       | INSERT...SELECT column count mismatch                                                           |
| 3501 | `STREAM_REQUIRES_A_ROW_RETURNING_STATEMENT` | stream() requires a row-returning statement (SELECT or RETURNING clause)                        |
| 3502 | `DROP_TABLE_TARGETS_A_VIEW_USE_DROP_VIEW`   | DROP TABLE targets a view; use DROP VIEW                                                        |
| 3503 | `ALTER_TABLE_APPLIES_ONLY_TO_BASE_TABLES`   | ALTER TABLE applies only to base tables                                                         |
| 3504 | `TABLE_KEY_MISMATCH_IN_ALTER_TABLE`         | ALTER TABLE target not found (internal parser error; please report this SQL as a dbtyper issue) |
| 3505 | `COLUMN_RENAME_FAILED`                      | Cannot rename the column: check that the old name exists and the new name is not taken          |
| 3506 | `NO_TYPESCRIPT_TYPE_FOR_SQL_TYPE`           | No TypeScript type for SQL type … in the driver's type map; select it with a cast, e.g. …       |
| 3510 | `DROP_VIEW_TARGETS_A_TABLE_USE_DROP_TABLE`  | DROP VIEW targets a table; use DROP TABLE                                                       |
| 3511 | `VIEW_DOES_NOT_EXIST_USE_IF_EXISTS`         | View does not exist; use IF EXISTS                                                              |
| 3512 | `CANNOT_WRITE_GENERATED_COLUMN`             | Cannot write generated column … in …                                                            |

## 3600-3699: Semantic/Function

| Code | Name                                          | Message                                      |
| ---- | --------------------------------------------- | -------------------------------------------- |
| 3600 | `THIS_FUNCTION_TAKES_NO_ARGUMENTS`            | This function takes no arguments             |
| 3601 | `FUNCTION_REQUIRES_AT_LEAST_ONE_ARGUMENT`     | Function requires at least one argument      |
| 3602 | `ROW_NUMBER_TAKES_NO_ARGUMENTS`               | ROW\_NUMBER() takes no arguments             |
| 3603 | `RANK_DENSE_RANK_TAKES_NO_ARGUMENTS`          | RANK/DENSE\_RANK takes no arguments          |
| 3604 | `NOW_TAKES_NO_ARGUMENTS`                      | now() takes no arguments                     |
| 3605 | `LAG_LEAD_REQUIRES_AT_LEAST_1_ARGUMENT`       | LAG/LEAD requires at least 1 argument        |
| 3607 | `COALESCE_REQUIRES_AT_LEAST_ONE_ARGUMENT`     | coalesce() requires at least one argument    |
| 3608 | `SUM_REQUIRES_AN_ARGUMENT`                    | sum() requires an argument                   |
| 3609 | `ARRAY_APPEND_REQUIRES_2_ARGUMENTS`           | array\_append requires 2 arguments           |
| 3610 | `ARRAY_APPEND_EXPECTS_ARRAY_ELEMENT`          | array\_append expects (array, element)       |
| 3611 | `ARRAY_PREPEND_REQUIRES_2_ARGUMENTS`          | array\_prepend requires 2 arguments          |
| 3612 | `ARRAY_PREPEND_EXPECTS_ELEMENT_ARRAY`         | array\_prepend expects (element, array)      |
| 3613 | `ARRAY_LENGTH_REQUIRES_2_ARGUMENTS`           | array\_length requires 2 arguments           |
| 3614 | `ARRAY_LENGTH_EXPECTS_ARRAY_INTEGER`          | array\_length expects (array, integer)       |
| 3615 | `UNNEST_REQUIRES_1_ARGUMENT`                  | unnest requires 1 argument                   |
| 3616 | `UNNEST_EXPECTS_AN_ARRAY`                     | unnest expects an array                      |
| 3617 | `QUALIFIED_FUNCTION_NAMES_ARE_NOT_SUPPORTED`  | Qualified function names are not supported   |
| 3618 | `STAR_IS_ONLY_ALLOWED_AS_COUNT_STAR_ARGUMENT` | \`\*\` is only allowed as COUNT(\*) argument |
| 3619 | `UNKNOWN_FUNCTION`                            | Unknown function: …                          |
| 3620 | `WINDOW_FUNCTION_REQUIRES_OVER_CLAUSE`        | Window function \`…\` needs an OVER clause   |

## 3700-3799: DDL/CREATE SCHEMA

| Code | Name                                            | Message                                               |
| ---- | ----------------------------------------------- | ----------------------------------------------------- |
| 3700 | `EXPECTED_SCHEMA_NAME_IN_CREATE_SCHEMA`         | Expected schema name in CREATE SCHEMA                 |
| 3702 | `EXPECTED_NOT_AFTER_IF_IN_CREATE_SCHEMA`        | Expected \`not\` after \`IF\` in CREATE SCHEMA        |
| 3703 | `EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_SCHEMA` | Expected \`exists\` after \`IF NOT\` in CREATE SCHEMA |

## 3800-3899: DDL/DROP SCHEMA

| Code | Name                                      | Message                                         |
| ---- | ----------------------------------------- | ----------------------------------------------- |
| 3800 | `EXPECTED_SCHEMA_NAME_IN_DROP_SCHEMA`     | Expected schema name in DROP SCHEMA             |
| 3802 | `EXPECTED_EXISTS_AFTER_IF_IN_DROP_SCHEMA` | Expected \`exists\` after \`IF\` in DROP SCHEMA |

## 3900-3999: DDL/CREATE VIEW

| Code | Name                                          | Message                                                                          |
| ---- | --------------------------------------------- | -------------------------------------------------------------------------------- |
| 3900 | `EXPECTED_VIEW_NAME_IN_CREATE_VIEW`           | Expected view name in CREATE VIEW                                                |
| 3901 | `EXPECTED_VIEW_NAME_AFTER_DOT_IN_CREATE_VIEW` | Expected view name after \`.\` in CREATE VIEW                                    |
| 3902 | `EXPECTED_AS_IN_CREATE_VIEW`                  | Expected AS in CREATE VIEW                                                       |
| 3903 | `EXPECTED_AS_OR_DOT_BEFORE_VIEW_NAME`         | Expected AS or \`.\` before view name                                            |
| 3904 | `EXPECTED_AS_AFTER_QUALIFIED_VIEW_NAME`       | Expected AS after qualified view name                                            |
| 3908 | `EXPECTED_NOT_AFTER_IF_IN_CREATE_VIEW`        | Expected \`not\` after \`IF\` in CREATE VIEW                                     |
| 3909 | `EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_VIEW` | Expected \`exists\` after \`IF NOT\` in CREATE VIEW                              |
| 3910 | `VIEW_COLUMN_LIST_MISMATCH`                   | CREATE VIEW …: the column list has a different number of columns than the SELECT |

## 4000-4099: DDL/ALTER TYPE

| Code | Name                                                     | Message                                              |
| ---- | -------------------------------------------------------- | ---------------------------------------------------- |
| 4000 | `EXPECTED_EXISTS_AFTER_IF_IN_ALTER_TYPE`                 | Expected \`exists\` after \`IF\` in ALTER TYPE       |
| 4001 | `EXPECTED_DOT_OR_ADD_IN_ALTER_TYPE`                      | Expected \`.\` or \`ADD\` in ALTER TYPE              |
| 4002 | `EXPECTED_DOT_OR_SEMICOLON_AFTER_TYPE_NAME_IN_DROP_TYPE` | Expected \`.\` or \`;\` after type name in DROP TYPE |

## 4100-4199: DDL/Misc

| Code | Name                                             | Message                                     |
| ---- | ------------------------------------------------ | ------------------------------------------- |
| 4100 | `EXPECTED_OPEN_PAREN_AFTER_QUALIFIED_TABLE_NAME` | Expected \`(\` after qualified table name   |
| 4101 | `EXPECTED_NAME`                                  | Expected name                               |
| 4102 | `EXPECTED_NAME_AFTER_DOT_IN_QUALIFIED_NAME`      | Expected name after \`.\` in qualified name |
| 4103 | `EXPECTED_DOT_OR_KEYWORD_AFTER_NAME`             | Expected \`.\` or keyword after name        |
| 4105 | `EXPECTED_TYPE_NAME`                             | Expected type name …                        |
| 4107 | `EXPECTED_DOT_OR_OPEN_PAREN_AFTER_TABLE_NAME`    | Expected \`.\` or \`(\` after table name    |

## 4200-4299: DML/JOIN

| Code | Name                           | Message                      |
| ---- | ------------------------------ | ---------------------------- |
| 4200 | `EXPECTED_JOIN_KEYWORD`        | Expected JOIN after …        |
| 4209 | `EXPECTED_ON_AFTER_JOIN_TABLE` | Expected ON after JOIN table |

## 4300-4399: DML/CASE

| Code | Name                              | Message                         |
| ---- | --------------------------------- | ------------------------------- |
| 4300 | `CASE_REQUIRES_AT_LEAST_ONE_WHEN` | CASE requires at least one WHEN |
| 4301 | `EXPECTED_THEN_AFTER_CASE_WHEN`   | Expected THEN after CASE WHEN   |

## 4400-4499: DML/BETWEEN-IN

| Code | Name                                       | Message                             |
| ---- | ------------------------------------------ | ----------------------------------- |
| 4400 | `EXPECTED_AND_BETWEEN_BETWEEN_BOUNDS`      | Expected AND between BETWEEN bounds |
| 4401 | `EXPECTED_OPEN_PAREN_AFTER_IN`             | Expected \`(\` after IN             |
| 4402 | `EXPECTED_COMMA_OR_CLOSE_PAREN_IN_IN_LIST` | Expected \`,\` or \`)\` in IN list  |

## 4500-4599: DML/CAST

| Code | Name                                   | Message                        |
| ---- | -------------------------------------- | ------------------------------ |
| 4500 | `EXPECTED_OPEN_PAREN_AFTER_CAST`       | Expected \`(\` after CAST      |
| 4501 | `EXPECTED_CLOSE_PAREN_AFTER_CAST_TYPE` | Expected \`)\` after CAST type |
| 4502 | `EXPECTED_AS_IN_CAST`                  | Expected AS in CAST            |
| 4503 | `CANNOT_CAST_BOOLEAN_TO_INTEGER`       | Cannot cast boolean to integer |
| 4504 | `CANNOT_CAST_INTEGER_TO_BOOLEAN`       | Cannot cast integer to boolean |

## 4600-4699: DML/Window Function

| Code | Name                                                  | Message                                          |
| ---- | ----------------------------------------------------- | ------------------------------------------------ |
| 4600 | `EXPECTED_OPEN_PAREN_AFTER_OVER`                      | Expected ( after OVER                            |
| 4601 | `EXPECTED_CLOSE_PAREN_AFTER_OVER_CLAUSE`              | Expected ) after OVER clause                     |
| 4602 | `EXPECTED_PARTITION_BY_OR_ORDER_BY_IN_OVER_CLAUSE`    | Expected PARTITION BY or ORDER BY in OVER clause |
| 4603 | `EXPECTED_ORDER_BY_OR_CLOSE_PAREN_AFTER_PARTITION_BY` | Expected ORDER BY or ) after PARTITION BY        |

## 4700-4799: DML/Array

| Code | Name                                                      | Message                                       |
| ---- | --------------------------------------------------------- | --------------------------------------------- |
| 4700 | `EXPECTED_CLOSE_BRACKET_AFTER_ARRAY_SUBSCRIPT`            | Expected \`\]\` after array subscript         |
| 4701 | `EXPECTED_COMMA_OR_CLOSE_BRACKET_IN_ARRAY_CONSTRUCTOR`    | Expected \`,\` or \`\]\` in ARRAY constructor |
| 4702 | `EXPECTED_CLOSE_BRACKET_AFTER_OPEN_BRACKET_IN_ARRAY_TYPE` | Expected \] after \[ in array type            |

## 4800-4899: DML/Operator

| Code | Name                                                 | Message                                  |
| ---- | ---------------------------------------------------- | ---------------------------------------- |
| 4800 | `EXPECTED_OPEN_PAREN_AFTER_OPERATOR`                 | Expected \`(\` after OPERATOR            |
| 4801 | `EXPECTED_CLOSE_PAREN_AFTER_OPERATOR_OPEN_PAREN`     | Expected ) after OPERATOR(               |
| 4802 | `EXPECTED_OPERATOR_AFTER_OPERATOR_OPEN_PAREN`        | Expected operator after OPERATOR(        |
| 4803 | `EXPECTED_OPEN_PAREN_AFTER_ANY_ALL_SOME`             | Expected ( after ANY/ALL/SOME            |
| 4804 | `EXPECTED_CLOSE_PAREN_AFTER_ANY_ALL_SOME_EXPRESSION` | Expected ) after ANY/ALL/SOME expression |

## 4900-4999: DML/EXISTS

| Code | Name                                  | Message                       |
| ---- | ------------------------------------- | ----------------------------- |
| 4900 | `EXPECTED_OPEN_PAREN_AFTER_EXISTS`    | Expected \`(\` after EXISTS   |
| 4901 | `EXPECTED_CLOSE_PAREN_AFTER_SUBQUERY` | Expected \`)\` after subquery |

## 5000-5099: DML/Misc Expression

| Code | Name                                                  | Message                                                                                                        |
| ---- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 5000 | `EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ARGUMENT_LIST`      | Expected \`,\` or \`)\` in argument list                                                                       |
| 5001 | `EXPECTED_CLOSE_PAREN_AFTER_FUNCTION_NAME_IN_DEFAULT` | Expected \`)\` after function name in DEFAULT                                                                  |
| 5002 | `EXPECTED_NULL_AFTER_IS`                              | Expected NULL after IS                                                                                         |
| 5003 | `EXPECTED_NULL_AFTER_IS_NOT`                          | Expected NULL after IS NOT                                                                                     |
| 5004 | `EXPECTED_NULL_AFTER_DROP_NOT`                        | Expected NULL after DROP NOT                                                                                   |
| 5005 | `EXPECTED_CLOSE_PAREN_AFTER_STAR`                     | Expected \`)\` after \`\*\`                                                                                    |
| 5006 | `EXPECTED_CLOSE_PAREN`                                | Expected \`)\`                                                                                                 |
| 5007 | `UNSUPPORTED_PARENTHESIZED_EXPRESSION`                | Unsupported parenthesized expression; rewrite it without the parentheses or as a subquery, or use queryUntyped |
| 5008 | `EXPECTED_FROM_AFTER_IS_DISTINCT`                     | Expected FROM after IS DISTINCT                                                                                |
| 5009 | `EXPECTED_LIKE_IN_OR_BETWEEN_AFTER_NOT`               | Expected LIKE, IN or BETWEEN after NOT                                                                         |

## 5100-5199: Type-Data/VARCHAR-NUMERIC

| Code | Name                                                    | Message                                 |
| ---- | ------------------------------------------------------- | --------------------------------------- |
| 5100 | `EXPECTED_CLOSE_PAREN_AFTER_VARCHAR_LENGTH`             | Expected ) after VARCHAR length         |
| 5101 | `EXPECTED_NUMBER_FOR_VARCHAR_LENGTH`                    | Expected number for VARCHAR length      |
| 5102 | `EXPECTED_CLOSE_PAREN_AFTER_NUMERIC_SCALE`              | Expected ) after NUMERIC scale          |
| 5103 | `EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_NUMERIC_PRECISION` | Expected , or ) after NUMERIC precision |
| 5104 | `EXPECTED_PRECISION_NUMBER`                             | Expected precision number               |
| 5105 | `EXPECTED_SCALE_NUMBER`                                 | Expected scale number                   |

## 5300-5399: Type-Data/FETCH-LIMIT

| Code | Name                                 | Message                            |
| ---- | ------------------------------------ | ---------------------------------- |
| 5300 | `EXPECTED_FIRST_OR_NEXT_AFTER_FETCH` | Expected FIRST or NEXT after FETCH |
| 5301 | `EXPECTED_ROW_OR_ROWS_IN_FETCH`      | Expected ROW or ROWS in FETCH      |
| 5302 | `EXPECTED_ONLY_AFTER_FETCH_ROW`      | Expected ONLY after FETCH … ROW    |
| 5303 | `EXPECTED_ONLY_AFTER_FETCH_ROWS`     | Expected ONLY after FETCH … ROWS   |

## 5400-5499: Type-Data/Misc

| Code | Name                                                 | Message                                                              |
| ---- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| 5400 | `EXPECTED_TO_IN_RENAME_COLUMN`                       | Expected TO in RENAME COLUMN                                         |
| 5401 | `EXPECTED_OLD_COLUMN_NAME_IN_RENAME_COLUMN`          | Expected old column name in RENAME COLUMN                            |
| 5402 | `EXPECTED_NEW_COLUMN_NAME_AFTER_TO_IN_RENAME_COLUMN` | Expected new column name after TO in RENAME COLUMN                   |
| 5403 | `UNSUPPORTED_ALTER_COLUMN_SET_CLAUSE`                | Unsupported ALTER COLUMN SET clause                                  |
| 5404 | `UNSUPPORTED_ALTER_COLUMN_DROP_CLAUSE`               | Unsupported ALTER COLUMN DROP clause                                 |
| 5405 | `UNSUPPORTED_ALTER_TABLE_ACTION`                     | Unsupported ALTER TABLE action; run this statement with queryUntyped |
| 5406 | `UNEXPECTED_END_IN_CREATE_TYPE_ENUM_BODY`            | Unexpected end in CREATE TYPE enum body                              |
| 5407 | `EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_DEFAULT_VALUE`  | Expected \`,\` or \`)\` after DEFAULT value                          |
| 5408 | `EXPECTED_COMMA_WHERE_OR_END_AFTER_ON_CONFLICT_SET`  | Expected \`,\`, WHERE, or end after ON CONFLICT SET                  |

## Internal error

- 9999 `INTERNAL_ERROR`: it must never be reachable; if you see it, report a bug.

## Retired codes

| Code | Former name                                                   |
| ---- | ------------------------------------------------------------- |
| 1201 | `EXPECTED_SEMICOLON_AFTER_INSERT`                             |
| 1212 | `EXPECTED_COLUMN_NAME_IN_ON_CONFLICT`                         |
| 1218 | `EXPECTED_COLUMN_NAME_IN_ON_CONFLICT_UPDATE`                  |
| 1220 | `EXPECTED_TABLE_NAME_IN_INSERT_INTO`                          |
| 1221 | `EXPECTED_TABLE_NAME_AFTER_DOT_IN_INSERT_INTO`                |
| 1222 | `EXPECTED_COMMA_WHERE_OR_END_AFTER_ON_CONFLICT_SET`           |
| 1223 | `INVALID_VALUE_EXPRESSION_IN_INSERT`                          |
| 1224 | `INVALID_VALUE_EXPRESSION_IN_ON_CONFLICT_UPDATE`              |
| 1302 | `EXPECTED_SEMICOLON_AFTER_UPDATE`                             |
| 1303 | `EXPECTED_COLUMN_NAME_IN_UPDATE_SET`                          |
| 1306 | `EXPECTED_TABLE_NAME_IN_UPDATE`                               |
| 1307 | `EXPECTED_TABLE_NAME_IN_UPDATE_FROM`                          |
| 1308 | `EXPECTED_TABLE_NAME_AFTER_DOT_IN_UPDATE`                     |
| 1401 | `EXPECTED_SEMICOLON_AFTER_DELETE`                             |
| 1402 | `EXPECTED_TABLE_NAME_IN_DELETE_FROM`                          |
| 1403 | `EXPECTED_TABLE_NAME_IN_DELETE_USING`                         |
| 1404 | `EXPECTED_TABLE_NAME_AFTER_DOT_IN_DELETE_FROM`                |
| 1500 | `EXPECTED_SEMICOLON_AFTER_CREATE_TABLE`                       |
| 1503 | `EXPECTED_COLUMN_NAME_IN_CREATE_TABLE`                        |
| 1506 | `EXPECTED_TABLE_NAME_IN_CREATE_TABLE`                         |
| 1600 | `EXPECTED_SEMICOLON_AFTER_ALTER_TABLE`                        |
| 1602 | `EXPECTED_TABLE_NAME_IN_ALTER_TABLE`                          |
| 1603 | `EXPECTED_TABLE_NAME_AFTER_DOT_IN_ALTER_TABLE`                |
| 1604 | `EXPECTED_COLUMN_NAME_AFTER_ADD_IN_ALTER_TABLE`               |
| 1605 | `EXPECTED_COLUMN_NAME_AFTER_ALTER_COLUMN`                     |
| 1606 | `EXPECTED_COLUMN_NAME_AFTER_DROP_COLUMN`                      |
| 1700 | `EXPECTED_SEMICOLON_AFTER_DROP_TABLE`                         |
| 1701 | `EXPECTED_TABLE_NAME_IN_DROP_TABLE`                           |
| 1704 | `EXPECTED_SEMICOLON_AFTER_QUALIFIED_TABLE_NAME_IN_DROP_TABLE` |
| 1800 | `EXPECTED_SEMICOLON_AFTER_CREATE_TYPE`                        |
| 1801 | `EXPECTED_SEMICOLON_AFTER_ALTER_TYPE`                         |
| 1802 | `EXPECTED_SEMICOLON_AFTER_DROP_TYPE`                          |
| 1809 | `EXPECTED_TYPE_NAME_IN_ALTER_TYPE`                            |
| 1810 | `EXPECTED_TYPE_NAME_IN_DROP_TYPE`                             |
| 1811 | `EXPECTED_TYPE_NAME_AFTER_DOT_IN_ALTER_TYPE`                  |
| 1812 | `EXPECTED_TYPE_NAME_AFTER_DOT_IN_DROP_TYPE`                   |
| 2201 | `UNKNOWN_TABLE_UPDATE`                                        |
| 2203 | `UNKNOWN_TABLE_INSERT_INTO`                                   |
| 2204 | `UNKNOWN_TABLE_DELETE_FROM`                                   |
| 2205 | `UNKNOWN_TABLE_IN_DELETE_USING`                               |
| 2208 | `UNKNOWN_SCHEMA_OR_TABLE_IN_FROM`                             |
| 2209 | `UNKNOWN_SCHEMA_OR_TABLE_IN_UPDATE`                           |
| 2211 | `UNKNOWN_SCHEMA_OR_TABLE_IN_INSERT_INTO`                      |
| 2212 | `UNKNOWN_SCHEMA_OR_TABLE_IN_DELETE_FROM`                      |
| 2213 | `UNKNOWN_SCHEMA_OR_TABLE_IN_DELETE_USING`                     |
| 2215 | `UNKNOWN_SCHEMA_FOR_CREATE_TYPE`                              |
| 2216 | `UNKNOWN_SCHEMA_FOR_CREATE_VIEW`                              |
| 2301 | `UNKNOWN_COLUMN_UPDATE_SET`                                   |
| 2303 | `UNKNOWN_COLUMN_IN_INSERT_COLUMN_LIST`                        |
| 2304 | `UNKNOWN_COLUMN_IN_ON_CONFLICT`                               |
| 2305 | `UNKNOWN_COLUMN_IN_ON_CONFLICT_DO_UPDATE_SET`                 |
| 2402 | `UNKNOWN_WINDOW_FUNCTION`                                     |
| 2506 | `INCOMPATIBLE_TYPES_IN_JOIN_ON`                               |
| 2807 | `FUNCTION_EXPECTS_TEXT_ARGUMENT`                              |
| 3606 | `INVALID_LAG_LEAD_ARGUMENTS`                                  |
| 3701 | `EXPECTED_SEMICOLON_AFTER_SCHEMA_NAME_IN_CREATE_SCHEMA`       |
| 3801 | `EXPECTED_SEMICOLON_AFTER_DROP_SCHEMA`                        |
| 4104 | `EXPECTED_TYPE_NAME_GENERIC`                                  |
| 4106 | `EXPECTED_TYPE_NAME_AFTER_CAST_AS`                            |
| 4201 | `EXPECTED_JOIN_AFTER_INNER`                                   |
| 4202 | `EXPECTED_JOIN_AFTER_LEFT_OUTER`                              |
| 4203 | `EXPECTED_JOIN_AFTER_RIGHT_OUTER`                             |
| 4204 | `EXPECTED_JOIN_AFTER_FULL_OUTER`                              |
| 4205 | `EXPECTED_JOIN_KEYWORD_GENERIC`                               |
| 4206 | `EXPECTED_OUTER_OR_JOIN_AFTER_LEFT`                           |
| 4207 | `EXPECTED_OUTER_OR_JOIN_AFTER_RIGHT`                          |
| 4208 | `EXPECTED_OUTER_OR_JOIN_AFTER_FULL`                           |
| 4210 | `EXPECTED_ON_KEYWORD`                                         |
