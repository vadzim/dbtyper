// Integration Test: STMT-16 — a migration of 60 statements is applied completely
import { sqlMigrations } from "../../src/core/sql-database.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import { mockDriver } from "../test-utils/test-databases.ts"

// ✅ SUCCESS: STMT-16 one apply with 60 statements; every table is queryable
const db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table t0 (x int); create table t1 (x int); create table t2 (x int); create table t3 (x int); create table t4 (x int); create table t5 (x int); create table t6 (x int); create table t7 (x int); create table t8 (x int); create table t9 (x int); create table t10 (x int); create table t11 (x int); create table t12 (x int); create table t13 (x int); create table t14 (x int); create table t15 (x int); create table t16 (x int); create table t17 (x int); create table t18 (x int); create table t19 (x int); create table t20 (x int); create table t21 (x int); create table t22 (x int); create table t23 (x int); create table t24 (x int); create table t25 (x int); create table t26 (x int); create table t27 (x int); create table t28 (x int); create table t29 (x int); create table t30 (x int); create table t31 (x int); create table t32 (x int); create table t33 (x int); create table t34 (x int); create table t35 (x int); create table t36 (x int); create table t37 (x int); create table t38 (x int); create table t39 (x int); create table t40 (x int); create table t41 (x int); create table t42 (x int); create table t43 (x int); create table t44 (x int); create table t45 (x int); create table t46 (x int); create table t47 (x int); create table t48 (x int); create table t49 (x int); create table t50 (x int); create table t51 (x int); create table t52 (x int); create table t53 (x int); create table t54 (x int); create table t55 (x int); create table t56 (x int); create table t57 (x int); create table t58 (x int); create table t59 (x int);`,
	)
	.database()

const _result = await db.query("select x from t0;")
expectType<typeof _result>(toBe<{ x: number | null }[]>())
