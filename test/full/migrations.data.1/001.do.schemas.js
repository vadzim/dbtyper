import { migration } from "typesql"

export const generateSql = () =>
	migration(`
  create schema if not exists auth;
  create schema if not exists public;
`)
