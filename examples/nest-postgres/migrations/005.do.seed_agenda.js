import { migration } from "dbtyper"

// app-cli.ts INNER JOINs public.agenda with auth.users, so every seeded user needs an agenda row to show up.
export const generateSql = () =>
	migration(`
  insert into public.agenda (id, created_at, user_id, title, agenda)
  values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '2024-01-01T00:00:00Z', '11111111-1111-1111-1111-111111111111'::uuid, 'Alice plans', 'Write the docs'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '2024-01-01T00:00:00Z', '22222222-2222-2222-2222-222222222222'::uuid, 'Bob plans', null);
`)
