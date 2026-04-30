import { migration } from "../../../src/core/sql-database.ts"

export const generateSql = () =>
	migration(`
  create table if not exists auth.users (
    id uuid not null,
    email text not null,
    display_name text,
    login_count integer not null,
    created_at timestamp with time zone null,
    updated_at timestamp with time zone null,
    deleted_at timestamp with time zone null,
    constraint users_pkey primary key (id)
  );
`)
