# Superdone.ai Migration to dbtyper - Feature Analysis

## Overview

Analysis of SQL features used in superdone.ai/repos/api to determine what needs to be implemented in dbtyper for successful migration.

## Current Status

Analyzed migrations and SQL queries in:

- `/home/vadzim/work/superdone.ai/repos/api/supabase/migrations/*.sql`
- `/home/vadzim/work/superdone.ai/repos/api/src/**/*.ts`

## Required Features

### 1. [x] CTE (Common Table Expressions) - Column Validation ✅

**Priority:** HIGH  
**Status:** ✅ **COMPLETED** (2026-05-04)

**Implemented:**

- ✅ WITH clause parsing works
- ✅ Multiple CTEs supported (WITH a AS (...), b AS (...))
- ✅ Column validation works correctly
- ✅ Type validation in JOIN ON with CTE columns works
- ✅ Integration tests passing

**Fix details:**
- Added CTE scope check in `ParseFromTableAfterLeadingIdent`
- Created `ParseAliasAfterCTE` to handle CTE references
- All CTE tests enabled and passing

**Example from superdone.ai:**

```sql
WITH filtered AS (
    SELECT se.* FROM search_embeddings se
    WHERE se.project_id = ANY(p_project_ids)
),
vector_ranked AS (
    SELECT f.id, 1 - (f.embedding <=> query_embedding) AS vec_similarity
    FROM filtered f
),
combined AS (
    SELECT COALESCE(vr.id, fr.id) AS id
    FROM vector_ranked vr
    FULL OUTER JOIN fts_ranked fr ON vr.id = fr.id
)
SELECT * FROM combined;
```

**Needs:**

- Fix column validation in CTE SELECT lists
- Fix type checking in JOIN ON with CTE columns
- Support for SELECT \* from CTE (currently works)
- Support for qualified column refs (cte_name.column)

---

### 2. [ ] FULL OUTER JOIN

**Priority:** HIGH  
**Status:** ❌ Not implemented

**Example from superdone.ai:**

```sql
FROM vector_ranked vr
FULL OUTER JOIN fts_ranked fr ON vr.id = fr.id
```

**Needs:**

- Parse FULL OUTER JOIN syntax
- Type checking for JOIN ON conditions
- Handle nullable columns from both sides

---

### 3. [x] COALESCE Function ✅

**Priority:** HIGH  
**Status:** ✅ **ALREADY IMPLEMENTED**

**Implemented:**

- ✅ Parse COALESCE(expr1, expr2, ...) syntax
- ✅ Type inference: return type is first non-null argument type
- ✅ Support multiple arguments
- ✅ Working correctly in queries

**Example from superdone.ai:**

```sql
SELECT COALESCE(vr.id, fr.id) AS id,
       COALESCE(vr.vec_similarity, 0) AS vec_similarity
```

**Needs:**

- Parse COALESCE(expr1, expr2, ...) syntax
- Type inference: return type is first non-null argument type
- Support multiple arguments

---

### 4. [ ] ROW_NUMBER() OVER (ORDER BY ...)

**Priority:** MEDIUM  
**Status:** ❌ Not implemented

**Example from superdone.ai:**

```sql
ROW_NUMBER() OVER (ORDER BY f.embedding <=> query_embedding) AS vec_rank
```

**Needs:**

- Parse window function syntax
- Parse OVER clause with ORDER BY
- Type inference: ROW_NUMBER() returns integer/bigint

---

### 5. [ ] Custom Operators (<=>)

**Priority:** MEDIUM  
**Status:** ❌ Not implemented

**Example from superdone.ai:**

```sql
1 - (f.embedding <=> query_embedding) AS vec_similarity
```

**Needs:**

- Parse custom operators (PostgreSQL allows custom operators)
- Type checking for custom operators
- Support for vector distance operators (<->, <=>, <#>)

---

### 6. [ ] JSONB Operators (->>, ->)

**Priority:** HIGH  
**Status:** ❌ Not implemented

**Example from superdone.ai:**

```sql
WHERE se.metadata->>'user' ILIKE '%' || p_user_filter || '%'
```

**Needs:**

- Parse ->> operator (JSONB field as text)
- Parse -> operator (JSONB field as JSONB)
- Type inference: ->> returns text, -> returns jsonb

---

### 7. [ ] ILIKE Operator

**Priority:** MEDIUM  
**Status:** ❌ Not implemented

**Example from superdone.ai:**

```sql
WHERE se.metadata->>'user' ILIKE '%' || p_user_filter || '%'
```

**Needs:**

- Parse ILIKE operator (case-insensitive LIKE)
- Type checking: both sides must be text

---

### 8. [ ] String Concatenation (||)

**Priority:** MEDIUM  
**Status:** ❌ Not implemented

**Example from superdone.ai:**

```sql
'%' || p_user_filter || '%'
```

**Needs:**

- Parse || operator for string concatenation
- Type inference: returns text when both sides are text

---

### 9. [ ] ANY() Array Operator

**Priority:** HIGH  
**Status:** ❌ Not implemented

**Example from superdone.ai:**

```sql
WHERE se.project_id = ANY(p_project_ids)
```

**Needs:**

- Parse ANY(array_expression) syntax
- Type checking: element type must match comparison type

---

### 10. [ ] Array Literals and Types

**Priority:** MEDIUM  
**Status:** ❌ Not implemented

**Example from superdone.ai:**

```sql
parts JSONB NOT NULL DEFAULT '[]'::jsonb
```

**Needs:**

- Parse array literal syntax
- Parse type casts (::type)
- Support for array types (text[], uuid[], etc.)

---

### 11. [ ] TIMESTAMPTZ Type

**Priority:** LOW  
**Status:** ❌ Not implemented

**Example from superdone.ai:**

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**Needs:**

- Add TIMESTAMPTZ to type map
- Treat as datetime comparison class

---

### 12. [ ] Function Calls in Expressions

**Priority:** HIGH  
**Status:** ⚠️ Partially implemented

**Example from superdone.ai:**

```sql
DEFAULT NOW()
DEFAULT gen_random_uuid()
ts_rank_cd(f.content_tsv, fts_query)
```

**Needs:**

- Parse function calls with arguments
- Type inference for common functions (NOW, gen_random_uuid, etc.)
- Support for user-defined functions

---

### 13. [ ] REFERENCES with ON DELETE CASCADE

**Priority:** LOW  
**Status:** ❌ Not implemented (DDL only, not needed for queries)

**Example from superdone.ai:**

```sql
workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
```

**Needs:**

- Parse REFERENCES clause in CREATE TABLE
- Parse ON DELETE CASCADE/SET NULL/etc.
- Track foreign key constraints

---

### 14. [ ] CREATE INDEX

**Priority:** LOW  
**Status:** ❌ Not implemented (DDL only, not needed for queries)

**Example from superdone.ai:**

```sql
CREATE INDEX idx_chats_workspace_id ON chats(workspace_id);
```

**Needs:**

- Parse CREATE INDEX statement
- Track indexes for query optimization hints (optional)

---

### 15. [ ] CREATE TRIGGER

**Priority:** LOW  
**Status:** ❌ Not implemented (DDL only, not needed for queries)

**Example from superdone.ai:**

```sql
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Needs:**

- Parse CREATE TRIGGER statement
- Not critical for type checking

---

## Priority Summary

### ✅ Completed

1. ✅ CTE column validation fix (2026-05-04)
2. ✅ COALESCE function (already implemented)

### Critical (Must Have)

3. FULL OUTER JOIN
4. JSONB operators (->>, ->)
5. ANY() array operator
6. Function calls in expressions

### Important (Should Have)

7. ROW_NUMBER() window function
8. Custom operators (<=>)
9. ILIKE operator
10. String concatenation (||)
11. Array literals and types

### Nice to Have

12. TIMESTAMPTZ type
13. REFERENCES with ON DELETE (DDL)
14. CREATE INDEX (DDL)
15. CREATE TRIGGER (DDL)

---

## Implementation Order

### Phase 1: Fix CTE ✅ COMPLETED (2026-05-04)

- [x] Fix CTE column validation
- [x] Add integration tests for CTE with invalid columns
- [x] Add integration tests for CTE in JOIN

### Phase 2: Core Functions (Current Priority)

- [x] COALESCE function ✅ Already implemented
- [ ] Function call type inference
- [ ] JSONB operators (->>, ->)
- [ ] ANY() array operator

### Phase 3: JOIN Extensions

- [ ] FULL OUTER JOIN
- [x] Fix CTE type checking in JOIN ON ✅ Completed

### Phase 4: Operators (Week 4)

- [ ] ILIKE operator
- [ ] String concatenation (||)
- [ ] Custom operators (<=>)

### Phase 5: Window Functions (Week 5)

- [ ] ROW_NUMBER() OVER (ORDER BY ...)
- [ ] Other window functions (RANK, DENSE_RANK, etc.)

### Phase 6: Arrays and Types (Week 6)

- [ ] Array literals
- [ ] Array types (text[], uuid[], etc.)
- [ ] Type casts (::type)
- [ ] TIMESTAMPTZ type

---

## Testing Strategy

For each feature:

1. Add unit tests in `test/` directory
2. Add integration tests in `test/integration/` directory
3. Test with real superdone.ai queries
4. Ensure `npm test` passes before commit

---

## Notes

- Focus on query type checking, not DDL features
- DDL features (REFERENCES, INDEX, TRIGGER) are low priority
- CTE fix is critical - blocks many superdone.ai queries
- JSONB operators are essential for metadata queries
