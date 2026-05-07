# TODO

## Array Type Issues (after TS types refactoring)

### 1. Empty array error type
**File:** `test/arrays-operators.test.ts:50`
**Issue:** Empty `array[]` constructor error type doesn't match expected `"__sql_parser_error__"`
**Status:** Test commented out
**Fix after:** Refactoring TS types out of parsers

### 2. Nullable array type matching
**File:** `test/integration/ddl/create-table-nullable-array.success.test.ts:16`
**Issue:** Nullable array type `readonly string[] | null` doesn't match in `Matches<>` helper
**Status:** Test commented out
**Fix after:** Refactoring TS types out of parsers

## Next Steps

1. Remove TypeScript types from parsers (use `ExprOk<unknown, "sql_type">` instead of `ExprOk<ts_type, "sql_type">`)
2. Ensure all SQL → TS conversion happens only in `sql-to-ts-conversion.ts`
3. Re-enable and fix the 2 commented array tests above
4. Зрабіць SQL тыпы у выглядзе канструктара
