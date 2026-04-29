import { migration } from "typesql"

export default migration(import.meta.url).add(`
  insert into auth.users (id, email, display_name)
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'alice@example.com', 'Alice'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'bob@example.com', 'Bob');
`)
