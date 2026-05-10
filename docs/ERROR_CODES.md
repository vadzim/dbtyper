# Error Code Reference

This document provides a comprehensive reference for all error codes in jsql.

## Overview

jsql uses a type-level error system where errors are TypeScript types. Error codes help identify and categorize errors for better debugging and documentation.

**Error Type System:**

- **FormatError<ID, Args>** - Primary error constructor with error codes (use this for new code)
- **DbtyperError<Code, Message>** - Formatted error result type
- **SqlParserError<Message>** - Legacy alias for `DbtyperError<-1, Message>` (deprecated)

**Error codes appear in:**

- IDE tooltips when hovering over SQL queries
- TypeScript compilation errors
- Type-level error checking

**Recent Changes (2026-05-10):**

The error system underwent a major refactoring to improve maintainability:
- **Phase 1:** Removed 40 INVALID_* codes (replaced with more specific errors)
- **Phase 2a:** Consolidated 19 UNKNOWN_* codes into 4 base codes with context parameters
- **Phase 2b:** Consolidated 51 EXPECTED_* codes into 6 base codes with context parameters
- **Result:** Reduced from 372 total codes to 264 active codes (29% reduction)

Many error codes now use context parameters to provide specific information while maintaining a single code. For example, `UNKNOWN_TABLE` replaces 7 different codes like `UNKNOWN_TABLE_FROM`, `UNKNOWN_TABLE_UPDATE`, etc.

## Error Code Ranges

**4-Digit Scheme with 100-Code Intervals**

Each category has 100 slots, providing room for future expansion.

| Range     | Category                     | Description                     | Used | Free |
| --------- | ---------------------------- | ------------------------------- | ---- | ---- |
| 1000-1099 | Lexer/Tokenization           | Errors during SQL tokenization  | 9    | 91   |
| 1100-1199 | Parser Syntax - SELECT       | SELECT statement parsing        | 22   | 78   |
| 1200-1299 | Parser Syntax - INSERT       | INSERT statement parsing        | 17   | 83   |
| 1300-1399 | Parser Syntax - UPDATE       | UPDATE statement parsing        | 4    | 96   |
| 1400-1499 | Parser Syntax - DELETE       | DELETE statement parsing        | 2    | 98   |
| 1500-1599 | Parser Syntax - CREATE TABLE | CREATE TABLE parsing            | 7    | 93   |
| 1600-1699 | Parser Syntax - ALTER TABLE  | ALTER TABLE parsing             | 4    | 96   |
| 1700-1799 | Parser Syntax - DROP TABLE   | DROP TABLE parsing              | 2    | 98   |
| 1800-1899 | Parser Syntax - Type DDL     | CREATE/ALTER/DROP TYPE          | 11   | 89   |
| 2100-2199 | Validation - Statement       | Invalid statements              | 10   | 90   |
| 2200-2299 | Resolution - Table/Schema    | Unknown tables or schemas       | 3    | 97   |
| 2300-2399 | Resolution - Column          | Unknown columns                 | 4    | 96   |
| 2400-2499 | Resolution - Other           | Other resolution errors         | 3    | 97   |
| 2500-2599 | Type System - Compatibility  | Type compatibility errors       | 9    | 91   |
| 2600-2699 | Type System - Boolean        | Boolean type errors             | 7    | 93   |
| 2700-2799 | Type System - NULL           | NULL handling errors            | 5    | 95   |
| 2800-2899 | Type System - Text/String    | Text operation errors           | 8    | 92   |
| 2900-2999 | Type System - Numeric        | Numeric operation errors        | 1    | 99   |
| 3000-3099 | Type System - Array          | Array operation errors          | 2    | 98   |
| 3100-3199 | Type System - Subquery       | Subquery type errors            | 4    | 96   |
| 3200-3299 | Semantic - Duplicate/Exist   | Duplicate or existence checks   | 12   | 88   |
| 3300-3399 | Semantic - Constraints       | Constraint violations           | 6    | 94   |
| 3400-3499 | Semantic - SELECT            | SELECT-specific constraints     | 8    | 92   |
| 3500-3599 | Semantic - Statement         | Statement constraints           | 6    | 94   |
| 3600-3699 | Semantic - Function          | Function constraints            | 20   | 80   |
| 3700-3799 | DDL - CREATE SCHEMA          | CREATE SCHEMA errors            | 3    | 97   |
| 3800-3899 | DDL - DROP SCHEMA            | DROP SCHEMA errors              | 2    | 98   |
| 3900-3999 | DDL - CREATE VIEW            | CREATE VIEW errors              | 5    | 95   |
| 4000-4099 | DDL - ALTER TYPE             | ALTER TYPE errors               | 3    | 97   |
| 4100-4199 | DDL - Misc                   | Miscellaneous DDL errors        | 6    | 94   |
| 4200-4299 | DML - JOIN                   | JOIN operation errors           | 3    | 97   |
| 4300-4399 | DML - CASE                   | CASE expression errors          | 2    | 98   |
| 4400-4499 | DML - BETWEEN/IN             | BETWEEN/IN operation errors     | 3    | 97   |
| 4500-4599 | DML - CAST                   | CAST operation errors           | 5    | 95   |
| 4600-4699 | DML - Window Functions       | Window function errors          | 4    | 96   |
| 4700-4799 | DML - Array Operations       | Array operation errors          | 3    | 97   |
| 4800-4899 | DML - Operators              | Operator errors                 | 5    | 95   |
| 4900-4999 | DML - EXISTS/Subquery        | EXISTS/subquery errors          | 2    | 98   |
| 5000-5099 | DML - Misc Expression        | Miscellaneous expression errors | 8    | 92   |
| 5100-5199 | Type/Data - VARCHAR/NUMERIC  | VARCHAR/NUMERIC errors          | 6    | 94   |
| 5200-5299 | Type/Data - DEFAULT          | DEFAULT value errors            | 5    | 95   |
| 5300-5399 | Type/Data - FETCH/LIMIT      | FETCH/LIMIT errors              | 4    | 96   |
| 5400-5499 | Type/Data - Misc             | Miscellaneous type/data errors  | 9    | 91   |

**Total:** 264 active codes, 68 obsolete codes, ~3,400 slots available for future expansion

## Consolidated Error Codes (New in 2026-05-10)

Many error codes have been consolidated to use context parameters instead of having separate codes for each context. This improves maintainability while preserving error specificity through dynamic message formatting.

### UNKNOWN_* Family (Phase 2a Consolidation)

**UNKNOWN_TABLE (2200)**
- **Replaces:** 7 context-specific codes
  - `UNKNOWN_TABLE_FROM` → `UNKNOWN_TABLE` with context "FROM"
  - `UNKNOWN_TABLE_UPDATE` → `UNKNOWN_TABLE` with context "UPDATE"
  - `UNKNOWN_TABLE_IN_UPDATE_FROM` → `UNKNOWN_TABLE` with context "UPDATE FROM"
  - `UNKNOWN_TABLE_INSERT_INTO` → `UNKNOWN_TABLE` with context "INSERT INTO"
  - `UNKNOWN_TABLE_DELETE_FROM` → `UNKNOWN_TABLE` with context "DELETE FROM"
  - `UNKNOWN_TABLE_IN_DELETE_USING` → `UNKNOWN_TABLE` with context "DELETE USING"
  - `UNKNOWN_TABLE_IN_SELECT_STAR` → `UNKNOWN_TABLE` with context "SELECT *"
- **Format:** `["Unknown table ", " in ", ""]`
- **Example:** `Unknown table "users" in UPDATE`

**UNKNOWN_SCHEMA_OR_TABLE (2207)**
- **Replaces:** 6 context-specific codes
  - `UNKNOWN_SCHEMA_OR_TABLE_IN_FROM` → `UNKNOWN_SCHEMA_OR_TABLE` with context "FROM"
  - `UNKNOWN_SCHEMA_OR_TABLE_IN_UPDATE` → `UNKNOWN_SCHEMA_OR_TABLE` with context "UPDATE"
  - `UNKNOWN_SCHEMA_OR_TABLE_IN_UPDATE_FROM` → `UNKNOWN_SCHEMA_OR_TABLE` with context "UPDATE FROM"
  - `UNKNOWN_SCHEMA_OR_TABLE_IN_INSERT_INTO` → `UNKNOWN_SCHEMA_OR_TABLE` with context "INSERT INTO"
  - `UNKNOWN_SCHEMA_OR_TABLE_IN_DELETE_FROM` → `UNKNOWN_SCHEMA_OR_TABLE` with context "DELETE FROM"
  - `UNKNOWN_SCHEMA_OR_TABLE_IN_DELETE_USING` → `UNKNOWN_SCHEMA_OR_TABLE` with context "DELETE USING"
- **Format:** `["Unknown schema or table ", " in ", ""]`
- **Example:** `Unknown schema or table "public.users" in FROM`

**UNKNOWN_SCHEMA (2214)**
- **Replaces:** 2 context-specific codes
  - `UNKNOWN_SCHEMA_FOR_CREATE_TYPE` → `UNKNOWN_SCHEMA` with context "CREATE TYPE"
  - `UNKNOWN_SCHEMA_FOR_CREATE_VIEW` → `UNKNOWN_SCHEMA` with context "CREATE VIEW"
- **Format:** `["Unknown schema ", " for ", ""]`
- **Example:** `Unknown schema "myschema" for CREATE TYPE`

**UNKNOWN_COLUMN (2300)**
- **Replaces:** 5 context-specific codes
  - `UNKNOWN_COLUMN_UPDATE_SET` → `UNKNOWN_COLUMN` with context "UPDATE SET"
  - `UNKNOWN_COLUMN_INSERT` → `UNKNOWN_COLUMN` with context "INSERT"
  - `UNKNOWN_COLUMN_IN_INSERT_COLUMN_LIST` → `UNKNOWN_COLUMN` with context "INSERT column list"
  - `UNKNOWN_COLUMN_IN_ON_CONFLICT` → `UNKNOWN_COLUMN` with context "ON CONFLICT"
  - `UNKNOWN_COLUMN_IN_ON_CONFLICT_DO_UPDATE_SET` → `UNKNOWN_COLUMN` with context "ON CONFLICT DO UPDATE SET"
- **Format:** `["Unknown column ", " in ", ""]`
- **Example:** `Unknown column "email" in UPDATE SET`

### EXPECTED_* Family (Phase 2b Consolidation)

**EXPECTED_SEMICOLON (1105)**
- **Replaces:** 14 context-specific codes across all statement types
- **Format:** `["Expected semicolon after ", ""]`
- **Example:** `Expected semicolon after INSERT`

**EXPECTED_TABLE_NAME (1120)**
- **Replaces:** 14 context-specific codes
- **Format:** `["Expected table name ", ""]`
- **Example:** `Expected table name in UPDATE`

**EXPECTED_COLUMN_NAME (1206)**
- **Replaces:** 8 context-specific codes
- **Format:** `["Expected column name ", ""]`
- **Example:** `Expected column name in INSERT column list`

**EXPECTED_TYPE_NAME (4105)**
- **Replaces:** 6 context-specific codes
- **Format:** `["Expected type name ", ""]`
- **Example:** `Expected type name after CAST AS`

**EXPECTED_JOIN_KEYWORD (4200)**
- **Replaces:** 9 context-specific codes
- **Format:** `["Expected JOIN after ", ""]`
- **Example:** `Expected JOIN after INNER`

**EXPECTED_ON_KEYWORD (4210)**
- **Replaces:** Consolidates ON-related expectations
- **Format:** `["Expected ON keyword"]`
- **Example:** `Expected ON keyword`

## Migration Guide

If you're checking for specific error codes in your tests or error handling, update your code to use the new consolidated codes:

### Before (Old Context-Specific Codes)

```typescript
// Checking for specific table resolution errors
type Err = DbtyperError<2201, ...> // UNKNOWN_TABLE_UPDATE
type Err = DbtyperError<2203, ...> // UNKNOWN_TABLE_INSERT_INTO
type Err = DbtyperError<2204, ...> // UNKNOWN_TABLE_DELETE_FROM
```

### After (Consolidated Codes with Context)

```typescript
// All table resolution errors now use the same code
type Err = DbtyperError<2200, ...> // UNKNOWN_TABLE with context parameter
// The error message will include the context: "Unknown table X in UPDATE"
```

### Code Mapping Reference

**UNKNOWN_* codes (2200-2399):**
- 2201-2206 → 2200 (UNKNOWN_TABLE)
- 2208-2213 → 2207 (UNKNOWN_SCHEMA_OR_TABLE)
- 2215-2216 → 2214 (UNKNOWN_SCHEMA)
- 2301-2305 → 2300 (UNKNOWN_COLUMN)

**EXPECTED_* codes (1100-5400):**
- 1201, 1302, 1401, 1500, 1600, 1700, 1800-1802, 3701, 3801, 3905 → 1105 (EXPECTED_SEMICOLON)
- 1220-1221, 1306-1308, 1402-1404, 1506, 1602-1603, 1701 → 1120 (EXPECTED_TABLE_NAME)
- 1212, 1218, 1303, 1503, 1604-1606 → 1206 (EXPECTED_COLUMN_NAME)
- 1809-1812, 4104, 4106 → 4105 (EXPECTED_TYPE_NAME)
- 4201-4208 → 4200 (EXPECTED_JOIN_KEYWORD)

### Obsolete Code Handling

Obsolete codes are marked in the source code as `OBSOLETE_<CODE>_<OLD_NAME>` and include a message directing you to the replacement code. These codes are kept in the registry to:
1. Maintain code number stability (codes are never reused)
2. Provide clear migration paths
3. Support online documentation and help systems

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
// Error: DbtyperError<1000, "[dbt:1000] Unclosed quoted identifier literal">
```

### 1100-1199: Parser Syntax - SELECT Statement

| Code | ID                                              | Message                                         |
| ---- | ----------------------------------------------- | ----------------------------------------------- |
| 1100 | EXPECTED_SELECT_AFTER_WITH                      | Expected SELECT after WITH clause               |
| 1101 | EXPECTED_SELECT_IN_SUBQUERY                     | Expected SELECT in subquery                     |
| 1102 | EXPECTED_SELECT_IN_DERIVED_TABLE                | Expected SELECT in derived table                |
| 1103 | EXPECTED_SELECT_IN_EXISTS_SUBQUERY              | Expected SELECT in EXISTS subquery              |
| 1104 | EXPECTED_SELECT_OR_WITH_AFTER_AS_IN_CREATE_VIEW | Expected SELECT or WITH after AS in CREATE VIEW |
| 1105 | EXPECTED_SEMICOLON ⭐                            | Expected semicolon after {context}              |
| 1106 | EXPECTED_FROM_AFTER_SELECT_LIST                 | Expected FROM after SELECT list                 |
| 1107 | EXPECTED_BY_AFTER_GROUP                         | Expected BY after GROUP                         |
| 1108 | EXPECTED_BY_AFTER_ORDER                         | Expected BY after ORDER                         |
| 1109 | EXPECTED_BY_AFTER_ORDER_IN_OVER_CLAUSE          | Expected BY after ORDER in OVER clause          |
| 1110 | EXPECTED_BY_AFTER_PARTITION                     | Expected BY after PARTITION                     |
| 1111 | EXPECTED_CTE_NAME_IN_WITH                       | Expected CTE name in WITH                       |
| 1112 | EXPECTED_ALIAS_AFTER_CTE                        | Expected alias after CTE                        |
| 1113 | EXPECTED_ALIAS_AFTER_DERIVED_TABLE              | Expected alias after derived table              |
| 1114 | EXPECTED_ALIAS_NAME_AFTER_AS                    | Expected alias name after AS                    |
| 1115 | EXPECTED_ALIAS_OR_JOIN_CLAUSE_AFTER_TABLE       | Expected alias or join clause after table       |
| 1116 | EXPECTED_OPEN_PAREN_AFTER_AS_IN_WITH            | Expected open paren after AS in WITH            |
| 1117 | EXPECTED_END_AFTER_CASE                         | Expected END after CASE                         |
| 1118 | EXPECTED_WHEN_AFTER_CASE_EXPRESSION             | Expected WHEN after CASE expression             |
| 1119 | EXPECTED_WHEN_ELSE_OR_END_IN_CASE               | Expected WHEN ELSE or END in CASE               |
| 1120 | EXPECTED_TABLE_NAME ⭐                           | Expected table name {context}                   |
| 1121 | EXPECTED_TABLE_NAME_OR_OPEN_PAREN_IN_FROM       | Expected table name or `(` in FROM              |

⭐ = Consolidated code with context parameters (see Consolidated Error Codes section)

**Example:**

```typescript
const query = `SELECT * FROM users GROUP` as const
// Error: DbtyperError<1107, "[dbt:1107] Expected BY after GROUP">

const query2 = `INSERT INTO users VALUES (1)` as const
// Error: DbtyperError<1105, "[dbt:1105] Expected semicolon after INSERT">
```

### 2200-2299: Resolution - Table/Schema Errors

| Code | ID                      | Message                                      |
| ---- | ----------------------- | -------------------------------------------- |
| 2200 | UNKNOWN_TABLE ⭐         | Unknown table {name} in {context}            |
| 2207 | UNKNOWN_SCHEMA_OR_TABLE ⭐ | Unknown schema or table {name} in {context} |
| 2214 | UNKNOWN_SCHEMA ⭐        | Unknown schema {name} for {context}          |

⭐ = Consolidated code with context parameters (see Consolidated Error Codes section)

**Example:**

```typescript
const query = `SELECT * FROM nonexistent_table` as const
// Error: DbtyperError<2200, "[dbt:2200] Unknown table \"nonexistent_table\" in FROM">

const query2 = `UPDATE nonexistent_table SET x = 1` as const
// Error: DbtyperError<2200, "[dbt:2200] Unknown table \"nonexistent_table\" in UPDATE">

const query3 = `SELECT * FROM public.nonexistent` as const
// Error: DbtyperError<2207, "[dbt:2207] Unknown schema or table \"public.nonexistent\" in FROM">
```

### 2300-2399: Resolution - Column Errors

| Code | ID                          | Message                                       |
| ---- | --------------------------- | --------------------------------------------- |
| 2300 | UNKNOWN_COLUMN ⭐            | Unknown column {name} in {context}            |
| 2306 | UNKNOWN_COLUMN_SCHEMA_TABLE_COLUMN | Unknown column {schema}.{table}.{column} |
| 2307 | UNKNOWN_QUALIFIED_COLUMN    | Unknown qualified column {table}.{column}     |
| 2308 | UNKNOWN_ALIAS_IN_SELECT_STAR | Unknown alias in SELECT ... *                |

⭐ = Consolidated code with context parameters (see Consolidated Error Codes section)

**Example:**

```typescript
const query = `SELECT nonexistent_column FROM users` as const
// Error: DbtyperError<2300, "[dbt:2300] Unknown column \"nonexistent_column\" in SELECT">

const query2 = `UPDATE users SET nonexistent = 1` as const
// Error: DbtyperError<2300, "[dbt:2300] Unknown column \"nonexistent\" in UPDATE SET">

const query3 = `SELECT users.nonexistent FROM users` as const
// Error: DbtyperError<2307, "[dbt:2307] Unknown qualified column \"users.nonexistent\"">
```

### 2600-2699: Type System - Boolean Type Errors

| Code | ID                                    | Message                                           |
| ---- | ------------------------------------- | ------------------------------------------------- |
| 2600 | EXPRESSION_MUST_BE_BOOLEAN            | Expression must be boolean, but has a type X      |
| 2601 | CASE_WHEN_MUST_BE_BOOLEAN             | CASE WHEN must be boolean                         |
| 2602 | NOT_REQUIRES_BOOLEAN_OPERAND          | NOT requires a boolean operand                    |
| 2603 | NOT_ARGUMENT_MUST_BE_BOOLEAN_NOT_NULL | NOT argument must be boolean, not NULL            |
| 2604 | AND_OPERANDS_MUST_BE_BOOLEAN          | AND operands must be boolean                      |
| 2605 | OR_OPERANDS_MUST_BE_BOOLEAN           | OR operands must be boolean                       |
| 2606 | NULL_NOT_VALID_BOOLEAN_OPERAND        | NULL is not a valid boolean operand (use IS NULL) |

**Example:**

```typescript
const query = `SELECT * FROM users WHERE 'text'` as const
// Error: DbtyperError<2600, "[dbt:2600] Expression must be boolean, but has a type text">
```

### 2700-2799: Type System - NULL Handling

| Code | ID                                 | Message                              |
| ---- | ---------------------------------- | ------------------------------------ |
| 2700 | NULL_NOT_ALLOWED_NOT_NULL_COLUMN   | NULL not allowed for NOT NULL column |
| 2701 | NULL_NOT_ALLOWED_ARITHMETIC        | NULL not allowed in arithmetic       |
| 2704 | USE_IS_NULL_INSTEAD_OF_EQUALS_NULL | Use IS NULL instead of = null        |

**Example:**

```typescript
const query = `SELECT * FROM users WHERE name = null` as const
// Error: DbtyperError<2704, "[dbt:2704] Use IS NULL instead of = null">
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
7. **Never reuse error codes** - mark deleted codes as OBSOLETE instead

### Example

```typescript
// In src/sql-parser-error.ts
export const errors = {
	// ... existing codes ...

	// Add new error in appropriate range
	1122: {
		id: "EXPECTED_COLUMN_NAME_IN_SELECT",
		msg: ["Expected column name in SELECT"],
	},
} as const
```

### Consolidated Codes

For errors that vary only by context, use consolidated codes with parameters:

```typescript
// Instead of creating multiple codes:
// UNKNOWN_TABLE_FROM, UNKNOWN_TABLE_UPDATE, etc.

// Use one code with context parameter:
2200: {
	id: "UNKNOWN_TABLE",
	msg: ["Unknown table ", " in ", ""],
},
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

## Status

**Current Coverage:** 264 active error codes (as of 2026-05-10)

**Numbering Scheme:** 4-digit codes (1000-5499) with 100-code intervals

**Complete Coverage:** All error messages in codebase now have error codes

**Implementation Status:**

- ✅ Phase 1: Foundation (38 core errors)
- ✅ Phase 2: Lexer & Expression Parser (completed)
- ✅ Phase 3: Statement Parsers (completed)
- ✅ Phase 4: DDL & Type System (completed)
- ✅ Phase 5: Semantic & Finalization (completed)
- ✅ Renumbering: 3-digit to 4-digit scheme (completed)
- ✅ Phase 6: Error System Refactoring (completed 2026-05-10)
  - Removed 40 INVALID_* codes
  - Consolidated 70 codes into 10 base codes with context parameters
  - Reduced from 372 to 264 active codes (29% reduction)

**Error Code Distribution:**

- 1000-1099: Lexer/Tokenization - 9 codes (91 slots free)
- 1100-1199: Parser Syntax - SELECT - 22 codes (78 slots free)
- 1200-1299: Parser Syntax - INSERT - 17 codes (83 slots free)
- 1300-1399: Parser Syntax - UPDATE - 4 codes (96 slots free)
- 1400-1499: Parser Syntax - DELETE - 2 codes (98 slots free)
- 1500-1599: Parser Syntax - CREATE TABLE - 7 codes (93 slots free)
- 1600-1699: Parser Syntax - ALTER TABLE - 4 codes (96 slots free)
- 1700-1799: Parser Syntax - DROP TABLE - 2 codes (98 slots free)
- 1800-1899: Parser Syntax - Type DDL - 11 codes (89 slots free)
- 2100-2199: Validation - Statement - 10 codes (90 slots free)
- 2200-2299: Resolution - Table/Schema - 3 codes (97 slots free)
- 2300-2399: Resolution - Column - 4 codes (96 slots free)
- 2400-2499: Resolution - Other - 3 codes (97 slots free)
- 2500-2599: Type System - Compatibility - 9 codes (91 slots free)
- 2600-2699: Type System - Boolean - 7 codes (93 slots free)
- 2700-2799: Type System - NULL - 5 codes (95 slots free)
- 2800-2899: Type System - Text/String - 8 codes (92 slots free)
- 2900-2999: Type System - Numeric - 1 code (99 slots free)
- 3000-3099: Type System - Array - 2 codes (98 slots free)
- 3100-3199: Type System - Subquery - 4 codes (96 slots free)
- 3200-3299: Semantic - Duplicate/Exist - 12 codes (88 slots free)
- 3300-3399: Semantic - Constraints - 6 codes (94 slots free)
- 3400-3499: Semantic - SELECT - 8 codes (92 slots free)
- 3500-3599: Semantic - Statement - 6 codes (94 slots free)
- 3600-3699: Semantic - Function - 20 codes (80 slots free)
- 3700-3799: DDL - CREATE SCHEMA - 3 codes (97 slots free)
- 3800-3899: DDL - DROP SCHEMA - 2 codes (98 slots free)
- 3900-3999: DDL - CREATE VIEW - 5 codes (95 slots free)
- 4000-4099: DDL - ALTER TYPE - 3 codes (97 slots free)
- 4100-4199: DDL - Misc - 6 codes (94 slots free)
- 4200-4299: DML - JOIN - 3 codes (97 slots free)
- 4300-4399: DML - CASE - 2 codes (98 slots free)
- 4400-4499: DML - BETWEEN/IN - 3 codes (97 slots free)
- 4500-4599: DML - CAST - 5 codes (95 slots free)
- 4600-4699: DML - Window Functions - 4 codes (96 slots free)
- 4700-4799: DML - Array Operations - 3 codes (97 slots free)
- 4800-4899: DML - Operators - 5 codes (95 slots free)
- 4900-4999: DML - EXISTS/Subquery - 2 codes (98 slots free)
- 5000-5099: DML - Misc Expression - 8 codes (92 slots free)
- 5100-5199: Type/Data - VARCHAR/NUMERIC - 6 codes (94 slots free)
- 5200-5299: Type/Data - DEFAULT - 5 codes (95 slots free)
- 5300-5399: Type/Data - FETCH/LIMIT - 4 codes (96 slots free)
- 5400-5499: Type/Data - Misc - 9 codes (91 slots free)

**Total:** 264 active codes, 68 obsolete codes, ~3,400 slots available for future expansion

## See Also

- `src/sql-parser-error.ts` - Error code registry implementation
- `.features/2026-05-08-1416-error-codes.md` - Initial error codes feature implementation
- `docs/ERROR_SYSTEM_REFACTORING.md` - Error system refactoring documentation (2026-05-10)
- `.features/2026-05-10-1433-error-system-refactoring.md` - Refactoring implementation plan
