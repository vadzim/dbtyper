import { migration } from "../src/engine/sql-database.ts"

export const generateSql = () =>
	migration(`
  create schema if not exists auth;
`)
