import { migration } from "typesql"

export const generateSql = () =>
	migration(`
  insert into auth.users (id, email, display_name, login_count)
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'alice@example.com', 'Alice', 0),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'bob@example.com', 'Bob', 0);
`)
