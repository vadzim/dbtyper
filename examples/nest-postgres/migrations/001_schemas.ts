import { migration } from "typesql"

export default migration(import.meta.url).add(`
  create schema if not exists auth;
  create schema if not exists public;
`)
