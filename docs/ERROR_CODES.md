# Error Code Reference

This document provides a comprehensive reference for all error codes in jsql.

## Overview

jsql uses a type-level error system where errors are TypeScript types (`SqlParserError<"message">`). Error codes help identify and categorize errors for better debugging and documentation.

**Error codes appear in:**

- IDE tooltips when hovering over SQL queries
- TypeScript compilation errors
- Type-level error checking

## Error Code Ranges

**4-Digit Scheme with 100-Code Intervals**

Each category has 100 slots, providing room for future expansion.

| Range      | Category                      | Description                          | Used | Free |
| ---------- | ----------------------------- | ------------------------------------ | ---- | ---- |
| 1000-1099  | Lexer/Tokenization            | Errors during SQL tokenization       | 9    | 91   |
| 1100-1199  | Parser Syntax - SELECT        | SELECT statement parsing             | 11   | 89   |
| 1200-1299  | Parser Syntax - INSERT        | INSERT statement parsing             | 20   | 80   |
| 1300-1399  | Parser Syntax - UPDATE        | UPDATE statement parsing             | 9    | 91   |
| 1400-1499  | Parser Syntax - DELETE        | DELETE statement parsing             | 6    | 94   |
| 1500-1599  | Parser Syntax - CREATE TABLE  | CREATE TABLE parsing                 | 10   | 90   |
| 1600-1699  | Parser Syntax - ALTER TABLE   | ALTER TABLE parsing                  | 10   | 90   |
| 1700-1799  | Parser Syntax - DROP TABLE    | DROP TABLE parsing                   | 5    | 95   |
| 1800-1899  | Parser Syntax - Type DDL      | CREATE/ALTER/DROP TYPE               | 15   | 85   |
| 1900-1999  | Parser Syntax - Other DDL     | Other DDL statements                 | 15   | 85   |
| 2000-2099  | Validation - Expression       | Invalid expressions                  | 30   | 70   |
| 2100-2199  | Validation - Statement        | Invalid statements                   | 20   | 80   |
| 2200-2299  | Resolution - Table/Schema     | Unknown tables or schemas            | 17   | 83   |
| 2300-2399  | Resolution - Column           | Unknown columns                      | 9    | 91   |
| 2400-2499  | Resolution - Other            | Other resolution errors              | 3    | 97   |
| 2500-2599  | Type System - Compatibility   | Type compatibility errors            | 9    | 91   |
| 2600-2699  | Type System - Boolean         | Boolean type errors                  | 7    | 93   |
| 2700-2799  | Type System - NULL            | NULL handling errors                 | 5    | 95   |
| 2800-2899  | Type System - Text/String     | Text operation errors                | 6    | 94   |
| 2900-2999  | Type System - Numeric         | Numeric operation errors             | 1    | 99   |
| 3000-3099  | Type System - Array           | Array operation errors               | 2    | 98   |
| 3100-3199  | Type System - Subquery        | Subquery type errors                 | 4    | 96   |
| 3200-3299  | Semantic - Duplicate/Exist    | Duplicate or existence checks        | 12   | 88   |
| 3300-3399  | Semantic - Constraints        | Constraint violations                | 14   | 86   |
| 3400-3499  | Semantic - SELECT             | SELECT-specific constraints          | 7    | 93   |
| 3500-3599  | Semantic - Statement          | Statement constraints                | 6    | 94   |
| 3600-3699  | Semantic - Function           | Function constraints                 | 20   | 80   |
| 3700-3799  | DDL - CREATE SCHEMA           | CREATE SCHEMA errors                 | 4    | 96   |
| 3800-3899  | DDL - DROP SCHEMA             | DROP SCHEMA errors                   | 3    | 97   |
| 3900-3999  | DDL - CREATE VIEW             | CREATE VIEW errors                   | 6    | 94   |
| 4000-4099  | DDL - ALTER TYPE              | ALTER TYPE errors                    | 3    | 97   |
| 4100-4199  | DDL - Misc                    | Miscellaneous DDL errors             | 16   | 84   |
| 4200-4299  | DML - JOIN                    | JOIN operation errors                | 11   | 89   |
| 4300-4399  | DML - CASE                    | CASE expression errors               | 2    | 98   |
| 4400-4499  | DML - BETWEEN/IN              | BETWEEN/IN operation errors          | 3    | 97   |
| 4500-4599  | DML - CAST                    | CAST operation errors                | 3    | 97   |
| 4600-4699  | DML - Window Functions        | Window function errors               | 4    | 96   |
| 4700-4799  | DML - Array Operations        | Array operation errors               | 3    | 97   |
| 4800-4899  | DML - Operators               | Operator errors                      | 5    | 95   |
| 4900-4999  | DML - EXISTS/Subquery         | EXISTS/subquery errors               | 2    | 98   |
| 5000-5099  | DML - Misc Expression         | Miscellaneous expression errors      | 25   | 75   |
| 5100-5199  | Type/Data - VARCHAR/NUMERIC   | VARCHAR/NUMERIC errors               | 6    | 94   |
| 5200-5299  | Type/Data - DEFAULT           | DEFAULT value errors                 | 5    | 95   |
| 5300-5399  | Type/Data - FETCH/LIMIT       | FETCH/LIMIT errors                   | 4    | 96   |
| 5400-5499  | Type/Data - Misc              | Miscellaneous type/data errors       | 24   | 76   |

**Total:** 357 codes used, ~3,400 slots available for future expansion

## Error Code Registry

### 1000-1099: Lexer/Tokenization Errors

| Code | ID                         | Message                            |
| ---- | -------------------------- | ---------------------------------- |
| 1000 | UNCLOSED_QUOTED_IDENTIFIER | Unclosed quoted identifier literal |
| 1001 | UNCLOSED_STRING_LITERAL    | Unclosed string literal            |
| 1002 | UNCLOSED_TAGGED_STRING     | Unclosed tagged string             |
| 1003 | WRONG_STRING_TAG           | Wrong string tag                   |
| 1004 | UNBALANCED_PARENTHESES     | Unbalanced parentheses             |
| 1005 | TOKEN_NOT_FOUND            | Token not found                    |
| 1006 | UNEXPECTED_TOKEN           | Unexpected token                   |
| 1007 | CLOSING_BRACKET_NOT_FOUND  | Closing bracket not found: X       |
| 1008 | UNMATCHED_CLOSING_BRACKET  | Unmatched closing bracket: X       |

**Example:**

```typescript
const query = `SELECT "unclosed FROM users` as const
// Error: SqlParserError<"[dbt:1000] Unclosed quoted identifier literal">
```

### 1100-1199: Parser Syntax - SELECT Statement

| Code | ID                                             | Message                                      |
| ---- | ---------------------------------------------- | -------------------------------------------- |
| 1100 | EXPECTED_SELECT_AFTER_WITH                     | Expected SELECT after WITH clause            |
| 1101 | EXPECTED_SELECT_IN_SUBQUERY                    | Expected SELECT in subquery                  |
| 1102 | EXPECTED_SELECT_IN_DERIVED_TABLE               | Expected SELECT in derived table             |
| 1103 | EXPECTED_SELECT_IN_EXISTS_SUBQUERY             | Expected SELECT in EXISTS subquery           |
| 1104 | EXPECTED_SELECT_OR_WITH_AFTER_AS_IN_CREATE_VIEW| Expected SELECT or WITH after AS in CREATE VIEW |
| 1105 | EXPECTED_SEMICOLON_AFTER_SELECT                | Expected semicolon after SELECT              |
| 1106 | EXPECTED_FROM_AFTER_SELECT_LIST                | Expected FROM after SELECT list              |
| 1107 | EXPECTED_BY_AFTER_GROUP                        | Expected BY after GROUP                      |
| 1108 | EXPECTED_BY_AFTER_ORDER                        | Expected BY after ORDER                      |
| 1109 | EXPECTED_BY_AFTER_ORDER_IN_OVER_CLAUSE         | Expected BY after ORDER in OVER clause       |
| 1110 | EXPECTED_BY_AFTER_PARTITION                    | Expected BY after PARTITION                  |

**Example:**

```typescript
const query = `SELECT * FROM users GROUP` as const
// Error: SqlParserError<"[dbt:1107] Expected BY after GROUP">
```

### 2200-2299: Resolution - Table/Schema Errors

| Code | ID                         | Message                    |
| ---- | -------------------------- | -------------------------- |
| 2200 | UNKNOWN_TABLE_FROM         | Unknown table in FROM      |
| 2201 | UNKNOWN_TABLE_UPDATE       | Unknown table in UPDATE    |
| 2203 | UNKNOWN_TABLE_INSERT_INTO  | Unknown table in INSERT INTO |
| 2204 | UNKNOWN_TABLE_DELETE_FROM  | Unknown table in DELETE FROM |

**Example:**

```typescript
const query = `SELECT * FROM nonexistent_table` as const
// Error: SqlParserError<"[dbt:2200] Unknown table in FROM">
```

### 2300-2399: Resolution - Column Errors

| Code | ID                      | Message                      |
| ---- | ----------------------- | ---------------------------- |
| 2300 | UNKNOWN_COLUMN          | Unknown column               |
| 2301 | UNKNOWN_COLUMN_UPDATE_SET | Unknown column in UPDATE SET |
| 2302 | UNKNOWN_COLUMN_INSERT   | Unknown column in INSERT     |

**Example:**

```typescript
const query = `SELECT nonexistent_column FROM users` as const
// Error: SqlParserError<"[dbt:2300] Unknown column">
```

### 2600-2699: Type System - Boolean Type Errors

| Code | ID                                | Message                                          |
| ---- | --------------------------------- | ------------------------------------------------ |
| 2600 | EXPRESSION_MUST_BE_BOOLEAN        | Expression must be boolean, but has a type X     |
| 2601 | CASE_WHEN_MUST_BE_BOOLEAN         | CASE WHEN must be boolean                        |
| 2602 | NOT_REQUIRES_BOOLEAN_OPERAND      | NOT requires a boolean operand                   |
| 2603 | NOT_ARGUMENT_MUST_BE_BOOLEAN_NOT_NULL | NOT argument must be boolean, not NULL       |
| 2604 | AND_OPERANDS_MUST_BE_BOOLEAN      | AND operands must be boolean                     |
| 2605 | OR_OPERANDS_MUST_BE_BOOLEAN       | OR operands must be boolean                      |
| 2606 | NULL_NOT_VALID_BOOLEAN_OPERAND    | NULL is not a valid boolean operand (use IS NULL)|

**Example:**

```typescript
const query = `SELECT * FROM users WHERE 'text'` as const
// Error: SqlParserError<"[dbt:2600] Expression must be boolean, but has a type text">
```

### 2700-2799: Type System - NULL Handling

| Code | ID                                | Message                              |
| ---- | --------------------------------- | ------------------------------------ |
| 2700 | NULL_NOT_ALLOWED_NOT_NULL_COLUMN  | NULL not allowed for NOT NULL column |
| 2701 | NULL_NOT_ALLOWED_ARITHMETIC       | NULL not allowed in arithmetic       |
| 2704 | USE_IS_NULL_INSTEAD_OF_EQUALS_NULL| Use IS NULL instead of = null        |

**Example:**

```typescript
const query = `SELECT * FROM users WHERE name = null` as const
// Error: SqlParserError<"[dbt:2704] Use IS NULL instead of = null">
```

### 200-299: Parser Syntax Errors

#### 200-219: SELECT Statement

| Code | ID                                              | Message                                         |
| ---- | ----------------------------------------------- | ----------------------------------------------- |
| 200  | EXPECTED_SELECT_AFTER_WITH                      | Expected SELECT after WITH clause               |
| 201  | EXPECTED_SELECT_IN_SUBQUERY                     | Expected SELECT in subquery                     |
| 202  | EXPECTED_SELECT_IN_DERIVED_TABLE                | Expected SELECT in derived table                |
| 203  | EXPECTED_SELECT_IN_EXISTS_SUBQUERY              | Expected SELECT in EXISTS subquery              |
| 204  | EXPECTED_SELECT_OR_WITH_AFTER_AS_IN_CREATE_VIEW | Expected SELECT or WITH after AS in CREATE VIEW |
| 205  | EXPECTED_SEMICOLON_AFTER_SELECT                 | Expected semicolon after SELECT                 |
| 206  | EXPECTED_FROM_AFTER_SELECT_LIST                 | Expected FROM after SELECT list                 |
| 207  | EXPECTED_BY_AFTER_GROUP                         | Expected BY after GROUP                         |
| 208  | EXPECTED_BY_AFTER_ORDER                         | Expected BY after ORDER                         |
| 209  | EXPECTED_BY_AFTER_ORDER_IN_OVER_CLAUSE          | Expected BY after ORDER in OVER clause          |
| 210  | EXPECTED_BY_AFTER_PARTITION                     | Expected BY after PARTITION                     |

**Example:**

```typescript
const query = `SELECT * FROM users GROUP` as const
// Error: SqlParserError<"Expected BY after GROUP">
```

### 400-499: Resolution Errors

#### Table Resolution

| Code | ID                        | Message                      |
| ---- | ------------------------- | ---------------------------- |
| 400  | UNKNOWN_TABLE_FROM        | Unknown table in FROM        |
| 401  | UNKNOWN_TABLE_UPDATE      | Unknown table in UPDATE      |
| 403  | UNKNOWN_TABLE_INSERT_INTO | Unknown table in INSERT INTO |
| 404  | UNKNOWN_TABLE_DELETE_FROM | Unknown table in DELETE FROM |

**Example:**

```typescript
const query = `SELECT * FROM nonexistent_table` as const
// Error: SqlParserError<"Unknown table in FROM">
```

#### Column Resolution

| Code | ID                        | Message                      |
| ---- | ------------------------- | ---------------------------- |
| 420  | UNKNOWN_COLUMN            | Unknown column               |
| 421  | UNKNOWN_COLUMN_UPDATE_SET | Unknown column in UPDATE SET |
| 422  | UNKNOWN_COLUMN_INSERT     | Unknown column in INSERT     |

**Example:**

```typescript
const query = `SELECT nonexistent_column FROM users` as const
// Error: SqlParserError<"Unknown column">
```

### 500-599: Type System Errors

#### 520-529: Boolean Type Errors

| Code | ID                                    | Message                                           |
| ---- | ------------------------------------- | ------------------------------------------------- |
| 520  | EXPRESSION_MUST_BE_BOOLEAN            | Expression must be boolean, but has a type X      |
| 521  | CASE_WHEN_MUST_BE_BOOLEAN             | CASE WHEN must be boolean                         |
| 522  | NOT_REQUIRES_BOOLEAN_OPERAND          | NOT requires a boolean operand                    |
| 523  | NOT_ARGUMENT_MUST_BE_BOOLEAN_NOT_NULL | NOT argument must be boolean, not NULL            |
| 524  | AND_OPERANDS_MUST_BE_BOOLEAN          | AND operands must be boolean                      |
| 525  | OR_OPERANDS_MUST_BE_BOOLEAN           | OR operands must be boolean                       |
| 526  | NULL_NOT_VALID_BOOLEAN_OPERAND        | NULL is not a valid boolean operand (use IS NULL) |

**Example:**

```typescript
const query = `SELECT * FROM users WHERE 'text'` as const
// Error: SqlParserError<"Expression must be boolean, but has a type text">
```

#### 530-539: NULL Handling

| Code | ID                                 | Message                              |
| ---- | ---------------------------------- | ------------------------------------ |
| 530  | NULL_NOT_ALLOWED_NOT_NULL_COLUMN   | NULL not allowed for NOT NULL column |
| 531  | NULL_NOT_ALLOWED_ARITHMETIC        | NULL not allowed in arithmetic       |
| 534  | USE_IS_NULL_INSTEAD_OF_EQUALS_NULL | Use IS NULL instead of = null        |

**Example:**

```typescript
const query = `SELECT * FROM users WHERE name = null` as const
// Error: SqlParserError<"Use IS NULL instead of = null">
```

## How to Add New Error Codes

When adding a new error code to the registry:

1. **Choose the appropriate range** based on error category
2. **Pick the next available code** in that range
3. **Create a unique ID** in SCREAMING_SNAKE_CASE format
4. **Format the message** as an array:
    - Static messages: `["message text"]`
    - Dynamic messages: `["part1", "part2"]` for interpolation
5. **Add to registry** in `src/sql-parser-error.ts`
6. **Update this documentation** with the new error code

### Example

```typescript
// In src/sql-parser-error.ts
export const errors = {
	// ... existing codes ...

	// Add new error in appropriate range
	211: {
		id: "EXPECTED_COLUMN_NAME_IN_SELECT",
		msg: ["Expected column name in SELECT"],
	},
} as const
```

## Compile-Time Guarantees

The error registry includes compile-time checks for:

1. **Duplicate IDs**: Ensures no two error codes share the same ID
2. **Duplicate Messages**: Ensures no two error codes have identical messages

If you add a duplicate, TypeScript will show a compilation error.

## Error Code Format

Error codes follow this structure:

```typescript
{
  id: string,           // SCREAMING_SNAKE_CASE identifier
  msg: string[]         // Array of message parts for interpolation
}
```

## Future Expansion

Error code ranges have gaps to allow for future expansion:

- Each category has room for growth
- Subcategories (e.g., 200-219 for SELECT) allow organized additions
- New categories can be added in unused ranges

## Status

**Current Coverage:** 357 error codes implemented (as of 2026-05-08)

**Numbering Scheme:** 4-digit codes (1000-5499) with 100-code intervals

**Complete Coverage:** All error messages in codebase now have error codes

**Implementation Status:**
- ✅ Phase 1: Foundation (38 core errors)
- ✅ Phase 2: Lexer & Expression Parser (completed)
- ✅ Phase 3: Statement Parsers (completed)
- ✅ Phase 4: DDL & Type System (completed)
- ✅ Phase 5: Semantic & Finalization (completed)
- ✅ Renumbering: 3-digit to 4-digit scheme (completed)

**Error Code Distribution:**
- 1000-1099: Lexer/Tokenization - 9 codes (91 slots free)
- 1100-1999: Parser Syntax - 101 codes (799 slots free)
- 2000-2199: Validation - 50 codes (150 slots free)
- 2200-2499: Resolution - 29 codes (271 slots free)
- 2500-3199: Type System - 40 codes (660 slots free)
- 3200-3699: Semantic/Constraints - 59 codes (441 slots free)
- 3700-4199: DDL-Specific - 32 codes (468 slots free)
- 4200-5099: DML/Expression - 58 codes (842 slots free)
- 5100-5499: Type/Data Specific - 39 codes (361 slots free)

**Total:** 357 codes used, ~3,400 slots available for future expansion

## See Also

- `src/sql-parser-error.ts` - Error code registry implementation
- `.features/2026-05-08-1416-error-codes.md` - Feature implementation plan
