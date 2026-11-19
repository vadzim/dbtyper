import { migration } from "dbtyper"

export const generateSql = () =>
	migration(`
  create table users (
    id integer primary key,
    name text not null,
    email text,
    profile json not null
  );
`)
