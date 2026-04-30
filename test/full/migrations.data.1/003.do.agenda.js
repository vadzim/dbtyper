import { migration } from "../../../src/core/sql-database.ts"

export const generateSql = () =>
	migration(`
  create table if not exists public.agenda (
    id uuid not null,
    created_at timestamp with time zone not null,
    user_id uuid not null,
    title text not null,
    agenda text
  );
`)
