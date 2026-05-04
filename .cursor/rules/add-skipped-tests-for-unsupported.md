# Add Skipped Tests for Unsupported Features

When you discover that a feature is not yet supported during development or testing:

1. **Immediately create a skipped integration test** for that feature
2. Name the test file with `.test.skip.ts` extension
3. Add a clear comment explaining what's not supported and why
4. Include the test in the appropriate directory structure

## Example

If you discover that `UPDATE ... FROM` is not supported:

```typescript
// Integration Test: UPDATE with FROM clause (PostgreSQL extension)
// Currently unsupported - requires implementing FROM clause in UPDATE parser

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}

async function testUpdateWithFrom() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table profiles (user_id text, bio text);`)
		.database()

	// ✅ SUCCESS: UPDATE with FROM clause
	const result = await db.query(`
		update users 
		set name = profiles.bio 
		from profiles 
		where users.id = profiles.user_id;
	`)

	return result
}

testUpdateWithFrom()
```

## Benefits

- Documents what features are planned but not yet implemented
- Provides test cases ready to enable when the feature is implemented
- Helps track progress on feature implementation
- Prevents forgetting about edge cases discovered during development

## When to Create Skipped Tests

- When you encounter a parser error for a valid SQL feature
- When you realize a feature would require significant architectural changes
- When you discover a SQL dialect-specific feature that's not yet supported
- When you find a limitation in the current implementation
