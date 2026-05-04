# Next Steps - JSONB Operators and More

## Current Status (2026-05-04 22:30 UTC / 00:30 Europe/Warsaw)

### Completed Today
- ✅ CTE column validation fixed
- ✅ 2 CTE integration tests enabled
- ✅ All 194 tests passing (112 unit + 82 integration)
- ✅ COALESCE already working
- ✅ Updated SUPERDONE_MIGRATION_PLAN

### Time Spent
- 2 hours 11 minutes of focused work
- 8 commits pushed

## Next Priority Features (Phase 2)

### 1. JSONB Operators (->>, ->) - HIGH PRIORITY

**Status:** Not implemented  
**Complexity:** Medium  
**Estimated time:** 2-3 hours

**Implementation plan:**
1. Add JSONB operators to lexer (sql-tokens.ts)
   - Add `->` token
   - Add `->>` token
2. Add to BinaryOperator type (expressions.ts)
   - `->` returns jsonb
   - `->>` returns text
3. Add parsing logic in parse-expression.ts
4. Add type inference rules
5. Add unit tests
6. Add integration tests

**Example queries to support:**
```sql
SELECT metadata->>'user' FROM search_embeddings;
SELECT data->'field' FROM table;
SELECT metadata->>'key' = 'value' FROM table;
```

### 2. ANY() Array Operator - HIGH PRIORITY

**Status:** Not implemented  
**Complexity:** Medium  
**Estimated time:** 2-3 hours

**Implementation plan:**
1. Add ANY keyword to lexer
2. Parse ANY(array_expression) syntax
3. Type checking: element type must match comparison type
4. Add unit tests
5. Add integration tests

**Example queries to support:**
```sql
WHERE id = ANY(p_project_ids)
WHERE status = ANY(ARRAY['active', 'pending'])
```

### 3. String Concatenation (||) - MEDIUM PRIORITY

**Status:** Not implemented  
**Complexity:** Low  
**Estimated time:** 1-2 hours

**Implementation plan:**
1. Add `||` operator to BinaryOperator
2. Type inference: text || text = text
3. Add unit tests
4. Add integration tests

**Example queries to support:**
```sql
SELECT '%' || p_user_filter || '%' FROM table;
SELECT first_name || ' ' || last_name AS full_name FROM users;
```

### 4. FULL OUTER JOIN - HIGH PRIORITY

**Status:** Not implemented  
**Complexity:** Medium  
**Estimated time:** 2-3 hours

**Implementation plan:**
1. Add FULL OUTER JOIN parsing (currently only LEFT/RIGHT/INNER)
2. Handle nullable columns from both sides
3. Type checking for JOIN ON conditions
4. Add unit tests
5. Add integration tests

**Example queries to support:**
```sql
FROM vector_ranked vr
FULL OUTER JOIN fts_ranked fr ON vr.id = fr.id
```

## Recommended Order

1. **String concatenation (||)** - easiest, quick win (1-2 hours)
2. **JSONB operators (->>, ->)** - critical for superdone.ai (2-3 hours)
3. **ANY() operator** - critical for superdone.ai (2-3 hours)
4. **FULL OUTER JOIN** - needed for complex queries (2-3 hours)

Total estimated time: 8-11 hours

## Notes

- All features are critical for superdone.ai migration
- Start with string concatenation for quick progress
- JSONB and ANY() are most commonly used in superdone.ai
- FULL OUTER JOIN is less common but still needed

## Testing Strategy

For each feature:
1. Add unit tests in `test/parse-expression.test.ts` or similar
2. Add integration tests in `test/integration/select/`
3. Test with real superdone.ai queries
4. Ensure `npm test` passes before commit
5. Format with `npm run format`
6. Push after each feature completion

---

**Ready to continue:** Yes, all tests passing, clean working tree
**Next task:** Implement string concatenation (||) operator
