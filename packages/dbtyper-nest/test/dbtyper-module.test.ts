// RUN-17: DbtyperModule.forRootAsync / forRoot register the database as a global provider under id (or a default token).
// Run: node --import tsx --test packages/dbtyper-nest/test/dbtyper-module.test.ts (needs no database).
import "reflect-metadata"

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { Module } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"

import { DbtyperModule, InjectDbtyper } from "../src/dbtyper.module.ts"

const fakeDb = (name: string) => ({ name, query: async () => [], stream: async () => (async function* () {})() })

async function boot(...imports: any[]) {
	@Module({ imports })
	class Root {}
	return await NestFactory.createApplicationContext(Root, { logger: false })
}

describe("RUN-17 DbtyperModule", () => {
	it("RUN-17: forRootAsync registers the factory result under id, with imports and inject", async () => {
		const TOKEN = "CLIENT"
		@Module({ providers: [{ provide: TOKEN, useValue: "client-1" }], exports: [TOKEN] })
		class ClientModule {}
		const app = await boot(
			ClientModule,
			DbtyperModule.forRootAsync({
				id: "nest-postgres",
				imports: [ClientModule],
				inject: [TOKEN],
				useFactory: (client: string) => Promise.resolve(fakeDb(client)),
			}),
		)
		const db = app.get<ReturnType<typeof fakeDb>>("nest-postgres", { strict: false })
		assert.equal(db.name, "client-1")
		await app.close()
	})
	it("RUN-17: the provider is global: a module without DbtyperModule in imports can inject it", async () => {
		@Module({
			providers: [{ provide: "SEEN", useFactory: (db: { name: string }) => db.name, inject: ["x"] }],
		})
		class Other {}
		const app = await boot(DbtyperModule.forRootAsync({ id: "x", useFactory: () => fakeDb("global") }), Other)
		assert.equal(app.select(Other).get("SEEN"), "global")
		await app.close()
	})
	it("RUN-17: forRoot registers a ready value or promise under id", async () => {
		const app = await boot(
			DbtyperModule.forRoot(fakeDb("a"), "one"),
			DbtyperModule.forRoot(Promise.resolve(fakeDb("b")), "two"),
		)
		assert.equal(app.get<ReturnType<typeof fakeDb>>("one", { strict: false }).name, "a")
		assert.equal(app.get<ReturnType<typeof fakeDb>>("two", { strict: false }).name, "b")
		await app.close()
	})
	it("RUN-17: without id the built-in default token is used, and @InjectDbtyper() reads it", async () => {
		class Service {
			constructor(readonly db: ReturnType<typeof fakeDb>) {}
		}
		InjectDbtyper()(Service, undefined, 0)
		@Module({ providers: [Service] })
		class Other {}
		const app = await boot(DbtyperModule.forRootAsync({ useFactory: () => fakeDb("default") }), Other)
		assert.equal(app.select(Other).get(Service).db.name, "default")
		await app.close()
	})
})
