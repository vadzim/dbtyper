export type SqlDatabaseLike = {
	readonly kind: "database"
	readonly defaultSchema: string
	readonly schemas: Record<string, Record<string, unknown>>
}

export type SqlEmptyDatabase<DefaultSchema extends string = "public"> = {
	readonly kind: "database"
	readonly defaultSchema: DefaultSchema
	readonly schemas: {}
}
