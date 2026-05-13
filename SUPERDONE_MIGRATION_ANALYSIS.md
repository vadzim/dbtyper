# Superdone.ai Migration to dbtyper - Analysis & Implementation Plan

**Date:** 2026-05-05  
**Project:** dbtyper (jsql-2)  
**Goal:** Implement all SQL features required for superdone.ai to migrate to dbtyper

---

## Executive Summary

Analyzed 50+ SQL migration files and seed data from `~/work/superdone.ai/repos/api/supabase/migrations/` to identify PostgreSQL features used in production. This document provides a comprehensive implementation plan organized by priority and dependencies.

---

## Analysis Methodology

1. **File Coverage**: Scanned all `.sql` files in migrations and seeds directories + TypeScript code in `src/`
2. **Pattern Matching**: Searched for specific SQL patterns (ANY, FULL OUTER JOIN, ::, arrays, window functions, etc.)
3. **Real Usage**: Focused on actual production code, not theoretical features
4. **Frequency Analysis**: Prioritized features by usage frequency
5. **Code Analysis**: Examined TypeScript services using `dataSource.query()` for dynamic SQL
6. **TypeORM Analysis**: Analyzed 100+ TypeORM QueryBuilder usages (see `TYPEORM_QUERYBUILDER_ANALYSIS.md`)

---

## Current dbtyper Status (as of 2026-05-05)

### ✅ Already Implemented

- CTE (WITH clause) with full column validation
- COALESCE() function
- String concatenation (||) operator
- JSONB operators (->>, ->)
- Basic JOINs (INNER, LEFT, CROSS)
- INSERT, UPDATE, DELETE with basic validation
- SELECT with WHERE, ORDER BY, LIMIT
- Subqueries in FROM clause

### 🚧 Partially Implemented

- Type system (basic types work, missing PostgreSQL-specific types)
- Functions (some built-in functions work, many missing)

---

## Feature Usage Analysis

### High-Frequency Features (Critical Priority)

| Feature              | Occurrences | Files                       | Example Usage                                                |
| -------------------- | ----------- | --------------------------- | ------------------------------------------------------------ |
| Type casts (::)      | 49+         | 15+ migrations + TypeScript | `'value'::uuid`, `column::text`, `'[]'::jsonb`, `$1::vector` |
| Array types          | 49+         | 12+ migrations + TypeScript | `uuid[]`, `text[]`, `ARRAY[1,2,3]`, `$1::text[]`             |
| ANY() operator       | 8           | 5 migrations                | `WHERE id = ANY(p_project_ids)`                              |
| FULL OUTER JOIN      | 3           | 3 migrations                | Hybrid search (vector + FTS)                                 |
| ROW_NUMBER() OVER    | 11          | 4 migrations                | Ranking in search results                                    |
| JSONB operations     | 20+         | 10+ migrations + TypeScript | `metadata @>`, `->`, `->>`, `DEFAULT '{}'::jsonb`            |
| INSERT...ON CONFLICT | 9           | 6 TypeScript services       | `ON CONFLICT (id) DO UPDATE SET ...`                         |
| RETURNING clause     | 4           | 3 TypeScript services       | `INSERT ... RETURNING id`                                    |

### Medium-Frequency Features (High Priority)

| Feature               | Occurrences | Files                     | Example Usage                                                  |
| --------------------- | ----------- | ------------------------- | -------------------------------------------------------------- |
| ILIKE operator        | 6+          | 3 migrations + TypeScript | `metadata->>'user' ILIKE '%' \|\| filter \|\| '%'`             |
| EXTRACT() function    | 4+          | 2 migrations + TypeScript | `EXTRACT(EPOCH FROM (now() - date))`                           |
| GREATEST() function   | 3+          | 2 migrations + TypeScript | `GREATEST(max_results * 5, 100)`, `GREATEST(1, ($4::int / 2))` |
| DATE_TRUNC() function | 6+          | TypeScript services       | `DATE_TRUNC('week', m.meeting_date)::date::text`               |
| IS NULL / IS NOT NULL | 2+          | TypeORM QueryBuilder      | `WHERE meeting.meeting_start IS NOT NULL`                      |
| LOWER() / UPPER()     | 2+          | TypeORM QueryBuilder      | `WHERE LOWER(note.title) LIKE $1`                              |
| Subqueries in WHERE   | 1+          | TypeORM QueryBuilder      | `WHERE project.id IN (SELECT ...)`                             |
| ts_rank_cd()          | 3           | 3 migrations              | Full-text search ranking                                       |
| plainto_tsquery()     | 3           | 3 migrations              | Full-text search query parsing                                 |
| @@ operator           | 3           | 3 migrations              | Full-text search matching                                      |
| LIMIT/OFFSET          | 30+         | TypeScript services       | `LIMIT $1 OFFSET $2`                                           |
| ORDER BY...NULLS      | 2           | TypeScript services       | `ORDER BY col DESC NULLS LAST`                                 |
| GROUP BY              | 6+          | TypeScript services       | `GROUP BY DATE_TRUNC('week', date)`                            |
| HAVING                | 1           | TypeScript service        | `HAVING COUNT(*) > 1`                                          |

### Low-Frequency Features (Medium Priority)

| Feature                            | Occurrences | Files               | Example Usage                                                  |
| ---------------------------------- | ----------- | ------------------- | -------------------------------------------------------------- |
| CASE expressions                   | 1           | 1 migration         | `CASE share_type::text WHEN 'private' THEN 'open'::share_type` |
| CTE (WITH clause)                  | 1           | TypeScript service  | `WITH target_emails AS (SELECT unnest($1::text[]) AS email)`   |
| CROSS JOIN LATERAL                 | 5           | TypeScript services | `CROSS JOIN LATERAL jsonb_array_elements(t.tasks::jsonb)`      |
| LEFT JOIN LATERAL                  | 1           | TypeScript service  | `LEFT JOIN LATERAL unnest(m.participants) p ON true`           |
| jsonb_array_elements()             | 5           | TypeScript services | `jsonb_array_elements(tasks::jsonb)`                           |
| unnest()                           | 3           | TypeScript services | `unnest($1::text[])`, `unnest(m.participants)`                 |
| ALL() operator                     | 1           | TypeScript service  | `WHERE m.id != ALL($3::uuid[])`                                |
| ABS() function                     | 1           | TypeScript service  | `ABS(EXTRACT(EPOCH FROM (date1 - date2)))`                     |
| jsonb_array_length()               | 1           | TypeScript service  | `jsonb_array_length(gce.attendees)`                            |
| COUNT(\*) with subquery            | Multiple    | TypeScript services | `(SELECT COUNT(*) FROM jsonb_array_elements(...))`             |
| RIGHT JOIN                         | 0           | 0                   | Not used in superdone.ai                                       |
| Window functions (LAG, LEAD, RANK) | 0           | 0                   | Not used yet                                                   |

---

## Implementation Plan

### Phase 1: Type System Foundation (CRITICAL - 8-12 hours)

**Priority:** 🔴 CRITICAL - Blocks 90% of superdone.ai queries

#### 1.1 Type Cast Operator (::) - 3-4 hours

**Usage:** 49 occurrences across 15+ files

**Examples from superdone.ai:**

```sql
-- UUID casts (most common)
'f953125d-b99e-4197-87ff-93a6d3e7fc61'::uuid
(event->>'user_id')::uuid

-- JSONB casts
'{}'::jsonb
'[]'::jsonb

-- Text casts
id::text
botid::text

-- Enum casts
'open'::share_type
```

**Implementation Tasks:**

- [ ] Parse `::` operator in expression parser
- [ ] Add `ParseTypeCast` type-level function
- [ ] Support basic types: text, integer, bigint, uuid, boolean
- [ ] Support JSONB types: jsonb, json
- [ ] Support array types: text[], uuid[], integer[]
- [ ] Type validation: ensure cast is valid (e.g., can't cast text to integer without validation)
- [ ] Integration tests for all cast types

**Files to modify:**

- `src/parser/parse-expression.ts` - add :: operator parsing
- `src/parser/parser-monad.ts` - add :: token
- `test/integration/types/type-cast.test.ts` - comprehensive tests

---

#### 1.2 Array Type Declarations - 2-3 hours

**Usage:** 49 occurrences (function parameters, table columns)

**Examples from superdone.ai:**

```sql
-- Function parameters
CREATE FUNCTION search_project_content(
    p_project_ids uuid[],
    p_content_types text[] DEFAULT NULL,
    p_issue_ids varchar[]
)

-- Table columns
CREATE TABLE meetings (
    participants text[]
)
```

**Implementation Tasks:**

- [ ] Parse array type syntax in CREATE TABLE: `column_name type[]`
- [ ] Parse array type syntax in function parameters
- [ ] Type inference: `text[]` → array of text
- [ ] Support for all base types: uuid[], text[], integer[], bigint[], varchar[]
- [ ] Integration tests for array columns

**Files to modify:**

- `src/parser/parse-create-table.ts` - add array type parsing
- `src/parser/parse-types.ts` - array type inference
- `test/integration/ddl/create-table-array-types.test.ts`

---

#### 1.3 PostgreSQL Type Aliases - 1-2 hours

**Usage:** Common in migrations

**Types to add:**

```sql
-- Timestamp aliases
timestamptz → timestamp with time zone
timetz → time with time zone

-- Auto-increment types
serial → integer with auto-increment
bigserial → bigint with auto-increment
smallserial → smallint with auto-increment

-- Binary data
bytea

-- Network types
inet, cidr

-- Full-text search
tsvector, tsquery
```

**Implementation Tasks:**

- [ ] Add type alias mapping in type parser
- [ ] Ensure aliases resolve to correct base types
- [ ] Integration tests for each alias

**Files to modify:**

- `src/parser/parse-types.ts` - add alias mappings
- `test/integration/types/type-aliases.test.ts`

---

### Phase 2: Array Operations (CRITICAL - 6-8 hours)

**Priority:** 🔴 CRITICAL - Used in 8 queries across 5 files

#### 2.1 ANY() Operator - 3-4 hours

**Usage:** 8 occurrences in WHERE clauses

**Examples from superdone.ai:**

```sql
-- Most common pattern: filter by array parameter
WHERE se.project_id = ANY(p_project_ids)
WHERE se.content_type = ANY(p_content_types)
WHERE jie.jira_issue_id = ANY(p_issue_ids)

-- With NULL handling
WHERE (p_content_types IS NULL OR se.content_type = ANY(p_content_types))
```

**Implementation Tasks:**

- [ ] Parse `ANY(array_expression)` syntax
- [ ] Type checking: `column = ANY(array)` requires column type to match array element type
- [ ] Support for comparison operators: =, <>, <, >, <=, >=
- [ ] Support for array literals: `ANY(ARRAY[1,2,3])`
- [ ] Support for array parameters: `ANY(p_ids)`
- [ ] Support for subqueries: `ANY(SELECT id FROM table)` (future)
- [ ] Integration tests for all patterns

**Files to modify:**

- `src/parser/parse-expression.ts` - add ANY() parsing
- `src/parser/binary-operator.ts` - add ANY type checking
- `test/integration/select/select-any-operator.test.ts`

---

#### 2.2 Array Operators - 2-3 hours

**Usage:** Used in search and filtering

**Operators to implement:**

```sql
-- Containment (used in superdone.ai)
metadata @> filter  -- JSONB contains (already works?)
array <@ array      -- is contained by

-- Equality
array = array

-- Concatenation (|| already works for strings, need array support)
array || array
array || element
element || array
```

**Implementation Tasks:**

- [ ] Add `<@` operator for arrays
- [ ] Add `@>` operator for arrays (if not already working)
- [ ] Extend `||` operator to support arrays
- [ ] Type checking for array operations
- [ ] Integration tests

**Files to modify:**

- `src/parser/binary-operator.ts` - add array operators
- `test/integration/select/select-array-operators.test.ts`

---

#### 2.3 Array Literal Syntax - 1 hour

**Usage:** Less common, but needed for completeness

**Examples:**

```sql
ARRAY[1, 2, 3]
ARRAY['a', 'b', 'c']
'{1,2,3}'::integer[]
```

**Implementation Tasks:**

- [ ] Parse `ARRAY[...]` syntax
- [ ] Parse `'{...}'::type[]` syntax
- [ ] Type inference for array literals
- [ ] Integration tests

**Files to modify:**

- `src/parser/parse-expression.ts` - add array literal parsing
- `test/integration/select/select-array-literals.test.ts`

---

### Phase 3: JOIN Extensions (HIGH - 3-4 hours)

**Priority:** 🟠 HIGH - Used in 3 critical search functions

#### 3.1 FULL OUTER JOIN - 3-4 hours

**Usage:** 3 occurrences in hybrid search (vector + full-text)

**Example from superdone.ai:**

```sql
-- Combine vector search and full-text search results
SELECT
    COALESCE(vr.id, fr.id) AS id,
    COALESCE(vr.vec_similarity, 0) AS vec_similarity,
    COALESCE(1.0 / (60 + vr.vec_rank), 0) AS vec_rrf,
    COALESCE(1.0 / (60 + fr.fts_rank), 0) AS fts_rrf
FROM vector_ranked vr
FULL OUTER JOIN fts_ranked fr ON vr.id = fr.id
```

**Implementation Tasks:**

- [ ] Parse `FULL OUTER JOIN` and `FULL JOIN` syntax
- [ ] Handle nullable columns from both sides (all columns become nullable)
- [ ] Type checking for JOIN ON conditions
- [ ] Integration tests with COALESCE (common pattern)

**Files to modify:**

- `src/parser/parse-select.ts` - add FULL OUTER JOIN parsing
- `src/parser/parse-from.ts` - handle FULL OUTER JOIN in type inference
- `test/integration/select/select-full-outer-join.test.ts`

---

#### 3.2 RIGHT JOIN - 1 hour (Optional)

**Usage:** 0 occurrences in superdone.ai

**Note:** Not used in superdone.ai, but easy to implement for completeness.

**Implementation Tasks:**

- [ ] Parse `RIGHT JOIN` / `RIGHT OUTER JOIN` syntax
- [ ] Handle nullable columns from left side
- [ ] Integration tests

**Files to modify:**

- `src/parser/parse-select.ts`
- `test/integration/select/select-right-join.test.ts`

---

### Phase 4: Window Functions (HIGH - 4-6 hours)

**Priority:** 🟠 HIGH - Used in 4 search functions for ranking

#### 4.1 ROW_NUMBER() OVER - 4-6 hours

**Usage:** 11 occurrences for ranking search results

**Examples from superdone.ai:**

```sql
-- Vector search ranking
ROW_NUMBER() OVER (ORDER BY f.embedding <=> query_embedding) AS vec_rank

-- Full-text search ranking
ROW_NUMBER() OVER (ORDER BY ts_rank_cd(f.content_tsv, fts_query) DESC) AS fts_rank

-- Deduplication
ROW_NUMBER() OVER (
    PARTITION BY user_id, vendor, integration_type
    ORDER BY created_at DESC
) AS rn
```

**Implementation Tasks:**

- [ ] Parse `OVER (ORDER BY ...)` clause
- [ ] Parse `OVER (PARTITION BY ... ORDER BY ...)` clause
- [ ] Type inference: ROW_NUMBER() returns bigint
- [ ] Support for multiple ORDER BY columns
- [ ] Support for ASC/DESC and NULLS FIRST/LAST
- [ ] Integration tests for all patterns

**Files to modify:**

- `src/parser/parse-expression.ts` - add window function parsing
- `src/parser/parse-select.ts` - handle window functions in SELECT
- `test/integration/select/select-window-functions.test.ts`

---

#### 4.2 Other Window Functions - Future

**Usage:** 0 occurrences in superdone.ai

**Functions to implement later:**

- RANK(), DENSE_RANK()
- LAG(), LEAD()
- FIRST_VALUE(), LAST_VALUE()
- SUM() OVER, AVG() OVER, etc.

---

### Phase 5: String & Pattern Matching (HIGH - 6-7 hours)

**Priority:** 🟠 HIGH - Used in search filtering and TypeORM queries

#### 5.1 ILIKE Operator - 2 hours

**Usage:** 6+ occurrences in search filters

**Examples from superdone.ai:**

```sql
-- Case-insensitive pattern matching
WHERE se.metadata->>'user' ILIKE '%' || p_user_filter || '%'
WHERE se.metadata->>'topic_title' ILIKE '%' || p_topic_filter || '%'

-- From TypeScript code
WHERE p ILIKE $${paramIndex}
```

**Implementation Tasks:**

- [ ] Parse ILIKE operator
- [ ] Type checking: both sides must be text
- [ ] Support for pattern wildcards (%, \_)
- [ ] Integration tests

**Files to modify:**

- `src/parser/binary-operator.ts` - add ILIKE operator
- `test/integration/select/select-ilike.test.ts`

---

#### 5.2 String Functions - 1-2 hours

**Usage:** Used in various places

**Functions to implement:**

```sql
LOWER(text) → text  -- 2+ occurrences in TypeORM
UPPER(text) → text  -- 2+ occurrences in TypeORM
TRIM(text) → text
CONCAT(text, ...) → text  -- variadic
format(format_string, ...) → text  -- variadic
to_char(timestamp, format) → text
```

**Examples from superdone.ai:**

```sql
-- TypeORM QueryBuilder
WHERE LOWER(note.title) LIKE $1
WHERE (LOWER(note.title) LIKE $1 OR LOWER(note.note_raw) LIKE $1)
```

**Implementation Tasks:**

- [ ] Add LOWER() function - returns text
- [ ] Add UPPER() function - returns text
- [ ] Add TRIM() function - returns text
- [ ] Add CONCAT() function - variadic, returns text
- [ ] Type inference for each function
- [ ] Integration tests

**Files to modify:**

- `src/parser/parse-expression.ts` - add string functions
- `test/integration/functions/string-functions.test.ts`

---

#### 5.3 IS NULL / IS NOT NULL Operators - 1 hour

**Usage:** 2+ occurrences in TypeORM QueryBuilder - CRITICAL

**Examples from superdone.ai:**

```sql
-- TypeORM QueryBuilder
WHERE meeting.meeting_start IS NOT NULL
WHERE meeting.meeting_end IS NOT NULL
WHERE column IS NULL
```

**Implementation Tasks:**

- [ ] Parse IS NULL operator
- [ ] Parse IS NOT NULL operator
- [ ] Type checking: result is boolean
- [ ] Integration tests

**Files to modify:**

- `src/parser/parse-expression.ts` - add IS NULL/IS NOT NULL
- `test/integration/select/select-is-null.test.ts`

---

#### 5.4 Subqueries in WHERE - 2 hours

**Usage:** 1+ occurrence in TypeORM QueryBuilder - CRITICAL

**Examples from superdone.ai:**

```sql
-- TypeORM QueryBuilder with subquery
WHERE project.id IN (
  SELECT project_user.project_id
  FROM project_user
  WHERE project_user.user_id = $1
)
```

**Implementation Tasks:**

- [ ] Parse subqueries in WHERE clause
- [ ] Support IN (subquery)
- [ ] Support comparison operators with subqueries
- [ ] Type checking for subquery results
- [ ] Integration tests

**Files to modify:**

- `src/parser/parse-expression.ts` - add subquery support
- `src/parser/parse-select.ts` - handle subqueries in expressions
- `test/integration/select/select-subquery-where.test.ts`

---

#### 5.5 LIKE ESCAPE Clause - 30 minutes

**Usage:** 1 occurrence in TypeORM QueryBuilder

**Example from superdone.ai:**

```sql
WHERE pin.topic_path LIKE $1 ESCAPE '\\'
```

**Implementation Tasks:**

- [ ] Parse ESCAPE clause after LIKE
- [ ] Type checking
- [ ] Integration tests

**Files to modify:**

- `src/parser/binary-operator.ts` - add ESCAPE support to LIKE
- `test/integration/select/select-like-escape.test.ts`

---

### Phase 6: Math & Aggregate Functions (MEDIUM - 4-5 hours)

**Priority:** 🟡 MEDIUM - Used in calculations and analytics

#### 6.1 Math Functions - 2-3 hours

**Usage:** Used in search scoring and analytics

**Functions from superdone.ai:**

```sql
GREATEST(value1, value2, ...) → same type  -- 3+ occurrences
LEAST(value1, value2, ...) → same type
EXTRACT(field FROM timestamp) → numeric  -- 4+ occurrences
ABS(numeric) → numeric  -- 1 occurrence
```

**Examples:**

```sql
-- Search scoring
GREATEST(max_results * 5, 100)
GREATEST(1, ($4::int / 2))

-- Time calculations
EXTRACT(EPOCH FROM (now() - date))
EXTRACT(EPOCH FROM (meeting.meeting_end - meeting.meeting_start)) / 3600

-- Absolute value
ABS(EXTRACT(EPOCH FROM (m.meeting_date - gce.start_time))) < 86400
```

**Implementation Tasks:**

- [ ] Add GREATEST() - variadic, returns type of arguments
- [ ] Add LEAST() - variadic, returns type of arguments
- [ ] Add EXTRACT() - returns numeric
- [ ] Add ABS() - returns same numeric type
- [ ] Type checking: all arguments must be comparable
- [ ] Integration tests

**Files to modify:**

- `src/parser/parse-expression.ts` - add math functions
- `test/integration/functions/math-functions.test.ts`

---

#### 6.2 Date/Time Functions - 2 hours

**Usage:** Common in timestamps and analytics

**Functions from superdone.ai:**

```sql
NOW() → timestamp with time zone
CURRENT_TIMESTAMP → timestamp with time zone
DATE_TRUNC(field, timestamp) → timestamp  -- 6+ occurrences
timezone(zone, timestamp) → timestamp with time zone
```

**Examples:**

```sql
-- Weekly aggregation
DATE_TRUNC('week', m.meeting_date)::date::text

-- Grouping by week
GROUP BY DATE_TRUNC('week', t.created_at)
```

**Implementation Tasks:**

- [ ] Add NOW() function
- [ ] Add CURRENT_TIMESTAMP keyword
- [ ] Add DATE_TRUNC() function
- [ ] Add timezone() function
- [ ] Type inference for each function
- [ ] Integration tests

**Files to modify:**

- `src/parser/parse-expression.ts` - add date/time functions
- `test/integration/functions/datetime-functions.test.ts`

---

### Phase 7: JSONB & Array Functions (MEDIUM - 4-5 hours)

**Priority:** 🟡 MEDIUM - Used in task management and analytics

#### 7.1 JSONB Functions - 2-3 hours

**Usage:** 5+ occurrences in TypeScript services

**Functions from superdone.ai:**

```sql
jsonb_array_elements(jsonb) → setof jsonb  -- 5 occurrences
jsonb_array_length(jsonb) → integer  -- 1 occurrence
jsonb_build_object(key, value, ...) → jsonb  -- future
to_jsonb(anyelement) → jsonb  -- future
jsonb_agg(anyelement) → jsonb  -- future
```

**Examples:**

```sql
-- Expand JSONB array to rows
CROSS JOIN LATERAL jsonb_array_elements(t.tasks::jsonb) AS task_item

-- Count JSONB array elements
SELECT MAX(jsonb_array_length(gce.attendees))

-- Subquery with JSONB array
(SELECT COUNT(*) FROM jsonb_array_elements(ce.attendees::jsonb) ae
 WHERE lower(trim(ae->>'email')) IN (SELECT email FROM target_emails))
```

**Implementation Tasks:**

- [ ] Add jsonb_array_elements() - returns set of jsonb
- [ ] Add jsonb_array_length() - returns integer
- [ ] Support CROSS JOIN LATERAL with set-returning functions
- [ ] Type inference for JSONB functions
- [ ] Integration tests

**Files to modify:**

- `src/parser/parse-expression.ts` - add JSONB functions
- `src/parser/parse-from.ts` - handle LATERAL with set-returning functions
- `test/integration/functions/jsonb-functions.test.ts`

---

#### 7.2 Array Functions - 2 hours

**Usage:** 3+ occurrences in TypeScript services

**Functions from superdone.ai:**

```sql
unnest(array) → setof element  -- 3 occurrences
array_agg(anyelement) → array  -- future
array_length(array, dimension) → integer  -- future
```

**Examples:**

```sql
-- Expand array to rows
WITH target_emails AS (
  SELECT unnest($1::text[]) AS email
)

-- Join with array expansion
LEFT JOIN LATERAL unnest(m.participants) p ON true

-- Check array membership
EXISTS (SELECT 1 FROM unnest(m.participants) p WHERE p ILIKE $${paramIndex})
```

**Implementation Tasks:**

- [ ] Add unnest() - returns set of array element type
- [ ] Support LATERAL with unnest()
- [ ] Type inference: unnest(text[]) → text
- [ ] Integration tests

**Files to modify:**

- `src/parser/parse-expression.ts` - add unnest()
- `src/parser/parse-from.ts` - handle LATERAL unnest
- `test/integration/functions/array-functions.test.ts`

---

### Phase 8: Full-Text Search (LOW - 4-6 hours)

**Priority:** 🟢 LOW - Specialized feature, used in 3 files

#### 8.1 Full-Text Search Operators & Functions

**Usage:** 3 occurrences in search functions

**Features to implement:**

```sql
-- Types
tsvector, tsquery

-- Functions
plainto_tsquery(config, query) → tsquery
ts_rank_cd(tsvector, tsquery) → float

-- Operators
tsvector @@ tsquery → boolean
```

**Implementation Tasks:**

- [ ] Add tsvector and tsquery types
- [ ] Add plainto_tsquery() function
- [ ] Add ts_rank_cd() function
- [ ] Add @@ operator
- [ ] Integration tests

**Files to modify:**

- `src/parser/parse-types.ts` - add FTS types
- `src/parser/parse-expression.ts` - add FTS functions
- `src/parser/binary-operator.ts` - add @@ operator
- `test/integration/select/select-full-text-search.test.ts`

---

### Phase 9: Advanced SQL Features (LOW - 8-10 hours)

**Priority:** 🟢 LOW - Nice to have, not blocking

#### 9.1 LATERAL Joins - 3-4 hours

**Usage:** 5+ occurrences in TypeScript services

**Examples from superdone.ai:**

```sql
-- CROSS JOIN LATERAL with set-returning function
CROSS JOIN LATERAL jsonb_array_elements(t.tasks::jsonb) AS task_item

-- LEFT JOIN LATERAL with unnest
LEFT JOIN LATERAL unnest(m.participants) p ON true

-- CROSS JOIN LATERAL with subquery
CROSS JOIN LATERAL (
  SELECT ...
  LIMIT 1
) AS subq
```

**Implementation Tasks:**

- [ ] Parse LATERAL keyword in JOIN clauses
- [ ] Support LATERAL with set-returning functions (unnest, jsonb_array_elements)
- [ ] Support LATERAL with subqueries
- [ ] Type inference for LATERAL joins
- [ ] Integration tests

**Files to modify:**

- `src/parser/parse-from.ts` - add LATERAL support
- `test/integration/select/select-lateral-join.test.ts`

---

#### 9.2 ALL() Operator - 1 hour

**Usage:** 1 occurrence in TypeScript service

**Example from superdone.ai:**

```sql
WHERE m.id != ALL($3::uuid[])
```

**Implementation Tasks:**

- [ ] Parse ALL(array_expression) syntax
- [ ] Type checking: similar to ANY()
- [ ] Support for comparison operators: =, <>, <, >, <=, >=
- [ ] Integration tests

**Files to modify:**

- `src/parser/parse-expression.ts` - add ALL() parsing
- `test/integration/select/select-all-operator.test.ts`

---

#### 9.3 CASE Expressions - 2-3 hours

**Usage:** 1 occurrence

**Example from superdone.ai:**

```sql
CASE share_type::text
    WHEN 'private' THEN 'open'::share_type
    WHEN 'public' THEN 'open'::share_type
    ELSE 'open'::share_type
END
```

**Implementation Tasks:**

- [ ] Parse `CASE WHEN ... THEN ... ELSE ... END`
- [ ] Parse `CASE expr WHEN ... THEN ... ELSE ... END`
- [ ] Type inference: all THEN branches must have compatible types
- [ ] Integration tests

**Files to modify:**

- `src/parser/parse-expression.ts` - add CASE parsing
- `test/integration/select/select-case-expression.test.ts`

---

#### 9.4 INSERT...ON CONFLICT - 2-3 hours

**Usage:** 9 occurrences in 6 TypeScript services - CRITICAL for upsert operations

**Examples from superdone.ai:**

```sql
-- Upsert with DO UPDATE
INSERT INTO search_embeddings
  (project_id, meeting_id, content_type, content_text, ...)
  VALUES ($1, $2, $3, $4, ...)
  ON CONFLICT (meeting_id, content_type, content_hash)
  DO UPDATE SET project_id = EXCLUDED.project_id,
                embedding = EXCLUDED.embedding,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
  RETURNING id

-- Upsert with composite key
ON CONFLICT (jira_issue_id, project_id)
DO UPDATE SET embedding = EXCLUDED.embedding

-- Upsert with single key
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description

-- Upsert with DO NOTHING
ON CONFLICT (agent_config_id) DO UPDATE SET embedding = EXCLUDED.embedding
```

**Implementation Tasks:**

- [ ] Parse `ON CONFLICT (columns) DO UPDATE SET ...`
- [ ] Parse `ON CONFLICT (columns) DO NOTHING`
- [ ] Support EXCLUDED.column references in DO UPDATE
- [ ] Type checking for conflict columns
- [ ] Support RETURNING clause with ON CONFLICT
- [ ] Integration tests

**Files to modify:**

- `src/parser/parse-insert.ts` - add ON CONFLICT parsing
- `test/integration/insert/insert-on-conflict.test.ts`

---

#### 9.5 RETURNING Clause - 1 hour

**Usage:** 4 occurrences in TypeScript services

**Examples from superdone.ai:**

```sql
INSERT INTO search_embeddings (...) VALUES (...) RETURNING id
INSERT INTO topics_processing_embeddings (...) VALUES (...) RETURNING id
```

**Implementation Tasks:**

- [ ] Parse RETURNING clause in INSERT/UPDATE/DELETE
- [ ] Type inference for RETURNING columns
- [ ] Support RETURNING \* and RETURNING column_list
- [ ] Integration tests

**Files to modify:**

- `src/parser/parse-insert.ts` - add RETURNING support
- `src/parser/parse-update.ts` - add RETURNING support
- `src/parser/parse-delete.ts` - add RETURNING support
- `test/integration/insert/insert-returning.test.ts`

---

#### 9.6 DISTINCT ON - 1-2 hours

**Usage:** Not found in current migrations, but common PostgreSQL feature

**Example:**

```sql
SELECT DISTINCT ON (user_id) *
FROM events
ORDER BY user_id, created_at DESC
```

**Implementation Tasks:**

- [ ] Parse `DISTINCT ON (columns)` syntax
- [ ] Type checking: DISTINCT ON columns must be in ORDER BY
- [ ] Integration tests

**Files to modify:**

- `src/parser/parse-select.ts` - add DISTINCT ON parsing
- `test/integration/select/select-distinct-on.test.ts`

---

#### 9.3 INSERT...ON CONFLICT - 2-3 hours

**Usage:** Not found in current migrations, but common PostgreSQL feature

**Example:**

```sql
INSERT INTO users (id, name)
VALUES ('123', 'John')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
```

**Implementation Tasks:**

- [ ] Parse `ON CONFLICT (columns) DO UPDATE SET ...`
- [ ] Parse `ON CONFLICT (columns) DO NOTHING`
- [ ] Type checking for conflict columns
- [ ] Integration tests

**Files to modify:**

- `src/parser/parse-insert.ts` - add ON CONFLICT parsing
- `test/integration/insert/insert-on-conflict.test.ts`

---

## Implementation Order (Recommended)

### Sprint 1: Type System (Week 1) - 8-12 hours

1. ✅ Type Cast Operator (::) - 3-4 hours
2. ✅ Array Type Declarations - 2-3 hours
3. ✅ PostgreSQL Type Aliases - 1-2 hours
4. ✅ Array Literal Syntax - 1 hour

**Deliverable:** All superdone.ai type casts work

---

### Sprint 2: Array Operations (Week 1-2) - 6-8 hours

1. ✅ ANY() Operator - 3-4 hours
2. ✅ Array Operators (<@, =, ||) - 2-3 hours

**Deliverable:** All superdone.ai array queries work

---

### Sprint 3: JOINs & Window Functions (Week 2) - 7-10 hours

1. ✅ FULL OUTER JOIN - 3-4 hours
2. ✅ ROW_NUMBER() OVER - 4-6 hours

**Deliverable:** All superdone.ai search functions work

---

### Sprint 4: INSERT Features (Week 2-3) - 3-4 hours

1. ✅ INSERT...ON CONFLICT - 2-3 hours (CRITICAL - 9 occurrences)
2. ✅ RETURNING Clause - 1 hour (4 occurrences)

**Deliverable:** All superdone.ai upsert operations work

---

### Sprint 5: String & Math Functions (Week 3) - 7-9 hours

1. ✅ ILIKE Operator - 2 hours
2. ✅ String Functions (LOWER, UPPER, TRIM) - 1-2 hours
3. ✅ IS NULL / IS NOT NULL - 1 hour (CRITICAL - TypeORM)
4. ✅ Subqueries in WHERE - 2 hours (CRITICAL - TypeORM)
5. ✅ LIKE ESCAPE - 30 minutes
6. ✅ Math Functions (GREATEST, EXTRACT, ABS) - 2-3 hours
7. ✅ Date/Time Functions (DATE_TRUNC, NOW) - 2 hours

**Deliverable:** All superdone.ai filtering, scoring, and TypeORM queries work

---

### Sprint 6: JSONB & Array Functions (Week 3-4) - 4-5 hours

1. ✅ JSONB Functions (jsonb_array_elements, jsonb_array_length) - 2-3 hours
2. ✅ Array Functions (unnest) - 2 hours

**Deliverable:** All superdone.ai task queries work

---

### Sprint 7: Advanced Features (Week 4) - 12-16 hours

1. ✅ LATERAL Joins - 3-4 hours (5+ occurrences)
2. ✅ ALL() Operator - 1 hour
3. ✅ Full-Text Search - 4-6 hours
4. ✅ CASE Expressions - 2-3 hours
5. ✅ DISTINCT ON - 1-2 hours

**Deliverable:** 100% superdone.ai compatibility

---

## Testing Strategy

### Integration Test Structure

```
test/integration/
├── types/
│   ├── type-cast.test.ts
│   ├── type-aliases.test.ts
│   └── array-types.test.ts
├── select/
│   ├── select-any-operator.test.ts
│   ├── select-array-operators.test.ts
│   ├── select-full-outer-join.test.ts
│   ├── select-window-functions.test.ts
│   ├── select-ilike.test.ts
│   ├── select-full-text-search.test.ts
│   ├── select-case-expression.test.ts
│   └── select-distinct-on.test.ts
├── functions/
│   ├── string-functions.test.ts
│   ├── math-functions.test.ts
│   └── datetime-functions.test.ts
└── insert/
    └── insert-on-conflict.test.ts
```

### Test Coverage Goals

- ✅ Each feature has positive tests (valid SQL compiles)
- ✅ Each feature has negative tests (invalid SQL shows errors)
- ✅ Edge cases covered (NULL handling, type mismatches)
- ✅ Real-world examples from superdone.ai

---

## Success Criteria

### Phase 1-2 Complete (Type System + Arrays)

- [ ] All type casts from superdone.ai compile without errors
- [ ] All array operations from superdone.ai compile without errors
- [ ] 90% of superdone.ai queries can be parsed

### Phase 3-4 Complete (JOINs + Window Functions)

- [ ] All search functions from superdone.ai compile without errors
- [ ] Hybrid search (vector + FTS) works correctly
- [ ] 95% of superdone.ai queries can be parsed

### Phase 5-8 Complete (All Features)

- [ ] 100% of superdone.ai queries compile without errors
- [ ] All integration tests pass
- [ ] Ready for production migration

---

## Risk Assessment

### High Risk

- **Type Cast Operator (::)**: Complex parsing, affects many queries
    - Mitigation: Start with basic types, add complex types incrementally
- **ANY() Operator**: Type checking complexity
    - Mitigation: Start with simple cases, add subquery support later

### Medium Risk

- **Window Functions**: Complex syntax, multiple variants
    - Mitigation: Start with ROW_NUMBER() OVER (ORDER BY), add PARTITION BY later

- **Full-Text Search**: Specialized types and operators
    - Mitigation: Implement as low priority, not blocking for most queries

### Low Risk

- **String Functions**: Straightforward implementation
- **Math Functions**: Simple type inference
- **CASE Expressions**: Well-defined syntax

---

## Dependencies

### External Dependencies

- None - all features are type-level TypeScript

### Internal Dependencies

```
Type System (Phase 1)
    ↓
Array Operations (Phase 2)
    ↓
JOINs (Phase 3) + Window Functions (Phase 4)
    ↓
String/Math Functions (Phase 5-6)
    ↓
Advanced Features (Phase 7-8)
```

---

## Estimated Total Time

| Phase                               | Hours           | Priority                               |
| ----------------------------------- | --------------- | -------------------------------------- |
| Phase 1: Type System                | 8-12            | 🔴 CRITICAL                            |
| Phase 2: Array Operations           | 6-8             | 🔴 CRITICAL                            |
| Phase 3: JOIN Extensions            | 3-4             | 🟠 HIGH                                |
| Phase 4: Window Functions           | 4-6             | 🟠 HIGH                                |
| Phase 5: String & Pattern Matching  | 6-7             | 🟠 HIGH (TypeORM critical)             |
| Phase 6: Math & Aggregate Functions | 4-5             | 🟡 MEDIUM                              |
| Phase 7: JSONB & Array Functions    | 4-5             | 🟡 MEDIUM                              |
| Phase 8: Full-Text Search           | 4-6             | 🟢 LOW                                 |
| Phase 9: Advanced SQL Features      | 8-10            | 🟢 LOW (except ON CONFLICT - CRITICAL) |
| **TOTAL**                           | **47-63 hours** |                                        |

**Critical Path (Phases 1-5 + ON CONFLICT):** 30-40 hours  
**Full Implementation:** 47-63 hours

**Note:**

- INSERT...ON CONFLICT (9 occurrences) and RETURNING (4 occurrences) are CRITICAL despite being in Phase 9
- IS NULL/IS NOT NULL, LOWER/UPPER, and subqueries in WHERE are CRITICAL for TypeORM compatibility (Phase 5)

---

## Next Steps

1. ✅ Review this plan with stakeholders
2. ✅ Prioritize phases based on business needs
3. ✅ Start with Phase 1 (Type System) - highest impact
4. ✅ Implement incrementally, test thoroughly
5. ✅ Update plan as new requirements emerge

---

## Appendix: SQL Feature Reference

### PostgreSQL Type System

- [Type Casts](https://www.postgresql.org/docs/current/sql-expressions.html#SQL-SYNTAX-TYPE-CASTS)
- [Array Types](https://www.postgresql.org/docs/current/arrays.html)
- [Type Aliases](https://www.postgresql.org/docs/current/datatype.html)

### Array Operations

- [ANY/ALL/SOME](https://www.postgresql.org/docs/current/functions-comparisons.html#FUNCTIONS-COMPARISONS-ANY-SOME)
- [Array Operators](https://www.postgresql.org/docs/current/functions-array.html)

### Window Functions

- [Window Functions](https://www.postgresql.org/docs/current/tutorial-window.html)
- [ROW_NUMBER](https://www.postgresql.org/docs/current/functions-window.html)

### Full-Text Search

- [Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Text Search Functions](https://www.postgresql.org/docs/current/functions-textsearch.html)
