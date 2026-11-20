import tseslint from "@typescript-eslint/eslint-plugin"
import tsparser from "@typescript-eslint/parser"

export default [
	{
		files: ["src/**/*.ts", "test/**/*.ts"],
		languageOptions: {
			parser: tsparser,
			// No `project`: the only rule below is syntactic (scope analysis), it needs no type information, and
			// type-aware parsing would build the whole TypeScript program (very slow on the type-level code).
			// Add `project` back when a rule that needs types is enabled.
			parserOptions: {
				ecmaVersion: 2022,
				sourceType: "module",
			},
		},
		plugins: {
			"@typescript-eslint": tseslint,
		},
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
		},
	},
	{
		ignores: ["dist/", "node_modules/", "**/*.js"],
	},
]
