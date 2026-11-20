import { describe, it } from "node:test"
import assert from "node:assert"
import { errorCodesDocIsCurrent } from "../../scripts/gen-error-codes.ts"

// docs/ERROR_CODES.md is generated from the registry src/dbtyper-error.ts (EREG-1) and ships in the package:
// it must not drift. Fix a failure with `npm run gen-error-codes`.
describe("Error code reference", () => {
	it("docs/ERROR_CODES.md is generated from the registry", async () => {
		assert.ok(await errorCodesDocIsCurrent(), "docs/ERROR_CODES.md is out of date: run `npm run gen-error-codes`")
	})
})
