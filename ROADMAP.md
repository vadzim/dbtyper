# jsql roadmap

This document sketches where the project could go. It is aspirational and unordered unless noted; nothing here is a commitment to build.

## Vision

**jsql** aims to keep SQL and TypeScript in sync at compile time: SQL literals become structured types (rows, schemas, databases) with validation errors you can treat as data, not opaque failures. Over time it could grow from a narrow `CREATE TABLE` parser into a larger “types as documentation and contracts” layer between your schema and application code.

## Today (baseline)

- `CREATE TABLE` → column names, nullability, coarse SQL-to-TS type mapping
- Table, schema, and multi-schema database composition with duplicate-name checks
- Foreign keys: intra-schema, cross-schema, composite columns, arity vs referenced list, column existence on targets
- Explicit `SqlParseError<"…">` messages suitable for strict type tests

Constraints that should stay visible in future work:

- Type-level cost must stay bounded; heavy features should remain opt-in where possible
- Preserve readable error messages and stable patterns for testing (literal messages, not vague templates)

---

## Near horizon (extend the same model)

- **More of DDL**: `ALTER TABLE` (add/drop column, add constraint) as type-level patches on an existing schema type; `DROP TABLE` / rename as schema diff concepts (even if only for documentation types)
- **Richer column metadata**: `DEFAULT`, `GENERATED`, check constraints that mention columns (parse + validate refs like FKs), `UNIQUE` / `PRIMARY KEY` as first-class facts for inference
- **Indexes and uniqueness**: model unique constraints and indexes enough to reason about “natural keys” in types (e.g. “lookup by email is valid”)
- **Dialect edges**: clearer split between “Postgres-ish” and portable subsets; optional strict mode per dialect
- **Ergonomics**: small helper types to pick row types, join keys, or “insert shape” vs “select shape” without new SQL syntax

## Mid horizon (schema as a platform)

- **Views and CTEs**: readonly row types from `CREATE VIEW` or a minimal `SELECT` subset (large type cost—likely behind explicit entry points)
- **Migrations as types**: ordered list of SQL snippets → schema version N; fail at compile time if a migration breaks FKs or renames columns still referenced elsewhere
- **Runtime bridge (optional package)**: parse the same SQL at runtime with a small parser, or generate JSON Schema / Zod from the type-level description for forms and APIs—without duplicating logic in incompatible ways
- **Query layer (experimental)**: tagged template or fluent API checked against `SqlDatabase` (e.g. selected columns and joins validated against known tables). This is easy to underestimate; a realistic goal might be “safe column/table identifiers” before full SQL typing
- **Tooling**: CLI or editor extension to print inferred types, list errors, or diff two schema types for CI

## Long horizon (where it could grow)

- **Multi-file / codegen workflow**: repository of `.sql` files → emitted `.d.ts` or a single module type, for teams that do not want SQL inside TS sources
- **Cross-language consumers**: export OpenAPI-ish or protobuf-style descriptions from the type-level schema for services in other languages
- **Data access patterns**: typed `INSERT`/`UPDATE`/`DELETE` row shapes, or ORM-adjacent helpers that stay zero-runtime if they only exist as types
- **Replication / sharding hints**: optional annotations (comments or extended syntax) for partitioning keys—only if they map cleanly to TS usage
- **Ecosystem**: integration examples (Drizzle, Kysely, raw `pg`) as recipes, not core library bloat

## Possible non-goals

- Replacing a full SQL parser or database planner in the type system
- Supporting every corner of SQL:2003+ in templates (cost explodes quickly)
- Silent widening of errors into `string` or `never` without a deliberate escape hatch

## How to use this document

Treat sections as **backlog themes**. When picking work, prefer small steps that keep instantiations fast and errors precise; update this file when priorities shift.
