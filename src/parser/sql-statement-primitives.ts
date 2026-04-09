import type {
	ReadIdentifier,
	RemoveTrailingSemicolon,
	StripIdentifierQuotes,
	StripSqlComments,
	Trim,
} from "./sql-parse-primitives.js"

export type NormalizeSql<S extends string> = Trim<RemoveTrailingSemicolon<StripSqlComments<S>>>

export type ReadQualifiedIdentifier<S extends string> =
	ReadIdentifier<Trim<S>> extends [infer A extends string, infer RestA extends string]
		? Trim<RestA> extends `.${infer AfterDot}`
			? ReadIdentifier<AfterDot> extends [infer B extends string, infer RestB extends string]
				? [`${StripIdentifierQuotes<A>}.${StripIdentifierQuotes<B>}`, RestB]
				: [StripIdentifierQuotes<A>, RestA]
			: [StripIdentifierQuotes<A>, RestA]
		: never

export type NormalizeCreateForRow<S extends string> =
	NormalizeSql<S> extends `create table if not exists ${infer Rest}` ? `create table ${Rest}` : NormalizeSql<S>
