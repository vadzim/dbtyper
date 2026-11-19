// Integration Test: CORE-6 — a statement with 30 parameters gets every parameter type (one parse per parameter)
import { sqlMigrations } from "../../src/core/sql-database.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import { mockDriver } from "../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table t (id integer not null, c0 integer not null, c1 integer not null, c2 integer not null, c3 integer not null, c4 integer not null, c5 integer not null, c6 integer not null, c7 integer not null, c8 integer not null, c9 integer not null, c10 integer not null, c11 integer not null, c12 integer not null, c13 integer not null, c14 integer not null, c15 integer not null, c16 integer not null, c17 integer not null, c18 integer not null, c19 integer not null, c20 integer not null, c21 integer not null, c22 integer not null, c23 integer not null, c24 integer not null, c25 integer not null, c26 integer not null, c27 integer not null, c28 integer not null, c29 integer not null);`,
	)
	.database()

const sql =
	`select id from t where c0 = :p0 and c1 = :p1 and c2 = :p2 and c3 = :p3 and c4 = :p4 and c5 = :p5 and c6 = :p6 and c7 = :p7 and c8 = :p8 and c9 = :p9 and c10 = :p10 and c11 = :p11 and c12 = :p12 and c13 = :p13 and c14 = :p14 and c15 = :p15 and c16 = :p16 and c17 = :p17 and c18 = :p18 and c19 = :p19 and c20 = :p20 and c21 = :p21 and c22 = :p22 and c23 = :p23 and c24 = :p24 and c25 = :p25 and c26 = :p26 and c27 = :p27 and c28 = :p28 and c29 = :p29;` as const

// ✅ SUCCESS: CORE-6 each of the 30 named parameters takes the type of its column
const _result = await _db.query(sql, {
	p0: 0,
	p1: 1,
	p2: 2,
	p3: 3,
	p4: 4,
	p5: 5,
	p6: 6,
	p7: 7,
	p8: 8,
	p9: 9,
	p10: 10,
	p11: 11,
	p12: 12,
	p13: 13,
	p14: 14,
	p15: 15,
	p16: 16,
	p17: 17,
	p18: 18,
	p19: 19,
	p20: 20,
	p21: 21,
	p22: 22,
	p23: 23,
	p24: 24,
	p25: 25,
	p26: 26,
	p27: 27,
	p28: 28,
	p29: 29,
})
expectType<typeof _result>(toBe<Array<{ id: number }>>())

// ❌ ERROR: CORE-6 a wrong value for the last parameter is still found
const badValues = {
	p0: 0,
	p1: 1,
	p2: 2,
	p3: 3,
	p4: 4,
	p5: 5,
	p6: 6,
	p7: 7,
	p8: 8,
	p9: 9,
	p10: 10,
	p11: 11,
	p12: 12,
	p13: 13,
	p14: 14,
	p15: 15,
	p16: 16,
	p17: 17,
	p18: 18,
	p19: 19,
	p20: 20,
	p21: 21,
	p22: 22,
	p23: 23,
	p24: 24,
	p25: 25,
	p26: 26,
	p27: 27,
	p28: 28,
	p29: "x",
}
// @ts-expect-error
await _db.query(sql, badValues)
