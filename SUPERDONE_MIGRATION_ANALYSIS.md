# Superdone.ai Migration to dbtyper - Analysis & Implementation Plan

**Date:** 2026-05-05  
**Project:** dbtyper (jsql-2)  
**Goal:** Implement all SQL features required for superdone.ai to migrate to dbtyper

---

## Executive Summary

Analyzed 50+ SQL migration files and seed data from `~/work/superdone.ai/repos/api/supabase/migrations/` to identify PostgreSQL features used in production. This document provides a comprehensive implementation plan organized by priority and dependencies.

---

## Analysis Methodology

1. **File Coverage**: Scanned all `.sql` files in migrations and seeds directories
2. **Pattern Matching**: Searched for specific SQL patterns (ANY, FULL OUTER JOIN, ::, arrays, window functions, etc.)
3. **Real Usage**: Focused on actual production code, not theoretical features
4. **Frequency Analysis**: Prioritized features by usage frequency

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

| Feature | Occurrences | Files | Example Usage |
|---------|-------------|-------|---------------|
| Type casts (::) | 49 | 15+ | `'value'::uuid`, `column::text`, `'[]'::jsonb` |
| Array types | 49 | 12+ | `uuid[]`, `text[]`, `ARRAY[1,2,3]` |
| ANY() operator | 8 | 5 | `WHERE id = ANY(p_project_ids)` |
| FULL OUTER JOIN | 3 | 3 | Hybrid search (vector + FTS) |
| ROW_NUMBER() OVER | 11 | 4 | Ranking in search results |
| JSONB operations | 20+ | 10+ | `metadata @>`, `->`, `->>`, `DEFAULT '{}'::jsonb` |

### Medium-Frequency Features (High Priority)

| Feature | Occurrences | Files | Example Usage |
|---------|-------------|-------|---------------|
| ILIKE operator | 6 | 3 | `metadata->>'user' ILIKE '%' \|\| filter \|\| '%'` |
| EXTRACT() function | 2 | 2 | `EXTRACT(EPOCH FROM (now() - date))` |
| GREATEST() function | 2 | 2 | `GREATEST(max_results * 5, 100)` |
| ts_rank_cd() | 3 | 3 | Full-text search ranking |
| plainto_tsquery() | 3 | 3 | Full-text search query parsing |
| @@ operator | 3 | 3 | Full-text search matching |

### Low-Frequency Features (Medium Priority)

| Feature | Occurrences | Files | Example Usage |
|---------|-------------|-------|---------------|
| CASE expressions | 1 | 1 | `CASE share_type::text WHEN 'private' THEN 'open'::share_type` |
| RIGHT JOIN | 0 | 0 | Not used in superdone.ai |
| Window functions (LAG, LEAD, RANK) | 0 | 0 | Not used yet |

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
- `src/parser/sql-tokens.ts` - add :: token
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

### Phase 5: String & Pattern Matching (MEDIUM - 3-4 hours)

**Priority:** 🟡 MEDIUM - Used in search filtering

#### 5.1 ILIKE Operator - 2 hours
**Usage:** 6 occurrences in search filters

**Examples from superdone.ai:**
```sql
-- Case-insensitive pattern matching
WHERE se.metadata->>'user' ILIKE '%' || p_user_filter || '%'
WHERE se.metadata->>'topic_title' ILIKE '%' || p_topic_filter || '%'
```

**Implementation Tasks:**
- [ ] Parse ILIKE operator
- [ ] Type checking: both sides must be text
- [ ] Support for pattern wildcards (%, _)
- [ ] Integration tests

**Files to modify:**
- `src/parser/binary-operator.ts` - add ILIKE operator
- `test/integration/select/select-ilike.test.ts`

---

#### 5.2 String Functions - 1-2 hours
**Usage:** Used in various places

**Functions to implement:**
```sql
LOWER(text) → text
UPPER(text) → text
TRIM(text) → text
CONCAT(text, ...) → text  -- variadic
format(format_string, ...) → text  -- variadic
to_char(timestamp, format) → text
```

**Implementation Tasks:**
- [ ] Add string function parsing
- [ ] Type inference for each function
- [ ] Integration tests

**Files to modify:**
- `src/parser/parse-expression.ts` - add string functions
- `test/integration/functions/string-functions.test.ts`

---

### Phase 6: Math & Aggregate Functions (MEDIUM - 3-4 hours)

**Priority:** 🟡 MEDIUM - Used in calculations

#### 6.1 Math Functions - 2 hours
**Usage:** Used in search scoring

**Functions from superdone.ai:**
```sql
GREATEST(value1, value2, ...) → same type  -- 2 occurrences
LEAST(value1, value2, ...) → same type
EXTRACT(field FROM timestamp) → numeric  -- 2 occurrences
```

**Implementation Tasks:**
- [ ] Add GREATEST() - variadic, returns type of arguments
- [ ] Add LEAST() - variadic, returns type of arguments
- [ ] Add EXTRACT() - returns numeric
- [ ] Type checking: all arguments must be comparable
- [ ] Integration tests

**Files to modify:**
- `src/parser/parse-expression.ts` - add math functions
- `test/integration/functions/math-functions.test.ts`

---

#### 6.2 Date/Time Functions - 1-2 hours
**Usage:** Common in timestamps

**Functions to implement:**
```sql
NOW() → timestamp with time zone
CURRENT_TIMESTAMP → timestamp with time zone
date_trunc(field, timestamp) → timestamp
timezone(zone, timestamp) → timestamp with time zone
```

**Implementation Tasks:**
- [ ] Add date/time function parsing
- [ ] Type inference for each function
- [ ] Integration tests

**Files to modify:**
- `src/parser/parse-expression.ts` - add date/time functions
- `test/integration/functions/datetime-functions.test.ts`

---

### Phase 7: Full-Text Search (LOW - 4-6 hours)

**Priority:** 🟢 LOW - Specialized feature, used in 3 files

#### 7.1 Full-Text Search Operators & Functions
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

### Phase 8: Advanced Features (LOW - 6-8 hours)

**Priority:** 🟢 LOW - Nice to have, not blocking

#### 8.1 CASE Expressions - 2-3 hours
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

#### 8.2 DISTINCT ON - 1-2 hours
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

#### 8.3 INSERT...ON CONFLICT - 2-3 hours
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

### Sprint 4: String & Math Functions (Week 3) - 6-8 hours
1. ✅ ILIKE Operator - 2 hours
2. ✅ String Functions - 1-2 hours
3. ✅ Math Functions (GREATEST, EXTRACT) - 2 hours
4. ✅ Date/Time Functions - 1-2 hours

**Deliverable:** All superdone.ai filtering and scoring works

---

### Sprint 5: Advanced Features (Week 3-4) - 10-14 hours
1. ✅ Full-Text Search - 4-6 hours
2. ✅ CASE Expressions - 2-3 hours
3. ✅ DISTINCT ON - 1-2 hours
4. ✅ INSERT...ON CONFLICT - 2-3 hours

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

| Phase | Hours | Priority |
|-------|-------|----------|
| Phase 1: Type System | 8-12 | 🔴 CRITICAL |
| Phase 2: Array Operations | 6-8 | 🔴 CRITICAL |
| Phase 3: JOIN Extensions | 3-4 | 🟠 HIGH |
| Phase 4: Window Functions | 4-6 | 🟠 HIGH |
| Phase 5: String & Pattern Matching | 3-4 | 🟡 MEDIUM |
| Phase 6: Math & Aggregate Functions | 3-4 | 🟡 MEDIUM |
| Phase 7: Full-Text Search | 4-6 | 🟢 LOW |
| Phase 8: Advanced Features | 6-8 | 🟢 LOW |
| **TOTAL** | **37-52 hours** | |

**Critical Path (Phases 1-4):** 21-30 hours  
**Full Implementation:** 37-52 hours

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
