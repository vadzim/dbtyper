import { migration } from "../src/engine/sql-database.js"

export default migration(import.meta.url).add(`
    create table if not exists "public"."agenda" (
        "id" "uuid" default "gen_random_uuid"() not null primary key,
        "created_at" timestamp with time zone default "now"() not null,
        "meeting_id" "uuid",
        "user_id" "uuid" not null references auth.users(id),
        "workspace_id" "uuid",
        "agenda_blocks" "jsonb",
        "agenda_raw" "text"
    );
`)
