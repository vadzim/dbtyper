# Feature: Migrate SqlParserError to FormatError with Rich Error Messages

## Goal
Replace all `SqlParserError<"generic message">` usages with `FormatError<"ERROR_ID", [params]>` to provide rich, informative error messages that include actual names (tables, columns, schemas) instead of generic messages.

## Progress: 30.3% Complete (137/452 usages migrated)

### ✅ Completed Files (16/24)
1. ✓ parse-create-schema.ts - Schema creation errors
2. ✓ parse-drop-schema.ts - Schema drop errors  
3. ✓ parse-create-view.ts - View creation with schema names
4. ✓ parse-create-table.ts - Table creation with schema names
5. ✓ parse-create-type.ts - Type creation with schema names
6. ✓ parse-drop-table.ts - Table drop errors
7. ✓ parse-drop-type.ts - Type drop errors
8. ✓ parse-alter-type.ts - Type alteration errors
9. ✓ skip-statement.ts - Statement skipping errors
10. ✓ parse-qualified-name.ts - Qualified name parsing
11. ✓ parse-default-value.ts - Default value validation
12. ✓ parse-delete.ts - DELETE with table/schema names (15 usages)
13. ✓ parser-validate-mutation-value.ts - Column validation (3 usages)
14. ✓ parse-where-expression.ts - WHERE clause with type info (2 usages)
15. ✓ resolve-column-ref.ts - Column resolution (7 usages)
16. ✓ sql-tokens.ts - Lexer errors (17 usages)

### 🔄 Remaining Files (8 files, 315 usages)
- sql-query.ts: 1 usage
- parse-update.ts: 22 usages
- parse-alter-table.ts: 29 usages
- parse-insert.ts: 43 usages
- parse-select.ts: 59 usages
- parse-expression.ts: 162 usages (largest file)

### Infrastructure Updates ✅
- ✓ sql-database.ts - CheckSqlValidForQuery/Stream handle DbtyperError
- ✓ sql-query.ts - SqlSelectRowForDb propagates DbtyperError
- ✓ parse-sql-statement.ts - ApplyStatements handles DbtyperError
- ✓ All type checking infrastructure supports both error formats

## Example Improvements

### Before → After
- "Unknown table in DELETE FROM" → "Unknown table users in DELETE FROM"
- "Unknown column" → "Unknown column email"
- "Unknown schema or table" → "Unknown schema myschema or table users"
- "NULL not allowed for NOT NULL column" → "NULL not allowed for NOT NULL column id"
- "Expression must be boolean" → "Expression must be boolean, but has a type text"

## Next Steps
1. Migrate sql-query.ts (1 usage) - trivial
2. Migrate parse-update.ts (22 usages) - similar to parse-delete.ts
3. Migrate parse-alter-table.ts (29 usages)
4. Migrate parse-insert.ts (43 usages) - needs careful error propagation
5. Migrate parse-select.ts (59 usages)
6. Migrate parse-expression.ts (162 usages) - largest, most complex
7. Remove SqlParserError type definition
8. Update all remaining tests

## Quality Checklist
- ✅ All migrated files pass typecheck
- ✅ Main codebase compiles successfully
- ✅ DELETE tests fully passing with informative errors
- ✅ Infrastructure handles both error types during transition
- ✅ No breaking changes to existing functionality
- ⏳ INSERT/UPDATE tests need migration (blocked on parse-insert/update)
- ⏳ Expression tests need migration (blocked on parse-expression)

## Session Notes
- Session 1: Migrated 16 files, 137 usages (30.3%)
- Estimated 2-3 more sessions needed for completion
- All commits have clear, descriptive messages
- Branch: feature/migrate-to-format-error
