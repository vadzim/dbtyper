import * as ts from "typescript"
import path from "node:path"

export type SourcePos = {
	start: number
	end: number
	line: number
	column: number
}

export type TypeReference = {
	typeId: string
	pos: SourcePos
}

export type TypeAstNode = {
	kind: string
	text: string
	name?: string
	refId?: string
	refName?: string
	scopeId?: string
	pos?: SourcePos
	/** Lexical type-parameter / infer names visible at this node (innermost last). */
	lexicalBindings?: string[]
	nodes?: TypeAstNode[]
}

export type ScopeCall = {
	calleeTypeId: string
	arguments: { refs: TypeReference[] }[]
}

export type ScopeEntryKind =
	| "typeLiteral"
	| "conditionalCondition"
	| "conditionalTrueBranch"
	| "conditionalFalseBranch"
	| "typeAlias"
	| "interface"
	| "function"
	| "variable"
	| "class"
	| "classMethod"
	| "propertySignature"
	| "methodSignature"
	| "anonymousParam"
	| "file"

export type ScopeEntry = {
	id: string
	kind: ScopeEntryKind
	file: string
	pos: SourcePos
	parentScopeId?: string
	children: { scopeId: string }[]
	refs: TypeReference[]
	calls: ScopeCall[]
}

export type SourceKind =
	| "typeDeclaration"
	| "typeImport"
	| "typeParam"
	| "typeInfer"
	| "interface"
	| "functionEntity"
	| "functionReturn"
	| "functionParam"
	| "variable"
	| "classEntity"
	| "classHeritage"
	| "classProperty"
	| "classMethodEntity"
	| "classMethodReturn"
	| "classMethodParam"
	| "propertySignature"
	| "methodSignatureEntity"
	| "methodSignatureReturn"
	| "methodSignatureParam"
	| "anonymousParam"

export type TypeEntryParent = {
	typeId: string
	argumentIndex: number
}

export type TypeEntry = {
	id: string
	file: string
	refFile: string
	name: string
	sourceKind: SourceKind
	parent: TypeEntryParent
	scopeId: string
	refScopes: { scopeId: string }[]
	builtFrom: { typeId: string }[]
	arguments: {
		comments: string[]
		refs: { typeId: string }[]
		/** Refs from `extends` only (not default); used for opaque / constraint checks. */
		constraintRefs: { typeId: string }[]
	}[]
	pos: SourcePos
	ast?: TypeAstNode
	scope: {
		bindings: string[]
	}
}

export type ReadTypesResult = {
	types: TypeEntry[]
	scopes: ScopeEntry[]
}

export type ReadTypesOptions = {
	idPrefix?: string
	imports?: Record<string, string>
	includeAst?: boolean
}

export function readTypes(
	entryPath: string,
	entryContent: string,
	{ idPrefix = "", imports = {}, includeAst = false }: ReadTypesOptions = {},
): ReadTypesResult {
	const entries: TypeEntry[] = []
	const scopes: ScopeEntry[] = []
	const sourceFilePathByName = new Map<string, string>()
	const globalRefs = new Map<string, string[]>()
	const scopeTypeRefs = new Map<string, TypeReference[]>()
	const scopeCalls = new Map<string, ScopeCall[]>()
	const pendingTypeArguments = new Map<
		string,
		{ comments: string[]; constraintRefNames: string[]; defaultRefNames: string[] }[]
	>()
	const conditionalScopeInferEntryIds = new Map<string, string[]>()
	const conditionalScopeCheckNode = new Map<string, TypeAstNode>()
	let anonymousCounter = 0

	const normalizeLogicalPath = (filePath: string) => {
		const normalized = path.posix.normalize(filePath)
		if (normalized.startsWith("/")) return normalized
		return normalized === "." || normalized.startsWith("./") ? normalized : `./${normalized}`
	}
	const resolveRelativeImportPath = (fromFile: string, specifier: string) =>
		normalizeLogicalPath(path.posix.join(path.posix.dirname(fromFile), specifier))

	/** TS often imports `./x.js` while `readTypes` entry paths use `.ts` (NodeNext emit). */
	const refFileForTypeScriptTypeImport = (resolved: string) => {
		if (resolved.endsWith(".js")) return `${resolved.slice(0, -3)}.ts`
		if (resolved.endsWith(".jsx")) return `${resolved.slice(0, -4)}.tsx`
		return resolved
	}
	const resolveNodeImportSpecifier = (specifier: string) => {
		const exact = imports[specifier]
		if (exact) return exact
		for (const [pattern, target] of Object.entries(imports)) {
			const wildcardIndex = pattern.indexOf("*")
			if (wildcardIndex === -1) continue
			const prefix = pattern.slice(0, wildcardIndex)
			const suffix = pattern.slice(wildcardIndex + 1)
			if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue
			const captured = specifier.slice(prefix.length, specifier.length - suffix.length)
			return target.replace("*", captured)
		}
		return undefined
	}
	const files = [{ path: normalizeLogicalPath(entryPath), content: entryContent }]

	const addGlobalRef = (name: string, id: string) => {
		const ids = globalRefs.get(name)
		if (ids) {
			ids.push(id)
			return
		}
		globalRefs.set(name, [id])
	}

	const nextAnonymousName = (file: string, sourceKind: SourceKind) =>
		`$anon:${file}:${sourceKind}:${++anonymousCounter}`
	const getLogicalFilePath = (sourceFile: ts.SourceFile) =>
		sourceFilePathByName.get(sourceFile.fileName) ?? sourceFile.fileName

	const toPos = (sourceFile: ts.SourceFile, node: ts.Node): SourcePos => {
		const lc = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
		return {
			start: node.getStart(sourceFile),
			end: node.getEnd(),
			line: lc.line + 1,
			column: lc.character + 1,
		}
	}

	const createScope = (sourceFile: ts.SourceFile, node: ts.Node, kind: ScopeEntryKind, parentScopeId?: string) => {
		const logicalFilePath = getLogicalFilePath(sourceFile)
		const id = `${idPrefix}${logicalFilePath}:scope:${scopes.length}:${kind}`
		const scope: ScopeEntry = {
			id,
			kind,
			file: logicalFilePath,
			pos: toPos(sourceFile, node),
			children: [],
			refs: [],
			calls: [],
		}
		if (parentScopeId) {
			scope.parentScopeId = parentScopeId
		}
		scopes.push(scope)
		scopeTypeRefs.set(id, [])
		scopeCalls.set(id, [])
		return id
	}

	const addScopeTypeRef = (scopeId: string | undefined, reference: TypeReference | undefined) => {
		if (!scopeId || !reference) return
		scopeTypeRefs.get(scopeId)?.push(reference)
	}

	const addScopeCall = (
		scopeId: string | undefined,
		calleeTypeId: string | undefined,
		argumentsList: { refs: TypeReference[] }[],
	) => {
		if (!scopeId || !calleeTypeId) return
		scopeCalls.get(scopeId)?.push({ calleeTypeId, arguments: argumentsList })
	}

	const normalizeCommentText = (raw: string) => {
		const trimmed = raw.trim()
		if (trimmed.startsWith("/*") && trimmed.endsWith("*/")) {
			return trimmed.slice(2, -2).trim()
		}
		if (trimmed.startsWith("//")) {
			return trimmed.slice(2).trim()
		}
		return trimmed
	}

	const extractCommentsFromText = (text: string) => {
		const matches = text.match(/\/\*[\s\S]*?\*\/|\/\/[^\n\r]*/g) ?? []
		return matches.map(normalizeCommentText).filter(Boolean)
	}

	const collectRefNamesFromTypeNode = (typeNode: ts.TypeNode | undefined) => {
		if (!typeNode) return []
		const refNames: string[] = []
		const walk = (node: ts.Node) => {
			if (ts.isTypeReferenceNode(node)) {
				if (ts.isIdentifier(node.typeName)) {
					refNames.push(node.typeName.text)
				} else {
					refNames.push(node.typeName.getText())
				}
			}
			ts.forEachChild(node, walk)
		}
		walk(typeNode)
		return refNames
	}

	const collectTypeParameterArguments = (
		sourceFile: ts.SourceFile,
		typeParameters: ts.NodeArray<ts.TypeParameterDeclaration> | undefined,
	) => {
		if (!typeParameters) {
			return []
		}
		return typeParameters.map((typeParameter, index, allTypeParameters) => {
			const rangeStart = index === 0 ? typeParameters.pos : allTypeParameters[index - 1]!.end
			const rangeEnd = typeParameter.getStart(sourceFile)
			const commentText = sourceFile.text.slice(rangeStart, rangeEnd)
			return {
				comments: extractCommentsFromText(commentText),
				constraintRefNames: collectRefNamesFromTypeNode(typeParameter.constraint),
				defaultRefNames: collectRefNamesFromTypeNode(typeParameter.default),
			}
		})
	}

	const upcomingTypeEntryId = (sourceFile: ts.SourceFile, sourceKind: SourceKind) => {
		const logicalFilePath = getLogicalFilePath(sourceFile)
		return `${idPrefix}${logicalFilePath}:${entries.length}:${sourceKind}`
	}

	const patchTypeParamParentRange = (
		startIndex: number,
		count: number,
		sourceFile: ts.SourceFile,
		parentSourceKind: SourceKind,
	) => {
		if (count <= 0) return
		const parentId = upcomingTypeEntryId(sourceFile, parentSourceKind)
		for (let i = 0; i < count; i += 1) {
			const entry = entries[startIndex + i]
			if (!entry || entry.sourceKind !== "typeParam") {
				throw new Error(
					`patchTypeParamParentRange: expected typeParam at index ${startIndex + i}, got ${entry?.sourceKind}`,
				)
			}
			entry.parent = { typeId: parentId, argumentIndex: i }
		}
	}

	const createEntry = (
		sourceFile: ts.SourceFile,
		node: ts.Node,
		name: string | undefined,
		sourceKind: SourceKind,
		ast: TypeAstNode,
		scopeBindings: string[],
		scopeId: string,
		typeArguments?: {
			comments: string[]
			constraintRefNames: string[]
			defaultRefNames: string[]
		}[],
		refFile?: string,
		parentLink?: TypeEntryParent,
	) => {
		const logicalFilePath = getLogicalFilePath(sourceFile)
		const emptyParent: TypeEntryParent = { typeId: "", argumentIndex: 0 }
		const entry: TypeEntry = {
			id: `${idPrefix}${logicalFilePath}:${entries.length}:${sourceKind}`,
			file: logicalFilePath,
			refFile: refFile ?? logicalFilePath,
			name: name ?? nextAnonymousName(logicalFilePath, sourceKind),
			sourceKind,
			parent: sourceKind === "typeParam" ? (parentLink ?? emptyParent) : emptyParent,
			scopeId,
			refScopes: [],
			builtFrom: [],
			arguments: [],
			pos: toPos(sourceFile, node),
			ast,
			scope: { bindings: [...scopeBindings] },
		}
		entries.push(entry)

		if (name) {
			addGlobalRef(name, entry.id)
		}
		if (typeArguments && typeArguments.length > 0) {
			pendingTypeArguments.set(entry.id, typeArguments)
		}

		return entry
	}

	const isPlainIdentifierType = (node: ts.TypeNode) =>
		ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName) && !node.typeArguments?.length

	const buildTypeAst = (
		sourceFile: ts.SourceFile,
		typeNode: ts.TypeNode,
		scopeBindings: string[],
		scopeId: string,
	): TypeAstNode => {
		const lex = (n: TypeAstNode): TypeAstNode => {
			n.lexicalBindings = [...scopeBindings]
			return n
		}

		if (ts.isTypeReferenceNode(typeNode)) {
			const typeArgs = typeNode.typeArguments?.map(a => buildTypeAst(sourceFile, a, scopeBindings, scopeId))
			if (ts.isIdentifier(typeNode.typeName)) {
				const node: TypeAstNode = {
					kind: "typeRef",
					text: typeNode.getText(sourceFile),
					name: typeNode.typeName.text,
					refName: typeNode.typeName.text,
					scopeId,
					pos: toPos(sourceFile, typeNode.typeName),
				}
				if (typeArgs && typeArgs.length > 0) {
					node.nodes = typeArgs
				}
				return lex(node)
			}
			const node: TypeAstNode = {
				kind: "typeRef",
				text: typeNode.getText(sourceFile),
				name: typeNode.typeName.getText(sourceFile),
				refName: typeNode.typeName.getText(sourceFile),
				scopeId,
				pos: toPos(sourceFile, typeNode.typeName),
			}
			if (typeArgs && typeArgs.length > 0) {
				node.nodes = typeArgs
			}
			return lex(node)
		}

		if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
			return lex({
				kind: ts.isUnionTypeNode(typeNode) ? "union" : "intersection",
				text: typeNode.getText(sourceFile),
				scopeId,
				nodes: typeNode.types.map(t => buildTypeAst(sourceFile, t, scopeBindings, scopeId)),
			})
		}

		if (ts.isTypeLiteralNode(typeNode)) {
			const localScopeId = createScope(sourceFile, typeNode, "typeLiteral", scopeId)
			const memberNodes: TypeAstNode[] = []
			for (const member of typeNode.members) {
				if (
					(ts.isPropertySignature(member) ||
						ts.isMethodSignature(member) ||
						ts.isIndexSignatureDeclaration(member)) &&
					member.type
				) {
					memberNodes.push(buildTypeAst(sourceFile, member.type, scopeBindings, localScopeId))
				}
			}
			return lex({
				kind: "typeLiteral",
				text: typeNode.getText(sourceFile),
				scopeId: localScopeId,
				nodes: memberNodes,
			})
		}

		if (ts.isArrayTypeNode(typeNode)) {
			return lex({
				kind: "array",
				text: typeNode.getText(sourceFile),
				scopeId,
				nodes: [buildTypeAst(sourceFile, typeNode.elementType, scopeBindings, scopeId)],
			})
		}

		if (ts.isTupleTypeNode(typeNode)) {
			return lex({
				kind: "tuple",
				text: typeNode.getText(sourceFile),
				scopeId,
				nodes: typeNode.elements.map(e =>
					ts.isNamedTupleMember(e)
						? buildTypeAst(sourceFile, e.type, scopeBindings, scopeId)
						: buildTypeAst(sourceFile, e, scopeBindings, scopeId),
				),
			})
		}

		if (ts.isParenthesizedTypeNode(typeNode)) {
			return lex({
				kind: "parenthesized",
				text: typeNode.getText(sourceFile),
				scopeId,
				nodes: [buildTypeAst(sourceFile, typeNode.type, scopeBindings, scopeId)],
			})
		}

		if (ts.isFunctionTypeNode(typeNode)) {
			const nodes: TypeAstNode[] = []
			for (const param of typeNode.parameters) {
				if (param.type) {
					nodes.push(buildTypeAst(sourceFile, param.type, scopeBindings, scopeId))
				}
			}
			if (typeNode.type) {
				nodes.push(buildTypeAst(sourceFile, typeNode.type, scopeBindings, scopeId))
			}
			return lex({ kind: "functionType", text: typeNode.getText(sourceFile), scopeId, nodes })
		}

		if (ts.isConditionalTypeNode(typeNode)) {
			const conditionScopeId = createScope(sourceFile, typeNode.checkType, "conditionalCondition", scopeId)
			const trueScopeId = createScope(sourceFile, typeNode.trueType, "conditionalTrueBranch", conditionScopeId)
			const falseScopeId = createScope(sourceFile, typeNode.falseType, "conditionalFalseBranch", conditionScopeId)
			const inferBindings: string[] = []
			const walkInfer = (node: ts.Node) => {
				if (ts.isInferTypeNode(node)) {
					inferBindings.push(node.typeParameter.name.text)
				}
				ts.forEachChild(node, walkInfer)
			}
			walkInfer(typeNode.extendsType)

			const extendedScope = [...scopeBindings, ...inferBindings]
			for (const inferName of inferBindings) {
				const inferEntry = createEntry(
					sourceFile,
					typeNode,
					inferName,
					"typeInfer",
					{
						kind: "inferBinding",
						text: `infer ${inferName}`,
						name: inferName,
						scopeId: conditionScopeId,
					},
					scopeBindings,
					conditionScopeId,
				)
				const inferIds = conditionalScopeInferEntryIds.get(conditionScopeId)
				if (inferIds) {
					inferIds.push(inferEntry.id)
				} else {
					conditionalScopeInferEntryIds.set(conditionScopeId, [inferEntry.id])
				}
			}

			const checkNode = buildTypeAst(sourceFile, typeNode.checkType, scopeBindings, conditionScopeId)
			conditionalScopeCheckNode.set(conditionScopeId, checkNode)
			return lex({
				kind: "conditional",
				text: typeNode.getText(sourceFile),
				scopeId,
				nodes: [
					checkNode,
					buildTypeAst(sourceFile, typeNode.extendsType, scopeBindings, conditionScopeId),
					buildTypeAst(sourceFile, typeNode.trueType, extendedScope, trueScopeId),
					buildTypeAst(sourceFile, typeNode.falseType, scopeBindings, falseScopeId),
				],
			})
		}

		if (ts.isTypeOperatorNode(typeNode)) {
			return lex({
				kind: `typeOperator:${ts.tokenToString(typeNode.operator) ?? "unknown"}`,
				text: typeNode.getText(sourceFile),
				scopeId,
				nodes: [buildTypeAst(sourceFile, typeNode.type, scopeBindings, scopeId)],
			})
		}

		return lex({ kind: "rawType", text: typeNode.getText(sourceFile), scopeId })
	}

	const collectTypeSurface = (
		sourceFile: ts.SourceFile,
		node: ts.Node,
		scopeBindings: string[],
		parentScopeId: string,
	) => {
		if (ts.isTypeAliasDeclaration(node)) {
			const localScopeId = createScope(sourceFile, node, "typeAlias", parentScopeId)
			const typeParams = node.typeParameters ?? []
			const typeParamBindings = typeParams.map(p => p.name.text)
			const localScope = [...scopeBindings, ...typeParamBindings]
			const typeParamStartIndex = entries.length
			for (const param of typeParams) {
				const binding = param.name.text
				createEntry(
					sourceFile,
					param.name,
					binding,
					"typeParam",
					{ kind: "typeParam", text: binding, name: binding, scopeId: localScopeId },
					localScope,
					localScopeId,
				)
			}
			const aliasAst = buildTypeAst(sourceFile, node.type, localScope, localScopeId)
			patchTypeParamParentRange(typeParamStartIndex, typeParamBindings.length, sourceFile, "typeDeclaration")
			createEntry(
				sourceFile,
				node,
				node.name.text,
				"typeDeclaration",
				aliasAst,
				localScope,
				localScopeId,
				collectTypeParameterArguments(sourceFile, node.typeParameters),
			)
			return
		}

		if (ts.isInterfaceDeclaration(node)) {
			const localScopeId = createScope(sourceFile, node, "interface", parentScopeId)
			const typeParams = node.typeParameters ?? []
			const typeParamBindings = typeParams.map(p => p.name.text)
			const localScope = [...scopeBindings, ...typeParamBindings]
			const typeParamStartIndex = entries.length
			for (const param of typeParams) {
				const binding = param.name.text
				createEntry(
					sourceFile,
					param.name,
					binding,
					"typeParam",
					{ kind: "typeParam", text: binding, name: binding, scopeId: localScopeId },
					localScope,
					localScopeId,
				)
			}
			const nodes: TypeAstNode[] = []
			for (const heritage of node.heritageClauses ?? []) {
				for (const typeExpr of heritage.types) {
					const typeRefNode: TypeAstNode = {
						kind: "typeRef",
						text: typeExpr.expression.getText(sourceFile),
						name: typeExpr.expression.getText(sourceFile),
						refName: typeExpr.expression.getText(sourceFile),
						pos: toPos(sourceFile, typeExpr.expression),
					}
					const typeRefArgs = typeExpr.typeArguments?.map(a =>
						buildTypeAst(sourceFile, a, localScope, localScopeId),
					)
					if (typeRefArgs && typeRefArgs.length > 0) {
						typeRefNode.nodes = typeRefArgs
					}
					nodes.push({
						kind: "heritage",
						text: typeExpr.getText(sourceFile),
						scopeId: localScopeId,
						nodes: [typeRefNode],
					})
				}
			}
			for (const member of node.members) {
				if ((ts.isPropertySignature(member) || ts.isMethodSignature(member)) && member.type) {
					nodes.push(buildTypeAst(sourceFile, member.type, localScope, localScopeId))
				}
			}
			patchTypeParamParentRange(typeParamStartIndex, typeParamBindings.length, sourceFile, "interface")
			createEntry(
				sourceFile,
				node,
				node.name.text,
				"interface",
				{ kind: "interface", text: node.getText(sourceFile), nodes, scopeId: localScopeId },
				localScope,
				localScopeId,
				collectTypeParameterArguments(sourceFile, node.typeParameters),
			)
			return
		}

		if (
			ts.isImportDeclaration(node) &&
			node.importClause?.isTypeOnly &&
			node.importClause.namedBindings &&
			ts.isNamedImports(node.importClause.namedBindings)
		) {
			const from = node.moduleSpecifier.getText(sourceFile)
			const modulePath = from.replace(/^['"]|['"]$/g, "")
			const currentFilePath = getLogicalFilePath(sourceFile)
			const resolvedRefFile = modulePath.startsWith(".")
				? refFileForTypeScriptTypeImport(resolveRelativeImportPath(currentFilePath, modulePath))
				: modulePath.startsWith("#")
					? refFileForTypeScriptTypeImport(resolveNodeImportSpecifier(modulePath) ?? modulePath)
					: modulePath
			for (const specifier of node.importClause.namedBindings.elements) {
				const importedName = specifier.name.text
				createEntry(
					sourceFile,
					specifier,
					importedName,
					"typeImport",
					{
						kind: "typeImport",
						text: specifier.getText(sourceFile),
						name: importedName,
						scopeId: parentScopeId,
						nodes: [{ kind: "module", text: from }],
					},
					scopeBindings,
					parentScopeId,
					undefined,
					resolvedRefFile,
				)
			}
			return
		}

		if (ts.isFunctionDeclaration(node) && node.name) {
			const fnScopeId = createScope(sourceFile, node, "function", parentScopeId)
			const typeParams = node.typeParameters ?? []
			const typeParamBindings = typeParams.map(p => p.name.text)
			const fnScope = [...scopeBindings, ...typeParamBindings]
			const typeParamStartIndex = entries.length
			for (const param of typeParams) {
				const binding = param.name.text
				createEntry(
					sourceFile,
					param.name,
					binding,
					"typeParam",
					{ kind: "typeParam", text: binding, name: binding, scopeId: fnScopeId },
					fnScope,
					fnScopeId,
				)
			}
			patchTypeParamParentRange(typeParamStartIndex, typeParamBindings.length, sourceFile, "functionEntity")
			createEntry(
				sourceFile,
				node,
				node.name.text,
				"functionEntity",
				{
					kind: "typeofExpr",
					text: `typeof ${node.name.text}`,
					name: node.name.text,
					scopeId: fnScopeId,
				},
				fnScope,
				fnScopeId,
				collectTypeParameterArguments(sourceFile, node.typeParameters),
			)
			if (node.type) {
				createEntry(
					sourceFile,
					node.type,
					undefined,
					"functionReturn",
					buildTypeAst(sourceFile, node.type, fnScope, fnScopeId),
					fnScope,
					fnScopeId,
				)
			}
			for (const param of node.parameters) {
				if (param.type) {
					createEntry(
						sourceFile,
						param.type,
						param.name.getText(sourceFile),
						"functionParam",
						buildTypeAst(sourceFile, param.type, fnScope, fnScopeId),
						fnScope,
						fnScopeId,
					)
				}
			}
			return
		}

		if (ts.isVariableDeclaration(node) && node.type) {
			const localScopeId = createScope(sourceFile, node, "variable", parentScopeId)
			const name = ts.isIdentifier(node.name) ? node.name.text : undefined
			createEntry(
				sourceFile,
				node,
				name,
				"variable",
				buildTypeAst(sourceFile, node.type, scopeBindings, localScopeId),
				scopeBindings,
				localScopeId,
			)
			return
		}

		if (ts.isClassDeclaration(node) && node.name) {
			const classScopeId = createScope(sourceFile, node, "class", parentScopeId)
			const classTypeParams = node.typeParameters ?? []
			const classTypeParamBindings = classTypeParams.map(p => p.name.text)
			const classScopeBindings = [...scopeBindings, ...classTypeParamBindings]
			const typeParamStartIndex = entries.length
			for (const param of classTypeParams) {
				const binding = param.name.text
				createEntry(
					sourceFile,
					param.name,
					binding,
					"typeParam",
					{ kind: "typeParam", text: binding, name: binding, scopeId: classScopeId },
					classScopeBindings,
					classScopeId,
				)
			}
			patchTypeParamParentRange(typeParamStartIndex, classTypeParamBindings.length, sourceFile, "classEntity")
			createEntry(
				sourceFile,
				node,
				node.name.text,
				"classEntity",
				{
					kind: "typeofExpr",
					text: `typeof ${node.name.text}`,
					name: node.name.text,
					scopeId: classScopeId,
				},
				classScopeBindings,
				classScopeId,
				collectTypeParameterArguments(sourceFile, node.typeParameters),
			)
			for (const heritage of node.heritageClauses ?? []) {
				for (const typeExpr of heritage.types) {
					const heritageAst: TypeAstNode = {
						kind: "typeRef",
						text: typeExpr.expression.getText(sourceFile),
						name: typeExpr.expression.getText(sourceFile),
						refName: typeExpr.expression.getText(sourceFile),
						scopeId: classScopeId,
						pos: toPos(sourceFile, typeExpr.expression),
					}
					const args = typeExpr.typeArguments?.map(a =>
						buildTypeAst(sourceFile, a, classScopeBindings, classScopeId),
					)
					if (args && args.length > 0) {
						heritageAst.nodes = args
					}
					createEntry(
						sourceFile,
						typeExpr,
						undefined,
						"classHeritage",
						heritageAst,
						classScopeBindings,
						classScopeId,
					)
				}
			}
			for (const member of node.members) {
				if (ts.isPropertyDeclaration(member) && member.type) {
					createEntry(
						sourceFile,
						member,
						member.name.getText(sourceFile),
						"classProperty",
						buildTypeAst(sourceFile, member.type, classScopeBindings, classScopeId),
						classScopeBindings,
						classScopeId,
					)
				}
				if (ts.isMethodDeclaration(member)) {
					const methodScopeId = createScope(sourceFile, member, "classMethod", classScopeId)
					const methodName = member.name.getText(sourceFile)
					const methodTypeParamNodes = member.typeParameters ?? []
					const methodTypeParams = methodTypeParamNodes.map(p => p.name.text)
					const methodScope = [...classScopeBindings, ...methodTypeParams]
					const typeParamStartIndex = entries.length
					for (const param of methodTypeParamNodes) {
						const binding = param.name.text
						createEntry(
							sourceFile,
							param.name,
							binding,
							"typeParam",
							{ kind: "typeParam", text: binding, name: binding, scopeId: methodScopeId },
							classScopeBindings,
							methodScopeId,
						)
					}
					patchTypeParamParentRange(
						typeParamStartIndex,
						methodTypeParams.length,
						sourceFile,
						"classMethodEntity",
					)
					createEntry(
						sourceFile,
						member,
						methodName,
						"classMethodEntity",
						{
							kind: "methodType",
							text: member.getText(sourceFile),
							scopeId: methodScopeId,
						},
						methodScope,
						methodScopeId,
						collectTypeParameterArguments(sourceFile, member.typeParameters),
					)
					if (member.type) {
						createEntry(
							sourceFile,
							member.type,
							undefined,
							"classMethodReturn",
							buildTypeAst(sourceFile, member.type, methodScope, methodScopeId),
							methodScope,
							methodScopeId,
						)
					}
					for (const param of member.parameters) {
						if (param.type) {
							createEntry(
								sourceFile,
								param.type,
								param.name.getText(sourceFile),
								"classMethodParam",
								buildTypeAst(sourceFile, param.type, methodScope, methodScopeId),
								methodScope,
								methodScopeId,
							)
						}
					}
				}
			}
			return
		}

		if (ts.isPropertySignature(node) && node.type) {
			const localScopeId = createScope(sourceFile, node, "propertySignature", parentScopeId)
			createEntry(
				sourceFile,
				node,
				node.name.getText(sourceFile),
				"propertySignature",
				buildTypeAst(sourceFile, node.type, scopeBindings, localScopeId),
				scopeBindings,
				localScopeId,
			)
			return
		}

		if (ts.isMethodSignature(node)) {
			const localScopeId = createScope(sourceFile, node, "methodSignature", parentScopeId)
			const methodTypeParamNodes = node.typeParameters ?? []
			const methodTypeParams = methodTypeParamNodes.map(p => p.name.text)
			const methodScope = [...scopeBindings, ...methodTypeParams]
			const typeParamStartIndex = entries.length
			for (const param of methodTypeParamNodes) {
				const binding = param.name.text
				createEntry(
					sourceFile,
					param.name,
					binding,
					"typeParam",
					{ kind: "typeParam", text: binding, name: binding, scopeId: localScopeId },
					methodScope,
					localScopeId,
				)
			}
			patchTypeParamParentRange(typeParamStartIndex, methodTypeParams.length, sourceFile, "methodSignatureEntity")
			createEntry(
				sourceFile,
				node,
				node.name.getText(sourceFile),
				"methodSignatureEntity",
				{
					kind: "methodType",
					text: node.getText(sourceFile),
					scopeId: localScopeId,
				},
				methodScope,
				localScopeId,
				collectTypeParameterArguments(sourceFile, node.typeParameters),
			)
			if (node.type) {
				createEntry(
					sourceFile,
					node.type,
					node.name.getText(sourceFile),
					"methodSignatureReturn",
					buildTypeAst(sourceFile, node.type, methodScope, localScopeId),
					methodScope,
					localScopeId,
				)
			}
			for (const param of node.parameters) {
				if (param.type) {
					createEntry(
						sourceFile,
						param.type,
						param.name.getText(sourceFile),
						"methodSignatureParam",
						buildTypeAst(sourceFile, param.type, methodScope, localScopeId),
						methodScope,
						localScopeId,
					)
				}
			}
			return
		}

		if (ts.isParameter(node) && node.type && !isPlainIdentifierType(node.type)) {
			const localScopeId = createScope(sourceFile, node, "anonymousParam", parentScopeId)
			createEntry(
				sourceFile,
				node,
				node.name.getText(sourceFile),
				"anonymousParam",
				buildTypeAst(sourceFile, node.type, scopeBindings, localScopeId),
				scopeBindings,
				localScopeId,
			)
			return
		}
	}

	for (const file of files) {
		const sourceFile = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
		sourceFilePathByName.set(sourceFile.fileName, file.path)
		const fileScopeId = createScope(sourceFile, sourceFile, "file")
		const visit = (node: ts.Node, scopeBindings: string[], scopeId: string) => {
			collectTypeSurface(sourceFile, node, scopeBindings, scopeId)
			ts.forEachChild(node, child => visit(child, scopeBindings, scopeId))
		}
		visit(sourceFile, [], fileScopeId)
	}

	const resolveRef = (
		entry: TypeEntry,
		refName: string | undefined,
		lexicalBindings: readonly string[],
		refPos: SourcePos | undefined,
	): string | undefined => {
		if (!refName) return undefined
		const refStart = refPos?.start ?? entry.pos.start
		let localImportBest: TypeEntry | undefined
		for (let j = 0; j < entries.length; j += 1) {
			const candidate = entries[j]
			if (!candidate) continue
			if (candidate.name !== refName) continue
			if (candidate.file !== entry.file) continue
			if (candidate.sourceKind !== "typeImport") continue
			if (candidate.pos.start > refStart) continue
			if (!localImportBest || candidate.pos.start >= localImportBest.pos.start) {
				localImportBest = candidate
			}
		}
		if (localImportBest) {
			return localImportBest.id
		}
		for (let i = lexicalBindings.length - 1; i >= 0; i -= 1) {
			const scopeName = lexicalBindings[i]
			if (scopeName !== refName) continue
			let localBest: TypeEntry | undefined
			for (let j = 0; j < entries.length; j += 1) {
				const candidate = entries[j]
				if (!candidate) continue
				if (candidate.name !== refName) continue
				if (candidate.file !== entry.file) continue
				if (candidate.sourceKind !== "typeParam" && candidate.sourceKind !== "typeInfer") continue
				if (candidate.pos.start > refStart) continue
				if (!localBest || candidate.pos.start >= localBest.pos.start) {
					localBest = candidate
				}
			}
			if (localBest) {
				return localBest.id
			}
		}
		const ids = globalRefs.get(refName)
		return ids?.[ids.length - 1]
	}

	const patchRefs = (entry: TypeEntry, node: TypeAstNode, fallbackLexical: readonly string[]) => {
		const lexical = node.lexicalBindings ?? fallbackLexical
		if (node.refName) {
			const resolved = resolveRef(entry, node.refName, lexical, node.pos)
			if (resolved) {
				node.refId = resolved
				addScopeTypeRef(node.scopeId ?? entry.scopeId, {
					typeId: resolved,
					pos: node.pos ?? entry.pos,
				})
			}
			delete node.refName
		}
		for (const child of node.nodes ?? []) {
			patchRefs(entry, child, child.lexicalBindings ?? lexical)
		}

		if (node.kind === "typeRef" && node.refId) {
			const collectArgRefs = (candidate: TypeAstNode, target: TypeReference[]) => {
				if (candidate.refId) {
					target.push({
						typeId: candidate.refId,
						pos: candidate.pos ?? entry.pos,
					})
				}
				for (const nested of candidate.nodes ?? []) {
					collectArgRefs(nested, target)
				}
			}
			const argumentsList: { refs: TypeReference[] }[] = []
			for (const arg of node.nodes ?? []) {
				const refsForArg: TypeReference[] = []
				collectArgRefs(arg, refsForArg)
				argumentsList.push({
					refs: refsForArg,
				})
			}
			if ((node.nodes?.length ?? 0) > 0) {
				addScopeCall(node.scopeId ?? entry.scopeId, node.refId, argumentsList)
			}
		}
	}
	const collectRefIdsFromAst = (node: TypeAstNode, ids: Set<string>) => {
		if (node.refId) {
			ids.add(node.refId)
		}
		for (const child of node.nodes ?? []) {
			collectRefIdsFromAst(child, ids)
		}
	}

	for (const entry of entries) {
		if (entry.ast) {
			patchRefs(entry, entry.ast, entry.scope.bindings)
		}
		const pendingArgs = pendingTypeArguments.get(entry.id) ?? []
		entry.arguments = pendingArgs.map(pendingArg => {
			const resolveRefNames = (refNames: readonly string[]) =>
				[...new Set(refNames)]
					.map(refName => resolveRef(entry, refName, entry.scope.bindings, entry.pos))
					.filter((refId): refId is string => !!refId)
					.map(typeId => ({ typeId }))
			const mergedNames = [...pendingArg.constraintRefNames, ...pendingArg.defaultRefNames]
			const refs = resolveRefNames(mergedNames)
			const constraintRefs = resolveRefNames(pendingArg.constraintRefNames)
			return { comments: pendingArg.comments, refs, constraintRefs }
		})
	}

	for (const scope of scopes) {
		scope.refs = [...(scopeTypeRefs.get(scope.id) ?? [])]
		scope.calls = [...(scopeCalls.get(scope.id) ?? [])]
	}
	const inferBuiltFrom = new Map<string, Set<string>>()
	for (const [scopeId, inferIds] of conditionalScopeInferEntryIds.entries()) {
		const checkNode = conditionalScopeCheckNode.get(scopeId)
		if (!checkNode) continue
		const refIds = new Set<string>()
		collectRefIdsFromAst(checkNode, refIds)
		for (const inferId of inferIds) {
			inferBuiltFrom.set(inferId, new Set(refIds))
		}
	}
	const typeRefScopes = new Map<string, Set<string>>()
	for (const scope of scopes) {
		for (const ref of scope.refs) {
			const ids = typeRefScopes.get(ref.typeId)
			if (ids) {
				ids.add(scope.id)
				continue
			}
			typeRefScopes.set(ref.typeId, new Set([scope.id]))
		}
	}
	for (const entry of entries) {
		entry.refScopes = [...(typeRefScopes.get(entry.id) ?? new Set())].map(scopeId => ({ scopeId }))
		const builtFromIds =
			entry.sourceKind === "typeInfer" ? new Set(inferBuiltFrom.get(entry.id) ?? []) : new Set<string>()
		builtFromIds.delete(entry.id)
		entry.builtFrom = [...builtFromIds].map(typeId => ({ typeId }))
		if (!includeAst) {
			delete entry.ast
		}
	}
	for (const scope of scopes) {
		if (!scope.parentScopeId) continue
		const parentScope = scopes.find(candidate => candidate.id === scope.parentScopeId)
		if (!parentScope) continue
		parentScope.children.push({ scopeId: scope.id })
	}

	return { types: entries, scopes }
}
