import { migration } from "../src/engine/sql-database.ts"

export default migration(import.meta.url).add(`
  create table if not exists public.agenda (
    id uuid not null,
    created_at timestamp with time zone not null,
    meeting_id uuid,
    user_id uuid not null,
    workspace_id uuid,
    agenda_blocks jsonb,
    agenda_raw text
  );
`)
