# TODO

## Ideas / next features

1) Expand `ALTER TABLE` support to constraints
   - Add `ADD/DROP CONSTRAINT`, `SET/DROP NOT NULL`, and FK/UNIQUE edits.
   - Effort: Medium–High, Impact: High.

2) Add `DEFAULT`, `CHECK`, and generated column support
   - Track these schema facts for stronger typing/validation.
   - Effort: Medium–High, Impact: High.

3) Make unique keys / primary keys first-class metadata
   - Expose PK/unique facts directly to enable better helper types and guarantees.
   - Effort: Medium, Impact: Medium–High.

4) Add a small typed `SELECT` subset
   - Start with table/column validation only.
   - Effort: High, Impact: High.

5) Build a migration diff / versioning layer
   - Validate ordered SQL files and schema evolution (CI-friendly).
   - Effort: High, Impact: High.

6) Add a runtime parser or CLI to print inferred types/errors
   - Improves debuggability/adoption beyond type tests.
   - Effort: Medium, Impact: Medium–High.

7) Broaden “ignorable statement” recovery
   - Support more common migration noise statements.
   - Effort: Low–Medium, Impact: Medium.

8) Clean up public API/docs + performance guardrails
   - Reduce drift; protect type-level perf budget.
   - Effort: Low, Impact: Medium.
