# Enum Type Support in Expressions

This document describes the enum type support in JSQL expressions.

## Overview

JSQL now supports PostgreSQL-style enum types in expressions. Enum types can be:

- Created with `CREATE TYPE ... AS ENUM`
- Used in table column definitions
- Used in INSERT, UPDATE, SELECT, and other DML statements
- Compared with string literals
- Cast using `::` or `CAST()` syntax
- Used across multiple schemas

## Type System Behavior

Enum types are treated as "unknown" types in the comparison class system. This means:

1. **String literals can be compared with enum columns** - This matches PostgreSQL behavior where string literals are implicitly castable to enum types.

2. **Compile-time validation is limited** - The type system validates:
    - ✅ NULL constraints (e.g., NULL not allowed for NOT NULL enum columns)
    - ✅ Basic type compatibility (enums work with string-like operations)
    - ❌ Specific enum value validation (e.g., 'invalid_value' for a status enum)
    - ❌ Cross-enum-type validation (e.g., using 'high' from priority enum for status column)

3. **Runtime validation** - PostgreSQL performs full validation at runtime:
    - Enum value must exist in the enum type definition
    - Enum types must match (can't compare status enum with priority enum)
    - Type conversions must be valid

This design matches PostgreSQL's behavior where enum validation is primarily a runtime concern.

## Supported Operations

### INSERT

```sql
-- ✅ Valid enum value
INSERT INTO tasks (id, status) VALUES (1, 'active');

-- ✅ NULL for nullable enum column
INSERT INTO tasks (id, status, priority) VALUES (2, 'pending', NULL);

-- ❌ NULL for NOT NULL enum column (compile-time error)
INSERT INTO tasks (id, status) VALUES (3, NULL);
```

### UPDATE

```sql
-- ✅ Update with valid enum value
UPDATE tasks SET status = 'active' WHERE id = 1;

-- ✅ Update to NULL for nullable column
UPDATE tasks SET priority = NULL WHERE id = 2;

-- ❌ Update to NULL for NOT NULL column (compile-time error)
UPDATE tasks SET status = NULL WHERE id = 3;
```

### SELECT

```sql
-- ✅ Compare enum with string literal
SELECT * FROM tasks WHERE status = 'active';

-- ✅ Enum in IN clause
SELECT * FROM tasks WHERE status IN ('active', 'pending');

-- ✅ Enum IS NULL / IS NOT NULL
SELECT * FROM tasks WHERE priority IS NULL;

-- ✅ Enum in ORDER BY
SELECT * FROM tasks ORDER BY status, priority;

-- ✅ Enum in GROUP BY
SELECT status, COUNT(*) FROM tasks GROUP BY status;
```

### Type Casting

```sql
-- ✅ Cast string to enum
SELECT 'active'::status;

-- ✅ Cast in WHERE clause
SELECT * FROM tasks WHERE status = 'active'::status;

-- ✅ CAST() syntax
SELECT CAST('active' AS status);
```

### Complex Expressions

```sql
-- ✅ CASE expression with enum
SELECT
  CASE status
    WHEN 'active' THEN 'Running'
    WHEN 'pending' THEN 'Waiting'
    ELSE 'Stopped'
  END
FROM tasks;

-- ✅ COALESCE with enum
SELECT COALESCE(priority, 'low'::priority) FROM tasks;

-- ✅ BETWEEN with enum (uses enum ordering)
SELECT * FROM tasks WHERE status BETWEEN 'active' AND 'pending';

-- ✅ Comparison operators
SELECT * FROM tasks WHERE status <> 'inactive';
```

### Multi-Schema Support

```sql
-- ✅ Schema-qualified enum types
CREATE TYPE public.status AS ENUM ('active', 'inactive');
CREATE TYPE app.status AS ENUM ('draft', 'published');

-- ✅ Use schema-qualified enum
SELECT * FROM public.tasks WHERE status = 'active'::public.status;
SELECT * FROM app.articles WHERE status = 'draft'::app.status;
```

## Runtime-Only Validation

The following errors are **not** caught at compile-time but will fail at runtime in PostgreSQL:

```sql
-- Invalid enum value
INSERT INTO tasks (id, status) VALUES (1, 'invalid_value');

-- Wrong enum type (using priority value for status column)
INSERT INTO tasks (id, status) VALUES (2, 'high');

-- Type mismatch (integer for enum)
SELECT * FROM tasks WHERE status = 123;

-- Type mismatch (boolean for enum)
SELECT * FROM tasks WHERE status = true;

-- Comparing different enum types
SELECT * FROM tasks WHERE status = priority;

-- Invalid cast
SELECT 'invalid'::status;
```

## Test Coverage

Comprehensive integration tests cover:

1. **INSERT operations** (`test/integration/insert/insert-with-enums.test.ts`)
    - Valid enum values
    - NULL handling
    - Runtime error scenarios

2. **UPDATE operations** (`test/integration/update/update-with-enums.test.ts`)
    - Updating enum columns
    - NULL handling
    - Runtime error scenarios

3. **SELECT operations** (`test/integration/select/select-with-enums.test.ts`)
    - WHERE clauses with enums
    - IN clauses
    - IS NULL / IS NOT NULL
    - Runtime error scenarios

4. **Complex expressions** (`test/integration/expressions/enum-casting-complex.test.ts`)
    - Type casting
    - CASE expressions
    - ORDER BY and GROUP BY
    - COALESCE and other functions

5. **Error cases** (`test/integration/expressions/enum-error-cases.test.ts`)
    - Compile-time errors (NULL constraints)
    - Runtime errors (invalid values, type mismatches)

6. **Multi-schema** (`test/integration/expressions/enum-multi-schema.test.ts`)
    - Enums across different schemas
    - Schema-qualified enum types

## Implementation Details

### Type Classification

Enum types are classified as "unknown" in `SqlComparisonClass`:

```typescript
type SqlComparisonClass<Sql extends string> =
  // ... numeric, boolean, text, uuid, datetime ...
  : "unknown"  // Includes enum types
```

This allows enums to be compared with any type at the type level, with actual validation deferred to runtime.

### Comparison Rules

The `SameComparisonClass` type allows comparisons when either side is "unknown":

```typescript
export type SameComparisonClass<SqlL extends string, SqlR extends string> =
	SqlComparisonClass<SqlL> extends "unknown"
		? true
		: SqlComparisonClass<SqlR> extends "unknown"
			? true
			: SqlComparisonClass<SqlL> extends SqlComparisonClass<SqlR>
				? true
				: false
```

This enables enum-to-string comparisons while maintaining type safety for known types.

## Design Rationale

The current implementation prioritizes:

1. **PostgreSQL compatibility** - Matches PostgreSQL's behavior where enums can be compared with string literals
2. **Simplicity** - Avoids complex type-level string literal validation
3. **Practicality** - Catches the most common errors (NULL constraints) at compile-time
4. **Runtime safety** - Relies on PostgreSQL's runtime validation for enum-specific rules

This approach provides a good balance between compile-time safety and runtime flexibility, similar to how PostgreSQL itself handles enum types.
