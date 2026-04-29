import "reflect-metadata"

import { NestFactory } from "@nestjs/core"

import { AppModule } from "./app.module.ts"

async function bootstrap() {
	const app = await NestFactory.create(AppModule)
	const port = Number(process.env.PORT ?? "3000")
	await app.listen(port)
	console.error(`Nest listening on http://127.0.0.1:${port}`)
}

bootstrap().catch(err => {
	console.error(err)
	process.exit(1)
})
