/**
 * #207 (item 4c): the name PostgreSQL gives a constraint written without `CONSTRAINT name`, so that every constraint
 * of a table is tracked by name (`constraints.names`): `ON CONFLICT ON CONSTRAINT`, `DROP CONSTRAINT`, DROP COLUMN
 * and the foreign keys a CASCADE removes read them.
 *
 * PostgreSQL (`ChooseConstraintName`, `ChooseRelationName`, `makeObjectName`): `<table>_<columns>_<label>`, the
 * columns joined with `_` (`key`: UNIQUE, `fkey`: FOREIGN KEY; `check`: a CHECK whose expression names exactly one
 * column, else `<table>_check`; the primary key is `<table>_pkey`, kept in `primary_key`). Over 63 characters, the
 * longer of the table and column parts is cut one character at a time until the name fits. A name already taken gets
 * the number 1, 2, … after the label (`t_a_key1`). Taken means: by the tracked names of the whole schema (PGT-40, #210: PostgreSQL
 * checks the schema, not the table) and, in a CREATE TABLE, the names seen so far. Names are counted in characters, which
 * is PostgreSQL's byte count for ASCII names.
 */

/** The characters of `S` as a tuple of `1` (its length); `S` is a name, at most a few dozen characters. */
type CharCount<S extends string, Acc extends readonly 1[] = []> = S extends `${string}${infer R}`
	? CharCount<R, [...Acc, 1]>
	: Acc

/** The first `N["length"]` characters of `S`. */
type TakeChars<S extends string, N extends readonly 1[], Acc extends string = ""> = N extends readonly [
	1,
	...infer R extends readonly 1[],
]
	? S extends `${infer C}${infer Rest}`
		? TakeChars<Rest, R, `${Acc}${C}`>
		: Acc
	: Acc

/** `makeObjectName`: shorten the longer part (the second one on a tie) until both fit in `Avail` characters. */
type FitParts<L1 extends readonly 1[], L2 extends readonly 1[], Avail extends readonly 1[]> = [
	...L1,
	...L2,
] extends readonly [...Avail, 1, ...1[]]
	? L1 extends readonly [...L2, 1, ...1[]]
		? L1 extends readonly [1, ...infer R1 extends readonly 1[]]
			? FitParts<R1, L2, Avail>
			: [L1, L2]
		: L2 extends readonly [1, ...infer R2 extends readonly 1[]]
			? FitParts<L1, R2, Avail>
			: [L1, L2]
	: [L1, L2]

/** 63 characters (NAMEDATALEN - 1) as a tuple. */
type MaxNameChars = CharCount<"123456789012345678901234567890123456789012345678901234567890123">

/** The 63 characters minus `Overhead`. */
type AvailChars<Overhead extends readonly 1[]> = MaxNameChars extends readonly [
	...Overhead,
	...infer A extends readonly 1[],
]
	? A
	: []

/** `makeObjectName(name1, name2, label)`; `Name2` is `""` when there is none. */
type MakeObjectName<Name1 extends string, Name2 extends string, Label extends string> = (
	Name2 extends "" ? `${Name1}_${Label}` : `${Name1}_${Name2}_${Label}`
) extends infer Whole extends string
	? CharCount<Whole> extends readonly [...MaxNameChars, 1, ...1[]]
		? FitParts<
				CharCount<Name1>,
				CharCount<Name2>,
				AvailChars<Name2 extends "" ? [1, ...CharCount<Label>] : [1, 1, ...CharCount<Label>]>
			> extends [infer N1 extends readonly 1[], infer N2 extends readonly 1[]]
			? Name2 extends ""
				? `${TakeChars<Name1, N1>}_${Label}`
				: `${TakeChars<Name1, N1>}_${TakeChars<Name2, N2>}_${Label}`
			: never
		: Whole
	: never

/** The label numbers PostgreSQL tries after the plain label. */
type Passes = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]

/** The first of `<label>`, `<label>1`, … that `Taken` does not have. */
type ChooseName<
	Name1 extends string,
	Name2 extends string,
	Label extends string,
	Taken extends string,
	Pass extends readonly string[] = Passes,
	Try extends string = MakeObjectName<Name1, Name2, Label>,
> = [Try] extends [Taken]
	? Pass extends readonly [infer P extends string, ...infer R extends readonly string[]]
		? ChooseName<Name1, Name2, Label, Taken, R, MakeObjectName<Name1, Name2, `${Label}${P}`>>
		: Try
	: Try

/** The column names joined with `_` (`ChooseIndexNameAddition`, `ChooseForeignKeyConstraintNameAddition`). */
export type JoinColumnNames<Cols extends readonly string[], Acc extends string = ""> = Cols extends readonly [
	infer H extends string,
	...infer R extends readonly string[],
]
	? JoinColumnNames<R, Acc extends "" ? H : `${Acc}_${H}`>
	: Acc

/** The default name of a constraint of table `Table` on the columns `Cols` (joined), for the label `Label`. */
export type DefaultConstraintName<
	Table extends string,
	Cols extends string,
	Label extends "key" | "fkey" | "check",
	Taken extends string,
> = ChooseName<Table, Cols, Label, Taken>

/** `Names` is exactly one name (a CHECK names one column: `<table>_<column>_check`), else `""`. */
export type SingleName<Names extends string, All extends string = Names> = [Names] extends [never]
	? ""
	: Names extends unknown
		? [All] extends [Names]
			? Names
			: ""
		: never
