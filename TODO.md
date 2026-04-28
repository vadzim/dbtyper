# TODO

## Ideas / next features

nvidia/nemotron-3-super-120b-a12b:free

- use that expression parser
  -- where clause should check the correctness of returned type of expression
  -- select should use that info to return types of columns

1. support `ALTER TABLE`
    - Add `ADD/DROP CONSTRAINT`, `SET/DROP NOT NULL`, and FK/UNIQUE edits.
    - Effort: Medium–High, Impact: High.

2. Add `DEFAULT`, `CHECK`, and generated column support
    - Track these schema facts for stronger typing/validation.
    - Effort: Medium–High, Impact: High.

3. Make unique keys / primary keys first-class metadata
    - Expose PK/unique facts directly to enable better helper types and guarantees.
    - Effort: Medium, Impact: Medium–High.

4. Clean up public API/docs + performance guardrails
    - Reduce drift; protect type-level perf budget.
    - Effort: Low, Impact: Medium.
