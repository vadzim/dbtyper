import { migration } from "../src/engine/sql-database.ts"

export default migration(import.meta.url).add(`
  create schema if not exists auth;
`)
