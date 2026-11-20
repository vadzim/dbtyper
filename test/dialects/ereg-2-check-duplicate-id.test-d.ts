// Integration Test: EREG-2 Check: a registry entry with an id already in use fails to compile
// The registry is an object literal (src/dbtyper-error.ts); a second entry under the same key is a TypeScript error.
const _registry = {
	SOME_ERROR: { code: 1, msg: ["a"] },
	// @ts-expect-error EREG-2: duplicate id
	SOME_ERROR: { code: 2, msg: ["b"] },
}
