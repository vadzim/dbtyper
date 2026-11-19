import { sqlMigrations } from "../../src/core/sql-database.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
const m = sqlMigrations({ driver: mockDriver })
m.apply(`create schema public;create table users (id integer primary key, name text);
select id
  from users
  where ghost = 1`)
m.apply(`create schema public;create table t1 (a integer primary key, b text);
select a
from t1 where a >= 1 and a >= 2 and a >= 3 and a >= 4 and a >= 5 and a >= 6 and a >= 7 and a >= 8 and a >= 9 and a >= 10 and a >= 11 and a >= 12 and a >= 13 and a >= 14 and a >= 15 and a >= 16 and a >= 17 and a >= 18 and a >= 19 and a >= 20 and a >= 21 and a >= 22 and a >= 23 and a >= 24 and a >= 25 and a >= 26 and a >= 27 and a >= 28 and a >= 29 and a >= 30 and a >= 31 and a >= 32 and a >= 33 and a >= 34 and a >= 35 and a >= 36 and a >= 37 and a >= 38 and a >= 39 and a >= 40 and a >= 41 and a >= 42 and a >= 43 and a >= 44 and a >= 45 and a >= 46 and a >= 47 and a >= 48 and a >= 49 and a >= 50 and a >= 51 and a >= 52 and a >= 53 and a >= 54 and a >= 55 and a >= 56 and a >= 57 and a >= 58 and a >= 59 and a >= 60 and a >= 61 and a >= 62 and a >= 63 and a >= 64 and a >= 65 and a >= 66 and a >= 67 and a >= 68 and a >= 69 and a >= 70 and a >= 71 and a >= 72 and a >= 73 and a >= 74 and a >= 75 and a >= 76 and a >= 77 and a >= 78 and a >= 79 and a >= 80 and a >= 81 and a >= 82 and a >= 83 and a >= 84 and a >= 85 and a >= 86 and a >= 87 and a >= 88 and a >= 89 and a >= 90 and a >= 91 and a >= 92 and a >= 93 and a >= 94 and a >= 95 and a >= 96 and a >= 97 and a >= 98 and a >= 99 and a >= 100 and ghost >= 260;`)
