import { migration } from "../src/engine/sql-statement.js"

export default migration(import.meta.url).add(`
  create schema if not exists public;
`)
