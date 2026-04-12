import { migration } from "../src/engine/sql-database.js"

export default migration(import.meta.url).add(`
  create table if not exists auth.users (
    id uuid not null,
    email text not null,
    display_name text,
    created_at timestamp with time zone null,
    updated_at timestamp with time zone null,
    deleted_at timestamp with time zone null,
    constraint users_pkey primary key (id)
  );
`)
