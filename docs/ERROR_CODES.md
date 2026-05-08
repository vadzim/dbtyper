# Error Code Reference

This document provides a comprehensive reference for all error codes in jsql.

## Overview

jsql uses a type-level error system where errors are TypeScript types (`SqlParserError<"message">`). Error codes help identify and categorize errors for better debugging and documentation.

**Error codes appear in:**
- IDE tooltips when hovering over SQL queries
- TypeScript compilation errors
- Type-level error checking

## Error Code Ranges

| Range | Category | Description |
|-------|----------|-------------|
| 100-199 | Lexer/Tokenization | Errors during SQL tokenization |
| 200-299 | Parser Syntax | Expected keywords or tokens |
| 300-399 | Validation | Invalid expressions or statements |
| 400-499 | Resolution | Unknown tables, columns, or identifiers |
| 500-599 | Type System | Type compatibility and checking |
| 600-699 | Semantic/Constraints | Constraint violations and semantic errors |
| 700-799 | DDL-Specific | CREATE/ALTER/DROP statement errors |
| 800-899 | DML-Specific | INSERT/UPDATE/DELETE/SELECT expression errors |
| 900-999 | Type/Data Specific | Data type and format errors |

## Error Code Registry

### 100-199: Lexer/Tokenization Errors

| Code | ID | Message |
|------|----|---------| 
| 101 | UNCLOSED_QUOTED_IDENTIFIER | Unclosed quoted identifier literal |
| 102 | UNCLOSED_STRING_LITERAL | Unclosed string literal |
| 103 | UNCLOSED_TAGGED_STRING | Unclosed tagged string |
| 104 | WRONG_STRING_TAG | Wrong string tag |
| 105 | UNBALANCED_PARENTHESES | Unbalanced parentheses |
| 106 | TOKEN_NOT_FOUND | Token not found |
| 107 | UNEXPECTED_TOKEN | Unexpected token |
| 108 | CLOSING_BRACKET_NOT_FOUND | Closing bracket not found: X |

**Example:**
```typescript
const query = `SELECT "unclosed FROM users` as const
// Error: SqlParserError<"Unclosed quoted identifier literal">
```

### 200-299: Parser Syntax Errors

#### 200-219: SELECT Statement

| Code | ID | Message |
|------|----|---------| 
| 200 | EXPECTED_SELECT_AFTER_WITH | Expected SELECT after WITH clause |
| 201 | EXPECTED_SELECT_IN_SUBQUERY | Expected SELECT in subquery |
| 202 | EXPECTED_SELECT_IN_DERIVED_TABLE | Expected SELECT in derived table |
| 203 | EXPECTED_SELECT_IN_EXISTS_SUBQUERY | Expected SELECT in EXISTS subquery |
| 204 | EXPECTED_SELECT_OR_WITH_AFTER_AS_IN_CREATE_VIEW | Expected SELECT or WITH after AS in CREATE VIEW |
| 205 | EXPECTED_SEMICOLON_AFTER_SELECT | Expected semicolon after SELECT |
| 206 | EXPECTED_FROM_AFTER_SELECT_LIST | Expected FROM after SELECT list |
| 207 | EXPECTED_BY_AFTER_GROUP | Expected BY after GROUP |
| 208 | EXPECTED_BY_AFTER_ORDER | Expected BY after ORDER |
| 209 | EXPECTED_BY_AFTER_ORDER_IN_OVER_CLAUSE | Expected BY after ORDER in OVER clause |
| 210 | EXPECTED_BY_AFTER_PARTITION | Expected BY after PARTITION |

**Example:**
```typescript
const query = `SELECT * FROM users GROUP` as const
// Error: SqlParserError<"Expected BY after GROUP">
```

### 400-499: Resolution Errors

#### Table Resolution

| Code | ID | Message |
|------|----|---------| 
| 400 | UNKNOWN_TABLE_FROM | Unknown table in FROM |
| 401 | UNKNOWN_TABLE_UPDATE | Unknown table in UPDATE |
| 403 | UNKNOWN_TABLE_INSERT_INTO | Unknown table in INSERT INTO |
| 404 | UNKNOWN_TABLE_DELETE_FROM | Unknown table in DELETE FROM |

**Example:**
```typescript
const query = `SELECT * FROM nonexistent_table` as const
// Error: SqlParserError<"Unknown table in FROM">
```

#### Column Resolution

| Code | ID | Message |
|------|----|---------| 
| 420 | UNKNOWN_COLUMN | Unknown column |
| 421 | UNKNOWN_COLUMN_UPDATE_SET | Unknown column in UPDATE SET |
| 422 | UNKNOWN_COLUMN_INSERT | Unknown column in INSERT |

**Example:**
```typescript
const query = `SELECT nonexistent_column FROM users` as const
// Error: SqlParserError<"Unknown column">
```

### 500-599: Type System Errors

#### 520-529: Boolean Type Errors

| Code | ID | Message |
|------|----|---------| 
| 520 | EXPRESSION_MUST_BE_BOOLEAN | Expression must be boolean, but has a type X |
| 521 | CASE_WHEN_MUST_BE_BOOLEAN | CASE WHEN must be boolean |
| 522 | NOT_REQUIRES_BOOLEAN_OPERAND | NOT requires a boolean operand |
| 523 | NOT_ARGUMENT_MUST_BE_BOOLEAN_NOT_NULL | NOT argument must be boolean, not NULL |
| 524 | AND_OPERANDS_MUST_BE_BOOLEAN | AND operands must be boolean |
| 525 | OR_OPERANDS_MUST_BE_BOOLEAN | OR operands must be boolean |
| 526 | NULL_NOT_VALID_BOOLEAN_OPERAND | NULL is not a valid boolean operand (use IS NULL) |

**Example:**
```typescript
const query = `SELECT * FROM users WHERE 'text'` as const
// Error: SqlParserError<"Expression must be boolean, but has a type text">
```

#### 530-539: NULL Handling

| Code | ID | Message |
|------|----|---------| 
| 530 | NULL_NOT_ALLOWED_NOT_NULL_COLUMN | NULL not allowed for NOT NULL column |
| 531 | NULL_NOT_ALLOWED_ARITHMETIC | NULL not allowed in arithmetic |
| 534 | USE_IS_NULL_INSTEAD_OF_EQUALS_NULL | Use IS NULL instead of = null |

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

**Complete Coverage:** All error messages in codebase now have error codes

**Implementation Status:**
- ✅ Phase 1: Foundation (38 core errors)
- ✅ Phase 2: Lexer & Expression Parser (completed)
- ✅ Phase 3: Statement Parsers (completed)
- ✅ Phase 4: DDL & Type System (completed)
- ✅ Phase 5: Semantic & Finalization (completed)

**Error Code Distribution:**
- 100-199: Lexer/Tokenization - 9 codes
- 200-299: Parser Syntax - 101 codes
- 300-399: Validation - 50 codes
- 400-499: Resolution - 22 codes
- 500-599: Type System - 76 codes
- 600-699: Semantic/Constraints - 59 codes
- 700-799: DDL-Specific - 32 codes
- 800-899: DML/Expression - 58 codes
- 900-999: Type/Data Specific - 39 codes

**Total:** 357 error codes

## See Also

- `src/sql-parser-error.ts` - Error code registry implementation
- `.features/2026-05-08-1416-error-codes.md` - Feature implementation plan
