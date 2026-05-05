# Enum Types Design Document

## Overview

PostgreSQL enum types allow defining custom enumerated types with a fixed set of values:

```sql
CREATE TYPE mood AS ENUM ('sad', 'ok', 'happy');
CREATE TABLE person (
    name text,
    current_mood mood
);
```

## Design Goals

1. **Type Safety**: Enum values should be validated at compile time
2. **Schema Integration**: Enum types should be stored in the database shape
3. **Column Support**: Columns should be able to reference enum types
4. **Value Validation**: INSERT/UPDATE operations should validate enum values

## Implementation Approach

### 1. Database Shape Extension

Extend `JsqlDatabaseShape` to include a `__types__` property for each schema:

```typescript
type DbWithEnums = {
	public: {
		__types__: {
			mood: {
				kind: "enum"
				values: readonly ["sad", "ok", "happy"]
			}
		}
		person: {
			columns: {
				name: { type: "text"; nullable: false }
				current_mood: { type: "mood"; nullable: false }
			}
			primaryKey: readonly ["name"]
		}
	}
}
```

### 2. CREATE TYPE Parser

```typescript
export type ParseCreateType<
  Tokens extends TokensList,
  Db extends JsqlDatabaseShape,
> = ParseTypeIdentifier<Tokens> extends [infer R1 extends TokensList, infer TypeName]
  ? TypeName extends readonly [infer Schema extends string, infer Name extends string]
    ? ParseEnumDefinition<R1, Db, Schema, Name>
    : TypeName extends readonly [infer Name extends string]
      ? ParseEnumDefinition<R1, Db, "public", Name>
      : [R1, Db, SqlParserError<"Invalid type name">]
  : never

type ParseEnumDefinition<
  Tokens extends TokensList,
  Db extends JsqlDatabaseShape,
  Schema extends string,
  TypeName extends string,
> =
  // Parse: AS ENUM ('value1', 'value2', ...)
  // Return: [rest, updatedDb, { kind: "create_type", schema, name, type: "enum", values }]
```

### 3. Type Resolution

When resolving column types, check if the type is an enum:

```typescript
type ResolveColumnType<TypeName, Db, Schema> =
  TypeName extends keyof Db[Schema]["__types__"]
    ? Db[Schema]["__types__"][TypeName] extends { kind: "enum"; values: infer V }
      ? V[number]  // Union of enum values
      : never
    : // ... check built-in types
```

### 4. Value Validation

For INSERT/UPDATE operations, validate that values match enum values:

```typescript
type ValidateEnumValue<Value, EnumType> = EnumType extends { kind: "enum"; values: infer Values }
	? Value extends Values[number]
		? true
		: SqlParserError<`Invalid enum value: ${Value}`>
	: true
```

## Monad Checker Constraint

### The Issue

The current implementation encounters a monad checker constraint when integrating `ParseCreateType` into the main statement parser. The monad checker enforces strict rules about how parser functions can be called:

1. Producer calls must be in "immediate terminal return position", OR
2. As the immediate left side of a conditional extends with a tuple pattern

The current `ParseCreate` function in `parse-sql-statement.ts` has a deeply nested conditional structure:

```typescript
type ParseCreate<...> =
  PeekToken<Tokens> extends TokenKey<"table">
    ? ParseCreateTable<SkipToken<Tokens>, Db>
    : PeekToken<Tokens> extends TokenKey<"type">
      ? SkipToken<Tokens> extends infer R1 extends TokensList
        ? ParseCreateType<R1, Db>  // ← Monad checker rejects this
        : never
      : ...
```

The monad checker complains that `R1` (a monad variable) cannot be passed to `ParseCreateType` because it's not recognized as having a monad-bound first parameter.

### Why This Happens

When adding `ParseCreateType` to the imports and calling it from `ParseCreate`, the monad checker re-analyzes the entire file and finds that the existing pattern `ParseAlterTable<SkipToken<Tokens>, Db>` also violates the monad rules. This pattern was working before because the monad checker wasn't triggered.

### Possible Solutions

1. **Refactor the entire statement parser** to use a flatter structure:

    ```typescript
    export type ParseSqlStatement<...> =
      SkipToken<Tokens> extends infer R1 extends TokensList
        ? PeekToken<Tokens> extends TokenKey<"alter">
          ? ParseAlterTable<R1, Db> extends [infer R2, infer Db2, infer Result]
            ? [R2, Db2, Result]
            : never
          : // ... other cases
        : never
    ```

    This would require refactoring all statement parsers to follow the tuple pattern.

2. **Use a wrapper type** that the monad checker recognizes:

    ```typescript
    type MonadBoundProducer<T extends TokensList, ...> = ...
    ```

    But this approach also triggers monad checker violations.

3. **Skip CREATE TYPE statements** (current approach):
    ```typescript
    PeekToken<Tokens> extends TokenKey<"type">
      ? ParseSkipStatement<Tokens, Db>
      : ...
    ```
    This allows the parser to skip over CREATE TYPE statements without processing them.

## Current Status

Due to the monad checker constraint, CREATE TYPE statements are currently **skipped** (not parsed). The parser will successfully skip over them without errors, but:

- Enum types are not stored in the database shape
- Columns cannot reference enum types
- No compile-time validation of enum values

## Future Work

To fully implement enum types, one of the following is needed:

1. **Parser Refactoring**: Refactor `parse-sql-statement.ts` and related parsers to use a monad-checker-compliant pattern
2. **Monad Checker Update**: Update the monad checker rules to allow the current pattern
3. **Alternative Architecture**: Design a different approach that doesn't require deep nesting

## Testing Strategy

Once implemented, enum types should have:

1. **Type-level tests**: Verify enum type creation and column type resolution
2. **Integration tests**: Test CREATE TYPE, INSERT with enum values, SELECT with enum columns
3. **Error tests**: Verify invalid enum values are rejected at compile time

## Example Usage (Future)

```typescript
const db = await sqlMigrations([
	`CREATE TYPE mood AS ENUM ('sad', 'ok', 'happy');`,
	`CREATE TABLE person (name text, current_mood mood);`,
])

// ✅ Valid
await db.query(`INSERT INTO person VALUES ('Alice', 'happy');`)

// ❌ Compile error: 'excited' is not a valid mood value
await db.query(`INSERT INTO person VALUES ('Bob', 'excited');`)

// Type inference works
const result = await db.query(`SELECT * FROM person;`)
// result.rows[0].current_mood: 'sad' | 'ok' | 'happy'
```

## References

- PostgreSQL ENUM documentation: https://www.postgresql.org/docs/current/datatype-enum.html
- Monad checker rules: `.cursor/rules/monad-checker-stop.mdc`
- Parser patterns: `.cursor/rules/parser-one-way-tokens.mdc`
