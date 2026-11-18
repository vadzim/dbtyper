/**
 * SQLite: semantic actions of gram.y (track B typing, #55; DECISIONS.md "Grammar-driven typing (#55)").
 *
 * The value-carrying driver (`Parse` in src/gram/driver.ts) calls the action of a rule when it reduces by it and pushes
 * the result; the values build the typed AST that src/gram/sqlite/typer.ts types. Keys are rules as written in gram.y
 * (`"lhs: RHS SYMBOLS"`, no `%prec`); `scripts/gram/xml2ts.ts` reads these keys (a key line must start with the quoted
 * key) and fails on a key that is not a rule. `a` is the value stack, top first: `A<0>` is the last symbol of the rule.
 *
 * Values without an action:
 * - a terminal is `[terminal, text]` (the leaves: `["integer", "1"]`, `["id", "name"]`, `["null", "null"]`, ...);
 * - a one-symbol rule passes its value through (`expr: term`, `nm: ID`, `cmd: select`);
 * - any other rule is its key string: a marker that the typer reads as "not typed by the grammar typer yet", so the
 *   whole statement text goes to the inherited typer (see `Unsupported` in typer.ts).
 */
import type { SemanticAction } from "../driver.ts"

/** Result of an action whose rule is typed later: a node `{ k: Kind, ...fields }`. */
interface Act extends SemanticAction {}

/** The value of the `I`-th symbol from the end of the rule (`0` = last). */
type V<Self extends SemanticAction, I extends number> = Self["a"][I]

/** Field `K` of a node value (`unknown` when it is not a node). */
type F<Node, K extends string> = Node extends { [P in K]: infer X } ? X : unknown

/** Append to a list value; a non-list (a rule without action) stays a marker. */
type Append<List, Item> = List extends unknown[] ? [...List, Item] : List

interface Nil extends Act {
	r: null
}
interface Empty extends Act {
	r: []
}
interface One extends Act {
	r: OneR<this>
}
type OneR<S extends SemanticAction> = [V<S, 0>]
interface Pick<I extends number> extends Act {
	r: V<this, I>
}
/** `list COMMA item` and `list item` */
interface Push<ListAt extends number> extends Act {
	r: Append<V<this, ListAt>, V<this, 0>>
}

// ---- statements
interface CmdlistAppend extends Act {
	r: Append<V<this, 1>, V<this, 0>>
}

interface CreateTableHead extends Act {
	// createkw temp TABLE ifnotexists nm dbnm: `nm dbnm` is `schema.table` when dbnm is present
	r: CreateTableHeadR<this>
}
type CreateTableHeadR<S extends SemanticAction> = { k: "ct_head"; ifne: V<S, 2>; nm: V<S, 1>; dbnm: V<S, 0> }
interface CreateTable extends Act {
	r: CreateTableR<this>
}
type CreateTableR<S extends SemanticAction> = { k: "create_table"; head: V<S, 1>; body: V<S, 0> }
interface CreateTableBody extends Act {
	// LP columnlist conslist_opt RP table_option_set
	r: CreateTableBodyR<this>
}
type CreateTableBodyR<S extends SemanticAction> = { k: "ct_body"; cols: V<S, 3>; cons: V<S, 2>; opts: V<S, 0> }
interface IfNotExists extends Act {
	r: true
}
interface WithoutRowid extends Act {
	r: WithoutRowidR<this>
}
type WithoutRowidR<S extends SemanticAction> = { k: "without"; nm: V<S, 0> }
interface ColumnName extends Act {
	r: ColumnNameR<this>
}
type ColumnNameR<S extends SemanticAction> = { name: V<S, 1>; type: V<S, 0> }
interface TypeWord extends Act {
	r: TypeWordR<this>
}
type TypeWordR<S extends SemanticAction> = [V<S, 0>]
interface TypeWords extends Act {
	r: Append<V<this, 1>, V<this, 0>>
}
interface Constraint<C extends string> extends Act {
	r: { c: C }
}
interface PkColumn extends Act {
	// PRIMARY KEY sortorder onconf autoinc
	r: PkColumnR<this>
}
type PkColumnR<S extends SemanticAction> = { c: "pk"; order: V<S, 2> }
interface PkTable extends Act {
	// PRIMARY KEY LP sortlist autoinc RP onconf
	r: PkTableR<this>
}
type PkTableR<S extends SemanticAction> = { c: "pk"; cols: V<S, 3> }

// ---- SELECT
interface OneSelect extends Act {
	// SELECT distinct selcollist from where_opt groupby_opt having_opt orderby_opt limit_opt
	r: OneSelectR<this>
}
type OneSelectR<S extends SemanticAction> = {
	k: "select"
	cols: V<S, 6>
	from: V<S, 5>
	where: V<S, 4>
	group: V<S, 3>
	having: V<S, 2>
	order: V<S, 1>
	limit: V<S, 0>
}
interface SelExpr extends Act {
	// sclp scanpt expr scanpt as
	r: SelExprR<this>
}
type SelExprR<S extends SemanticAction> = Append<V<S, 4>, { k: "rc"; e: V<S, 2>; as: V<S, 0> }>
interface SelStar extends Act {
	r: Append<V<this, 2>, { k: "star"; t: null }>
}
interface SelTableStar extends Act {
	// sclp scanpt nm DOT STAR
	r: SelTableStarR<this>
}
type SelTableStarR<S extends SemanticAction> = Append<V<S, 4>, { k: "star"; t: V<S, 2> }>
interface FromItem extends Act {
	// stl_prefix nm dbnm as on_using
	r: FromItemR<this>
}
type FromItemR<S extends SemanticAction> =
	V<S, 4> extends { list: infer L; join: infer J }
		? Append<L, { k: "from"; join: J; nm: V<S, 3>; dbnm: V<S, 2>; as: V<S, 1>; on: V<S, 0> }>
		: V<S, 4>
interface StlPrefix extends Act {
	r: StlPrefixR<this>
}
type StlPrefixR<S extends SemanticAction> = { list: V<S, 1>; join: V<S, 0> }
interface StlPrefixEmpty extends Act {
	r: { list: []; join: null }
}
interface JoinKw<N extends number> extends Act {
	// JOIN_KW [nm [nm]] JOIN: the words (lower case), e.g. ["left", "outer"]
	r: JoinKwR<this, N>
}
type JoinKwR<S extends SemanticAction, N extends number> = {
	k: "join"
	words: N extends 1 ? [V<S, 1>] : N extends 2 ? [V<S, 2>, V<S, 1>] : [V<S, 3>, V<S, 2>, V<S, 1>]
}
interface OnExpr extends Act {
	r: OnExprR<this>
}
type OnExprR<S extends SemanticAction> = { on: V<S, 0> }
interface Limit1 extends Act {
	r: Limit1R<this>
}
type Limit1R<S extends SemanticAction> = [V<S, 0>]
interface Limit2 extends Act {
	r: Limit2R<this>
}
type Limit2R<S extends SemanticAction> = [V<S, 2>, V<S, 0>]
interface SortItem extends Act {
	// [sortlist COMMA] expr sortorder nulls
	r: V<this, 2>
}
interface SortPush extends Act {
	r: Append<V<this, 4>, V<this, 2>>
}
interface SortOne extends Act {
	r: SortOneR<this>
}
type SortOneR<S extends SemanticAction> = [V<S, 2>]

// ---- expressions
/** `expr <op words> expr`: the left operand is `LeftAt` symbols below the right one (2 for `expr PLUS expr`). */
interface Op<Kind extends string, LeftAt extends number = 2> extends Act {
	r: OpR<this, Kind, LeftAt>
}
type OpR<S extends SemanticAction, Kind extends string, LeftAt extends number> = {
	k: "op"
	op: Kind
	l: V<S, LeftAt>
	r: V<S, 0>
}
interface LikeEscape extends Act {
	// expr likeop expr ESCAPE expr
	r: LikeEscapeR<this>
}
type LikeEscapeR<S extends SemanticAction> = { k: "op"; op: "cmp"; l: V<S, 4>; r: V<S, 2>; esc: V<S, 0> }
interface Prefix<Kind extends string> extends Act {
	r: PrefixR<this, Kind>
}
type PrefixR<S extends SemanticAction, Kind extends string> = { k: "un"; op: Kind; x: V<S, 0> }
interface Postfix<Kind extends string, At extends number> extends Act {
	r: PostfixR<this, Kind, At>
}
type PostfixR<S extends SemanticAction, Kind extends string, At extends number> = { k: "un"; op: Kind; x: V<S, At> }
interface Qualified extends Act {
	r: QualifiedR<this>
}
type QualifiedR<S extends SemanticAction> = { k: "col"; t: V<S, 2>; c: V<S, 0> }
interface Qualified3 extends Act {
	r: Qualified3R<this>
}
type Qualified3R<S extends SemanticAction> = { k: "col"; s: V<S, 4>; t: V<S, 2>; c: V<S, 0> }
interface Between extends Act {
	r: BetweenR<this>
}
type BetweenR<S extends SemanticAction> = { k: "between"; x: V<S, 4>; lo: V<S, 2>; hi: V<S, 0> }
interface InList extends Act {
	// expr in_op LP exprlist RP
	r: InListR<this>
}
type InListR<S extends SemanticAction> = { k: "in"; x: V<S, 4>; list: V<S, 1> }
interface InSelect extends Act {
	r: InSelectR<this>
}
type InSelectR<S extends SemanticAction> = { k: "in_sel"; x: V<S, 4>; sel: V<S, 1> }
interface Subquery extends Act {
	r: SubqueryR<this>
}
type SubqueryR<S extends SemanticAction> = { k: "sub"; sel: V<S, 1> }
interface Exists extends Act {
	r: ExistsR<this>
}
type ExistsR<S extends SemanticAction> = { k: "exists"; sel: V<S, 1> }
interface Cast extends Act {
	// CAST LP expr AS typetoken RP
	r: CastR<this>
}
type CastR<S extends SemanticAction> = { k: "cast"; x: V<S, 3>; type: V<S, 1> }
interface Call extends Act {
	// ID LP distinct exprlist RP
	r: CallR<this>
}
type CallR<S extends SemanticAction> = { k: "fn"; name: V<S, 4>; args: V<S, 1> }
interface CallStar extends Act {
	// ID LP STAR RP
	r: CallStarR<this>
}
type CallStarR<S extends SemanticAction> = { k: "fn"; name: V<S, 3>; args: "*" }
interface Case extends Act {
	// CASE case_operand case_exprlist case_else END
	r: CaseR<this>
}
type CaseR<S extends SemanticAction> = { k: "case"; operand: V<S, 3>; whens: V<S, 2>; else: V<S, 1> }
interface When extends Act {
	r: WhenR<this>
}
type WhenR<S extends SemanticAction> = [[V<S, 2>, V<S, 0>]]
interface WhenPush extends Act {
	r: WhenPushR<this>
}
type WhenPushR<S extends SemanticAction> = Append<V<S, 4>, [V<S, 2>, V<S, 0>]>

/** Rule key -> action. Unlisted rules: see the header. */
export interface SqliteActions {
	"cmdlist: cmdlist ecmd": CmdlistAppend
	"cmdlist: ecmd": One
	"ecmd: cmdx SEMI": Pick<1>

	"cmd: create_table create_table_args": CreateTable
	"create_table: createkw temp TABLE ifnotexists nm dbnm": CreateTableHead
	"ifnotexists: IF NOT EXISTS": IfNotExists
	"ifnotexists:": Nil
	"dbnm:": Nil
	"dbnm: DOT nm": Pick<0>
	"create_table_args: LP columnlist conslist_opt RP table_option_set": CreateTableBody
	"table_option_set:": Empty
	"table_option_set: table_option": One
	"table_option_set: table_option_set COMMA table_option": Push<2>
	"table_option: WITHOUT nm": WithoutRowid
	"columnlist: columnlist COMMA columnname carglist": ColumnPush
	"columnlist: columnname carglist": ColumnOne
	"columnname: nm typetoken": ColumnName
	"typetoken:": Empty
	"typetoken: typename LP signed RP": Pick<3>
	"typetoken: typename LP signed COMMA signed RP": Pick<5>
	"typename: ID": TypeWord
	"typename: STRING": TypeWord
	"typename: typename ID": TypeWords
	"typename: typename STRING": TypeWords
	"carglist: carglist ccons": Push<1>
	"carglist:": Empty
	"ccons: CONSTRAINT nm": Constraint<"name">
	"ccons: DEFAULT scantok term": Constraint<"default">
	"ccons: DEFAULT LP expr RP": Constraint<"default">
	"ccons: DEFAULT scantok ID": Constraint<"default">
	"ccons: DEFAULT scantok INDEXED": Constraint<"default">
	"ccons: DEFAULT PLUS scantok term": Constraint<"default">
	"ccons: DEFAULT MINUS scantok term": Constraint<"default">
	"ccons: COLLATE ID": Constraint<"collate">
	"ccons: COLLATE STRING": Constraint<"collate">
	"ccons: NULL onconf": Constraint<"null">
	"ccons: NOT NULL onconf": Constraint<"notnull">
	"ccons: PRIMARY KEY sortorder onconf autoinc": PkColumn
	"ccons: UNIQUE onconf": Constraint<"unique">
	"ccons: CHECK LP expr RP": Constraint<"check">
	"ccons: REFERENCES nm eidlist_opt refargs": Constraint<"references">
	"ccons: defer_subclause": Constraint<"defer">
	"ccons: GENERATED ALWAYS AS generated": Constraint<"generated">
	"ccons: AS generated": Constraint<"generated">
	"conslist_opt:": Empty
	"conslist_opt: COMMA conslist": Pick<0>
	"conslist: conslist tconscomma tcons": Push<2>
	"conslist: tcons": One
	"tcons: CONSTRAINT nm": Constraint<"name">
	"tcons: PRIMARY KEY LP sortlist autoinc RP onconf": PkTable
	"tcons: UNIQUE LP sortlist RP onconf": Constraint<"unique">
	"tcons: CHECK LP expr RP onconf": Constraint<"check">
	"tcons: FOREIGN KEY LP eidlist RP REFERENCES nm eidlist_opt refargs defer_subclause_opt": Constraint<"references">

	"oneselect: SELECT distinct selcollist from where_opt groupby_opt having_opt orderby_opt limit_opt": OneSelect
	"sclp: selcollist COMMA": Pick<1>
	"sclp:": Empty
	"selcollist: sclp scanpt expr scanpt as": SelExpr
	"selcollist: sclp scanpt STAR": SelStar
	"selcollist: sclp scanpt nm DOT STAR": SelTableStar
	"as: AS nm": Pick<0>
	"as:": Nil
	"from:": Empty
	"from: FROM seltablist": Pick<0>
	"stl_prefix: seltablist joinop": StlPrefix
	"stl_prefix:": StlPrefixEmpty
	"seltablist: stl_prefix nm dbnm as on_using": FromItem
	"joinop: JOIN_KW JOIN": JoinKw<1>
	"joinop: JOIN_KW nm JOIN": JoinKw<2>
	"joinop: JOIN_KW nm nm JOIN": JoinKw<3>
	"on_using: ON expr": OnExpr
	"on_using:": Nil
	"where_opt:": Nil
	"where_opt: WHERE expr": Pick<0>
	"groupby_opt:": Nil
	"groupby_opt: GROUP BY nexprlist": Pick<0>
	"having_opt:": Nil
	"having_opt: HAVING expr": Pick<0>
	"orderby_opt:": Nil
	"orderby_opt: ORDER BY sortlist": Pick<0>
	"sortlist: sortlist COMMA expr sortorder nulls": SortPush
	"sortlist: expr sortorder nulls": SortOne
	"limit_opt:": Nil
	"limit_opt: LIMIT expr": Limit1
	"limit_opt: LIMIT expr OFFSET expr": Limit2
	"limit_opt: LIMIT expr COMMA expr": Limit2

	"expr: LP expr RP": Pick<1>
	"expr: nm DOT nm": Qualified
	"expr: nm DOT nm DOT nm": Qualified3
	"expr: BITNOT expr": Prefix<"bitnot">
	"expr: PLUS expr": Prefix<"pos">
	"expr: MINUS expr": Prefix<"neg">
	"expr: NOT expr": Prefix<"not">
	"expr: CAST LP expr AS typetoken RP": Cast
	"expr: ID LP distinct exprlist RP": Call
	"expr: INDEXED LP distinct exprlist RP": Call
	"expr: JOIN_KW LP distinct exprlist RP": Call
	"expr: ID LP STAR RP": CallStar
	"expr: INDEXED LP STAR RP": CallStar
	"expr: JOIN_KW LP STAR RP": CallStar
	"expr: expr COLLATE ID": Pick<2>
	"expr: expr COLLATE STRING": Pick<2>
	"expr: expr CONCAT expr": Op<"concat">
	"expr: expr STAR expr": Op<"arith">
	"expr: expr SLASH expr": Op<"arith">
	"expr: expr REM expr": Op<"arith">
	"expr: expr PLUS expr": Op<"arith">
	"expr: expr MINUS expr": Op<"arith">
	"expr: expr BITAND expr": Op<"bit">
	"expr: expr BITOR expr": Op<"bit">
	"expr: expr LSHIFT expr": Op<"bit">
	"expr: expr RSHIFT expr": Op<"bit">
	"expr: expr LT expr": Op<"cmp">
	"expr: expr GT expr": Op<"cmp">
	"expr: expr GE expr": Op<"cmp">
	"expr: expr LE expr": Op<"cmp">
	"expr: expr EQ expr": Op<"cmp">
	"expr: expr NE expr": Op<"cmp">
	"expr: expr likeop expr": Op<"cmp">
	"expr: expr likeop expr ESCAPE expr": LikeEscape
	"expr: expr AND expr": Op<"cmp">
	"expr: expr OR expr": Op<"cmp">
	"expr: expr IS expr": Op<"is">
	"expr: expr IS NOT expr": Op<"is", 3>
	"expr: expr IS NOT DISTINCT FROM expr": Op<"is", 5>
	"expr: expr IS DISTINCT FROM expr": Op<"is", 4>
	"expr: expr ISNULL": Postfix<"isnull", 1>
	"expr: expr NOTNULL": Postfix<"isnull", 1>
	"expr: expr NOT NULL": Postfix<"isnull", 2>
	"expr: expr between_op expr AND expr": Between
	"expr: expr in_op LP exprlist RP": InList
	"expr: expr in_op LP select RP": InSelect
	"expr: LP select RP": Subquery
	"expr: EXISTS LP select RP": Exists
	"expr: CASE case_operand case_exprlist case_else END": Case
	"case_exprlist: case_exprlist WHEN expr THEN expr": WhenPush
	"case_exprlist: WHEN expr THEN expr": When
	"case_else: ELSE expr": Pick<0>
	"case_else:": Nil
	"case_operand:": Nil
	"exprlist:": Empty
	"nexprlist: nexprlist COMMA expr": Push<2>
	"nexprlist: expr": One
}

interface ColumnPush extends Act {
	// columnlist COMMA columnname carglist
	r: ColumnPushR<this>
}
type ColumnPushR<S extends SemanticAction> = Append<
	V<S, 3>,
	{ k: "column"; name: F<V<S, 1>, "name">; type: F<V<S, 1>, "type">; cons: V<S, 0> }
>
interface ColumnOne extends Act {
	r: ColumnOneR<this>
}
type ColumnOneR<S extends SemanticAction> = [
	{ k: "column"; name: F<V<S, 1>, "name">; type: F<V<S, 1>, "type">; cons: V<S, 0> },
]
