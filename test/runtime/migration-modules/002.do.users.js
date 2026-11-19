import { migration } from "../../../src/core/sql-database.ts"

export const generateSql = () => migration(`create table auth.users (id text not null, age integer);`)
