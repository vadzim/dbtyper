import type { ReadTypesResult, ScopeEntry, TypeAstNode, TypeEntry, TypeReference } from "./read-types.ts"

export type OpaqueViolation = {
	message: string
	file?: string
	ref?: TypeReference
	relatedFile?: string
	relatedRef?: TypeReference
}

export type GetOpaqueViolationsOptions = {
	fileName: string
	typeName: string
}

export function getOpaqueViolations(
	readTypesResult: ReadTypesResult,
	opaqueType: GetOpaqueViolationsOptions,
): OpaqueViolation[] {
	const opaqueModuleFile = opaqueType.fileName
	const typesById = new Map(readTypesResult.types.map(type => [type.id, type]))
	const scopesById = new Map(readTypesResult.scopes.map(scope => [scope.id, scope]))
	const opaqueTypeIds = new Set(
		readTypesResult.types
			.filter(type => type.name === opaqueType.typeName && type.refFile === opaqueType.fileName)
			.map(type => type.id),
	)
	if (opaqueTypeIds.size === 0) return []

	const constrainedTypeIds = new Set<string>()

	for (const type of readTypesResult.types) {
		if (type.sourceKind !== "typeParam") continue
		if (type.file === opaqueModuleFile) continue
		const parent = typesById.get(type.parent.typeId)
		if (!parent) continue
		const arg = parent.arguments[type.parent.argumentIndex]
		if (!arg) continue
		if (arg.refs.some(ref => opaqueTypeIds.has(ref.typeId))) {
			constrainedTypeIds.add(type.id)
		}
	}

	const opaqueNames = new Set(
		[...opaqueTypeIds]
			.map(typeId => {
				const type = typesById.get(typeId)
				return type ? type.name : undefined
			})
			.filter((name): name is string => Boolean(name)),
	)

	for (const type of readTypesResult.types) {
		if (type.sourceKind !== "typeInfer" || !type.name) continue
		if (type.file === opaqueModuleFile) continue
		if (isInferEntryConstrainedByOpaque(type, readTypesResult.types, scopesById, opaqueNames)) {
			constrainedTypeIds.add(type.id)
		}
	}

	if (constrainedTypeIds.size === 0) return []
	const checkSideReferences = collectCheckSideReferences(readTypesResult)
	const violations: OpaqueViolation[] = []
	const pushViolation = (
		message: string,
		file: string | undefined,
		ref: TypeReference,
		relatedFile?: string,
		relatedRef?: TypeReference,
	) => {
		const result: OpaqueViolation = { message, ref }
		if (file !== undefined) result.file = file
		if (relatedFile !== undefined && relatedRef !== undefined) {
			result.relatedFile = relatedFile
			result.relatedRef = relatedRef
		}
		violations.push(result)
	}

	for (const scope of readTypesResult.scopes) {
		if (scope.kind !== "conditionalCondition") continue
		for (const ref of scope.refs) {
			if (!constrainedTypeIds.has(ref.typeId)) continue
			if (!checkSideReferences.has(refKey(ref.typeId, ref.pos.start))) continue
			const variable = typesById.get(ref.typeId)
			const variableName = variable ? variable.name : "unknown"
			pushViolation(
				`Opaque-constrained type variable ${variableName} cannot be used in extends condition`,
				scope.file,
				ref,
			)
		}
	}

	for (const scope of readTypesResult.scopes) {
		if (scope.kind !== "conditionalTrueBranch" && scope.kind !== "conditionalFalseBranch") continue
		const refs = listRefsInBranchWithoutNestedConditionals(scope.id, scopesById)
			.filter(({ ref }) => constrainedTypeIds.has(ref.typeId))
			.toArray()
		for (const [typeId, group] of groupRefsByTypeId(refs)) {
			const count = group.length
			if (count < 2) continue
			const variable = typesById.get(typeId)
			const variableName = variable ? variable.name : "unknown"
			const first = group[0]
			const second = group[1]
			if (!first || !second) continue
			pushViolation(
				`Opaque-constrained type variable ${variableName} cannot be used more than once in the same ternary branch`,
				scopesById.get(second.scopeId)?.file,
				second.ref,
				scopesById.get(first.scopeId)?.file,
				first.ref,
			)
		}
	}

	for (const conditionScope of readTypesResult.scopes) {
		if (conditionScope.kind !== "conditionalCondition") continue
		const localConstrainedRefs = conditionScope.refs.filter(ref => constrainedTypeIds.has(ref.typeId))
		const trueBranch = conditionScope.children
			.map(child => scopesById.get(child.scopeId))
			.find(scope => scope !== undefined && scope.kind === "conditionalTrueBranch")
		const falseBranch = conditionScope.children
			.map(child => scopesById.get(child.scopeId))
			.find(scope => scope !== undefined && scope.kind === "conditionalFalseBranch")
		const branchRefs = [
			...(trueBranch ? [...listRefsInBranchWithoutNestedConditionals(trueBranch.id, scopesById)] : []),
			...(falseBranch ? [...listRefsInBranchWithoutNestedConditionals(falseBranch.id, scopesById)] : []),
		]
			.filter(({ ref }) => constrainedTypeIds.has(ref.typeId))
		for (const [typeId, group] of groupRefsByTypeId([
			...localConstrainedRefs.map(ref => ({ scopeId: conditionScope.id, ref })),
			...branchRefs,
		])) {
			const count = group.length
			if (count < 2) continue
			const variable = typesById.get(typeId)
			const variableName = variable ? variable.name : "unknown"
			const first = group[0]
			const second = group[1]
			if (!first || !second) continue
			pushViolation(
				`Opaque-constrained type variable ${variableName} cannot be used more than once in one conditional body`,
				scopesById.get(second.scopeId)?.file,
				second.ref,
				scopesById.get(first.scopeId)?.file,
				first.ref,
			)
		}
	}

	for (const declaration of readTypesResult.types) {
		if (declaration.sourceKind !== "typeDeclaration") continue
		const outsideRefs = listRefsWithScope(declaration.scopeId, scopesById)
			.filter(({ scopeId, ref }) => constrainedTypeIds.has(ref.typeId) && !isInConditionalScope(scopeId, scopesById))
			.toArray()
		for (const [typeId, group] of groupRefsByTypeId(outsideRefs)) {
			const count = group.length
			if (count < 2) continue
			const variable = typesById.get(typeId)
			const variableName = variable ? variable.name : "unknown"
			const first = group[0]
			const second = group[1]
			if (!first || !second) continue
			pushViolation(
				`Opaque-constrained type variable ${variableName} cannot be used more than once outside ternary body`,
				scopesById.get(second.scopeId)?.file,
				second.ref,
				scopesById.get(first.scopeId)?.file,
				first.ref,
			)
		}
	}

	for (const scope of readTypesResult.scopes) {
		for (const call of scope.calls) {
			const callee = typesById.get(call.calleeTypeId)
			if (!callee || callee.sourceKind !== "typeDeclaration") continue
			for (const [argumentIndex, arg] of call.arguments.entries()) {
				const passedOpaqueVariable = arg.refs.find(ref => constrainedTypeIds.has(ref.typeId))
				if (!passedOpaqueVariable) continue
				const calleeParam = readTypesResult.types.find(
					type =>
						type.sourceKind === "typeParam" &&
						type.parent.typeId === callee.id &&
						type.parent.argumentIndex === argumentIndex,
				)
				const hasOpaqueConstraint =
					Boolean(callee.arguments[argumentIndex]) &&
					(callee.arguments[argumentIndex] ?? never()).refs.some(ref => opaqueTypeIds.has(ref.typeId))
				const destructuresArgument = calleeParam
					? isTypeParamUsedInConditionalCheck(calleeParam.id, callee.ast)
					: false
				if (hasOpaqueConstraint && !destructuresArgument) continue
				const variable = typesById.get(passedOpaqueVariable.typeId)
				const variableName = variable ? variable.name : "unknown"
				const calleeName = callee.name || "unknown"
				if (!hasOpaqueConstraint) {
					pushViolation(
						`Opaque-constrained type variable ${variableName} cannot be passed to generic ${calleeName} without extends constraint`,
						scope.file,
						passedOpaqueVariable,
					)
					continue
				}
				pushViolation(
					`Opaque-constrained type variable ${variableName} cannot be passed to generic ${calleeName} that destructures this argument`,
					scope.file,
					passedOpaqueVariable,
				)
			}
		}
	}

	return violations
}

function collectCheckSideReferences(readTypesResult: ReadTypesResult): Set<string> {
	const refs = new Set<string>()
	for (const type of readTypesResult.types) {
		if (!type.ast) continue
		collectConditionalCheckRefs(type.ast, refs)
	}
	return refs
}

function collectConditionalCheckRefs(node: TypeAstNode, out: Set<string>) {
	const checkNode = node.kind === "conditional" ? (node.nodes ? node.nodes[0] : undefined) : undefined
	if (checkNode) {
		collectDirectCheckTypeRefs(checkNode, out)
	}
	for (const child of node.nodes ?? []) {
		collectConditionalCheckRefs(child, out)
	}
}

function collectDirectCheckTypeRefs(node: TypeAstNode, out: Set<string>) {
	const current = unwrapParenthesized(node)
	if (current.refId && current.pos) {
		out.add(refKey(current.refId, current.pos.start))
	}
}

function unwrapParenthesized(node: TypeAstNode): TypeAstNode {
	let current = node
	while (current.kind === "parenthesized" && current.nodes && current.nodes[0]) {
		current = current.nodes[0]
	}
	return current
}

function collectAllTypeRefs(node: TypeAstNode, out: Set<string>) {
	if (node.refId && node.pos) {
		out.add(refKey(node.refId, node.pos.start))
	}
	for (const child of node.nodes ?? []) {
		collectAllTypeRefs(child, out)
	}
}

function refKey(typeId: string, start: number): string {
	return `${typeId}:${start}`
}

function isInConditionalScope(scopeId: string, scopesById: Map<string, ScopeEntry>): boolean {
	let current = scopesById.get(scopeId)
	while (current) {
		if (
			current.kind === "conditionalCondition" ||
			current.kind === "conditionalTrueBranch" ||
			current.kind === "conditionalFalseBranch"
		) {
			return true
		}
		current = current.parentScopeId ? scopesById.get(current.parentScopeId) : undefined
	}
	return false
}

function* listRefsWithScope(
	scopeId: string,
	scopesById: Map<string, ScopeEntry>,
): Generator<{ scopeId: string; ref: ScopeEntry["refs"][number] }> {
	const scope = scopesById.get(scopeId)
	if (!scope) return
	for (const ref of scope.refs) {
		yield { scopeId: scope.id, ref }
	}
	for (const child of scope.children) {
		yield* listRefsWithScope(child.scopeId, scopesById)
	}
}

function* listRefsInBranchWithoutNestedConditionals(
	scopeId: string,
	scopesById: Map<string, ScopeEntry>,
): Generator<{ scopeId: string; ref: ScopeEntry["refs"][number] }> {
	const scope = scopesById.get(scopeId)
	if (!scope) return
	for (const ref of scope.refs) {
		yield { scopeId: scope.id, ref }
	}
	for (const child of scope.children) {
		const childScope = scopesById.get(child.scopeId)
		if (!childScope) continue
		const isNestedConditionalScope =
			childScope.kind === "conditionalCondition" ||
			childScope.kind === "conditionalTrueBranch" ||
			childScope.kind === "conditionalFalseBranch"
		if (isNestedConditionalScope) continue
		yield* listRefsInBranchWithoutNestedConditionals(child.scopeId, scopesById)
	}
}

function groupRefsByTypeId(
	refs: { scopeId: string; ref: ScopeEntry["refs"][number] }[],
): Map<string, { scopeId: string; ref: ScopeEntry["refs"][number] }[]> {
	const groups = new Map<string, { scopeId: string; ref: ScopeEntry["refs"][number] }[]>()
	for (const entry of refs) {
		const existing = groups.get(entry.ref.typeId)
		if (existing) existing.push(entry)
		else groups.set(entry.ref.typeId, [entry])
	}
	return groups
}

function isTypeParamUsedInConditionalCheck(typeParamId: string, declarationAst?: TypeAstNode): boolean {
	if (!declarationAst) return false
	const checkRefTypeIds = new Set<string>()
	collectConditionalCheckTypeIds(declarationAst, checkRefTypeIds)
	return checkRefTypeIds.has(typeParamId)
}

function collectConditionalCheckTypeIds(node: TypeAstNode, out: Set<string>) {
	if (node.kind === "conditional" && node.nodes && node.nodes[0]) {
		collectAllRefTypeIds(node.nodes[0], out)
	}
	for (const child of node.nodes ?? []) {
		collectConditionalCheckTypeIds(child, out)
	}
}

function collectAllRefTypeIds(node: TypeAstNode, out: Set<string>) {
	if (node.refId) out.add(node.refId)
	for (const child of node.nodes ?? []) {
		collectAllRefTypeIds(child, out)
	}
}

function isInferEntryConstrainedByOpaque(
	inferEntry: TypeEntry,
	types: TypeEntry[],
	scopesById: Map<string, ScopeEntry>,
	opaqueNames: Set<string>,
): boolean {
	const declarationScopeId = findEnclosingTypeAliasScopeId(inferEntry.scopeId, scopesById)
	if (!declarationScopeId) return false
	const declaration = types.find(type => type.sourceKind === "typeDeclaration" && type.scopeId === declarationScopeId)
	if (!declaration) return false
	if (!declaration.ast) return false
	return isInferConstrainedByOpaque(declaration.ast.text, inferEntry.name, opaqueNames)
}

function findEnclosingTypeAliasScopeId(
	scopeId: string,
	scopesById: Map<string, ScopeEntry>,
): string | undefined {
	let current = scopesById.get(scopeId)
	while (current) {
		if (current.kind === "typeAlias") return current.id
		current = current.parentScopeId ? scopesById.get(current.parentScopeId) : undefined
	}
	return undefined
}

function isInferConstrainedByOpaque(text: string, inferName: string, opaqueNames: Set<string>): boolean {
	for (const opaqueName of opaqueNames) {
		const pattern = new RegExp(`\\binfer\\s+${escapeRegex(inferName)}\\s+extends\\s+${escapeRegex(opaqueName)}\\b`)
		if (pattern.test(text)) return true
	}
	return false
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function never(): never {
	throw new Error("never")
}
