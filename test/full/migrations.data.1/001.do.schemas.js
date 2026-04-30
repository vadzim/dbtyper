import { migration } from "../../../src/core/sql-database.ts"

export const generateSql = () =>
	migration(`
  create schema if not exists auth;
  create schema if not exists public;
`)
