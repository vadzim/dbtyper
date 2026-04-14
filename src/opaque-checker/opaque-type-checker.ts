import type {
	ReadTypesResult,
	ScopeCall,
	ScopeEntry,
	TypeAstNode,
	TypeEntry,
	TypeReference,
} from "./read-types.ts"

export type OpaqueViolation = {
	message: string
	file?: string
	ref?: TypeReference
	relatedFile?: string
	relatedRef?: TypeReference
}

export type OpaqueConsumerRegistration = {
	fileName: string
	typeName: string
	/**
	 * When omitted or empty, every type parameter of this generic is a consumer slot.
	 * When set, only these 0-based indices (of the consumer generic’s own type parameters).
	 */
	typeArgumentIndexes?: number[]
}

/** Parse `MyConsumer`, `MyConsumer:0`, or `MyConsumer:1:2` (0-based indices after the first `:`). */
export function parseConsumeTypeSpec(spec: string): { typeName: string; typeArgumentIndexes?: number[] } {
	const parts = spec.split(":")
	const typeName = (parts[0] ?? "").trim()
	if (typeName.length === 0) {
		throw new Error("consume spec: empty type name")
	}
	if (parts.length === 1) {
		return { typeName }
	}
	const indexParts = parts.slice(1)
	if (indexParts.some(p => p.trim() === "" || !/^\d+$/.test(p.trim()))) {
		throw new Error(`consume spec: invalid index segment in ${JSON.stringify(spec)}`)
	}
	const typeArgumentIndexes = indexParts.map(p => Number.parseInt(p.trim(), 10))
	return { typeName, typeArgumentIndexes }
}

export type GetOpaqueViolationsOptions = {
	fileName: string
	typeName: string
	/** Types that carry/consume opaque values; `extends Consumer` is treated like `extends Opaque` for constraints. */
	opaqueConsumers?: OpaqueConsumerRegistration[]
}

type ResolvedOpaqueConsumer = {
	declarationId: string
	/** Omitted when all type parameters are consumer slots. */
	typeArgumentIndexes?: number[]
}

/** 0-based type-parameter indices that consume opaque (registered + derived). */
type ConsumerSlotsByDeclaration = Map<string, Set<number>>

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

	const consumerTypeIds = new Set<string>()
	const resolvedConsumers: ResolvedOpaqueConsumer[] = []
	for (const consumer of opaqueType.opaqueConsumers ?? []) {
		for (const type of readTypesResult.types) {
			if (type.name === consumer.typeName && type.refFile === consumer.fileName) {
				consumerTypeIds.add(type.id)
			}
		}
		const decl = readTypesResult.types.find(
			t =>
				t.sourceKind === "typeDeclaration" && t.name === consumer.typeName && t.refFile === consumer.fileName,
		)
		if (decl) {
			const indexes = consumer.typeArgumentIndexes
			if (indexes !== undefined && indexes.length > 0) {
				resolvedConsumers.push({ declarationId: decl.id, typeArgumentIndexes: indexes })
			} else {
				resolvedConsumers.push({ declarationId: decl.id })
			}
		}
	}

	const constraintLeafTypeIds = new Set<string>([...opaqueTypeIds, ...consumerTypeIds])

	const skippedFilesForOpaqueRules = new Set<string>([opaqueModuleFile])
	for (const consumer of opaqueType.opaqueConsumers ?? []) {
		skippedFilesForOpaqueRules.add(consumer.fileName)
	}

	const constrainedTypeIds = new Set<string>()

	for (const type of readTypesResult.types) {
		if (type.sourceKind !== "typeParam") continue
		if (skippedFilesForOpaqueRules.has(type.file)) continue
		const parent = typesById.get(type.parent.typeId)
		if (!parent) continue
		const arg = parent.arguments[type.parent.argumentIndex]
		if (!arg) continue
		if (arg.constraintRefs.some(ref => opaqueTypeIds.has(ref.typeId))) {
			constrainedTypeIds.add(type.id)
			continue
		}
		for (const ref of arg.constraintRefs) {
			if (!consumerTypeIds.has(ref.typeId)) continue
			const reg = resolvedConsumers.find(r => r.declarationId === ref.typeId)
			if (!reg) continue
			const decl = typesById.get(reg.declarationId) ?? never()
			if (
				consumerConstraintAppliesToTypeParam(
					decl,
					reg.typeArgumentIndexes,
					parent,
					type.parent.argumentIndex,
				)
			) {
				constrainedTypeIds.add(type.id)
				break
			}
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
	for (const consumer of opaqueType.opaqueConsumers ?? []) {
		opaqueNames.add(consumer.typeName)
	}

	for (const type of readTypesResult.types) {
		if (type.sourceKind !== "typeInfer" || !type.name) continue
		if (skippedFilesForOpaqueRules.has(type.file)) continue
		if (isInferEntryConstrainedByOpaque(type, readTypesResult.types, scopesById, opaqueNames)) {
			constrainedTypeIds.add(type.id)
		}
	}

	const consumerSlotsByDecl = buildConsumerSlotsByDeclarationGraph(
		readTypesResult,
		typesById,
		resolvedConsumers,
	)

	const linearReuseExcludeRefKeys = buildLinearReuseExcludeRefKeys(
		readTypesResult,
		typesById,
		constrainedTypeIds,
		consumerSlotsByDecl,
		constraintLeafTypeIds,
	)

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
			.filter(
				({ ref }) =>
					constrainedTypeIds.has(ref.typeId) &&
					!linearReuseExcludeRefKeys.has(refKey(ref.typeId, ref.pos.start)),
			)
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
		const localConstrainedRefs = conditionScope.refs.filter(
			ref =>
				constrainedTypeIds.has(ref.typeId) &&
				!linearReuseExcludeRefKeys.has(refKey(ref.typeId, ref.pos.start)),
		)
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
			.filter(
				({ ref }) =>
					constrainedTypeIds.has(ref.typeId) &&
					!linearReuseExcludeRefKeys.has(refKey(ref.typeId, ref.pos.start)),
			)
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
			.filter(
				({ scopeId, ref }) =>
					constrainedTypeIds.has(ref.typeId) &&
					!isInConditionalScope(scopeId, scopesById) &&
					!linearReuseExcludeRefKeys.has(refKey(ref.typeId, ref.pos.start)),
			)
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
			const callee = resolveCalleeTypeDeclaration(typesById.get(call.calleeTypeId), readTypesResult.types)
			if (!callee || callee.sourceKind !== "typeDeclaration") continue
			for (const [argumentIndex, arg] of call.arguments.entries()) {
				const passedOpaqueVariable = arg.refs.find(ref => constrainedTypeIds.has(ref.typeId))
				if (!passedOpaqueVariable) continue
				if (!shouldApplyConsumerSlotForCallee(callee, argumentIndex, consumerSlotsByDecl, typesById)) {
					continue
				}
				const calleeParam = readTypesResult.types.find(
					type =>
						type.sourceKind === "typeParam" &&
						type.parent.typeId === callee.id &&
						type.parent.argumentIndex === argumentIndex,
				)
				const calleeParamArg = callee.arguments[argumentIndex]
				const exactOpaqueOrConsumerConstraint =
					calleeParamArg !== undefined &&
					calleeParamArg.constraintRefs.length === 1 &&
					constraintLeafTypeIds.has((calleeParamArg.constraintRefs[0] ?? never()).typeId)
				if (exactOpaqueOrConsumerConstraint) continue
				const variable = typesById.get(passedOpaqueVariable.typeId)
				const variableName = variable ? variable.name : "unknown"
				const calleeName = callee.name || "unknown"
				if (!exactOpaqueOrConsumerConstraint) {
					pushViolation(
						`Opaque-constrained type variable ${variableName} cannot be passed to generic ${calleeName} without a configured opaque or consumer extends only`,
						scope.file,
						passedOpaqueVariable,
					)
					continue
				}
			}
		}
	}

	if (consumerSlotsByDecl.size > 0) {
		const branchScopesForConsumers = readTypesResult.scopes.filter(
			s => s.kind === "conditionalTrueBranch" || s.kind === "conditionalFalseBranch",
		)
		for (const branchScope of branchScopesForConsumers) {
			const calls = [...listCallsInBranchWithoutNestedConditionals(branchScope.id, scopesById)]
			pushConsumerLinearityViolations(
				calls,
				readTypesResult,
				typesById,
				scopesById,
				constrainedTypeIds,
				consumerSlotsByDecl,
				constraintLeafTypeIds,
				pushViolation,
			)
		}
		for (const declaration of readTypesResult.types) {
			if (declaration.sourceKind !== "typeDeclaration") continue
			const calls = [...listCallsInBranchWithoutNestedConditionals(declaration.scopeId, scopesById)]
			pushConsumerLinearityViolations(
				calls,
				readTypesResult,
				typesById,
				scopesById,
				constrainedTypeIds,
				consumerSlotsByDecl,
				constraintLeafTypeIds,
				pushViolation,
			)
		}
	}

	return violations
}

function buildConsumerSlotsByDeclarationGraph(
	readTypesResult: ReadTypesResult,
	typesById: Map<string, TypeEntry>,
	resolvedConsumers: ResolvedOpaqueConsumer[],
): ConsumerSlotsByDeclaration {
	const out: ConsumerSlotsByDeclaration = new Map()
	const addSlots = (declarationId: string, slots: Iterable<number>) => {
		let set = out.get(declarationId)
		if (!set) {
			set = new Set()
			out.set(declarationId, set)
		}
		for (const s of slots) set.add(s)
	}
	for (const r of resolvedConsumers) {
		const decl = typesById.get(r.declarationId)
		if (!decl) continue
		const arity = decl.arguments.length
		if (!r.typeArgumentIndexes || r.typeArgumentIndexes.length === 0) {
			for (let i = 0; i < arity; i += 1) addSlots(r.declarationId, [i])
		} else {
			addSlots(r.declarationId, r.typeArgumentIndexes)
		}
	}
	if (out.size === 0) return out

	const ownTypeParamIdsOrdered = (decl: TypeEntry): string[] => {
		const params = readTypesResult.types.filter(
			t => t.sourceKind === "typeParam" && t.parent.typeId === decl.id,
		)
		params.sort((a, b) => a.parent.argumentIndex - b.parent.argumentIndex)
		return params.map(p => p.id)
	}

	let changed = true
	while (changed) {
		changed = false
		for (const decl of readTypesResult.types) {
			if (decl.sourceKind !== "typeDeclaration" || !decl.ast) continue
			const ownIds = ownTypeParamIdsOrdered(decl)
			walkTypeRefCallsForDerived(decl.ast, callNode => {
				const callee = resolveCalleeTypeDeclaration(typesById.get(callNode.refId ?? ""), readTypesResult.types)
				if (!callee || callee.sourceKind !== "typeDeclaration") return
				const slots = out.get(callee.id)
				if (!slots) return
				const args = callNode.nodes ?? []
				for (const slotIndex of slots) {
					if (slotIndex < 0 || slotIndex >= args.length) continue
					const argAst = args[slotIndex] ?? never()
					const paramIdx = identityOwnTypeParameterArgument(argAst, ownIds)
					if (paramIdx === undefined) continue
					const existing = out.get(decl.id)
					if (existing?.has(paramIdx)) continue
					addSlots(decl.id, [paramIdx])
					changed = true
				}
			})
		}
	}
	return out
}

function walkTypeRefCallsForDerived(node: TypeAstNode, visit: (callNode: TypeAstNode) => void): void {
	if (node.kind === "typeRef" && node.refId && node.nodes && node.nodes.length > 0) {
		visit(node)
	}
	for (const child of node.nodes ?? []) {
		walkTypeRefCallsForDerived(child, visit)
	}
}

/**
 * True when the argument is syntactically a bare reference to one of the enclosing alias's type
 * parameters (identity), not e.g. `A<T>`, `[T]`, or `T | U`.
 */
function identityOwnTypeParameterArgument(arg: TypeAstNode, ownParamIdsOrdered: readonly string[]): number | undefined {
	const node = unwrapParenthesized(arg)
	if (node.kind !== "typeRef") return undefined
	if (node.nodes && node.nodes.length > 0) return undefined
	const refId = node.refId
	if (!refId) return undefined
	const index = ownParamIdsOrdered.indexOf(refId)
	return index >= 0 ? index : undefined
}

/**
 * For callees that are not consumers (registered or derived), every argument is checked like a
 * non-consumer generic. For consumers, only configured slot indices participate.
 */
function shouldApplyConsumerSlotForCallee(
	callee: TypeEntry,
	argumentIndex: number,
	consumerSlotsByDecl: ConsumerSlotsByDeclaration,
	typesById: Map<string, TypeEntry>,
): boolean {
	const slots = consumerSlotsByDecl.get(callee.id)
	if (!slots) return true
	const decl = typesById.get(callee.id) ?? never()
	const arity = decl.arguments.length
	if (arity === 0) return true
	return slots.has(argumentIndex)
}

function buildLinearReuseExcludeRefKeys(
	readTypesResult: ReadTypesResult,
	typesById: Map<string, TypeEntry>,
	constrainedTypeIds: Set<string>,
	consumerSlotsByDecl: ConsumerSlotsByDeclaration,
	constraintLeafTypeIds: Set<string>,
): Set<string> {
	const out = new Set<string>()
	for (const scope of readTypesResult.scopes) {
		for (const call of scope.calls) {
			const callee = resolveCalleeTypeDeclaration(typesById.get(call.calleeTypeId), readTypesResult.types)
			if (!callee || callee.sourceKind !== "typeDeclaration") continue
			for (const [argumentIndex, arg] of call.arguments.entries()) {
				if (
					!passesGenericOpaquePassRuleForArgument(
						callee,
						argumentIndex,
						arg,
						readTypesResult,
						typesById,
						constrainedTypeIds,
						consumerSlotsByDecl,
						constraintLeafTypeIds,
					)
				) {
					continue
				}
				for (const ref of arg.refs) {
					if (constrainedTypeIds.has(ref.typeId)) {
						out.add(refKey(ref.typeId, ref.pos.start))
					}
				}
			}
		}
	}
	return out
}

function passesGenericOpaquePassRuleForArgument(
	callee: TypeEntry,
	argumentIndex: number,
	arg: ScopeCall["arguments"][number],
	readTypesResult: ReadTypesResult,
	typesById: Map<string, TypeEntry>,
	constrainedTypeIds: Set<string>,
	consumerSlotsByDecl: ConsumerSlotsByDeclaration,
	constraintLeafTypeIds: Set<string>,
): boolean {
	const passedOpaqueVariable = arg.refs.find(ref => constrainedTypeIds.has(ref.typeId))
	if (!passedOpaqueVariable) return false
	if (!shouldApplyConsumerSlotForCallee(callee, argumentIndex, consumerSlotsByDecl, typesById)) {
		return false
	}
	const calleeParam = readTypesResult.types.find(
		type =>
			type.sourceKind === "typeParam" &&
			type.parent.typeId === callee.id &&
			type.parent.argumentIndex === argumentIndex,
	)
	const calleeParamArg = callee.arguments[argumentIndex]
	const exactOpaqueOrConsumerConstraint =
		calleeParamArg !== undefined &&
		calleeParamArg.constraintRefs.length === 1 &&
		constraintLeafTypeIds.has((calleeParamArg.constraintRefs[0] ?? never()).typeId)
	return exactOpaqueOrConsumerConstraint
}

function pushConsumerLinearityViolations(
	calls: { scopeId: string; call: ScopeCall }[],
	readTypesResult: ReadTypesResult,
	typesById: Map<string, TypeEntry>,
	scopesById: Map<string, ScopeEntry>,
	constrainedTypeIds: Set<string>,
	consumerSlotsByDecl: ConsumerSlotsByDeclaration,
	constraintLeafTypeIds: Set<string>,
	pushViolation: (
		message: string,
		file: string | undefined,
		ref: TypeReference,
		relatedFile?: string,
		relatedRef?: TypeReference,
	) => void,
): void {
	const groups = new Map<string, { scopeId: string; ref: TypeReference; calleeName: string }[]>()
	for (const { scopeId, call } of calls) {
		const callee = resolveCalleeTypeDeclaration(typesById.get(call.calleeTypeId), readTypesResult.types)
		if (!callee || callee.sourceKind !== "typeDeclaration") continue
		if (!consumerSlotsByDecl.has(callee.id)) continue
		const calleeName = callee.name || "unknown"
		for (const [argumentIndex, arg] of call.arguments.entries()) {
			if (
				!passesGenericOpaquePassRuleForArgument(
					callee,
					argumentIndex,
					arg,
					readTypesResult,
					typesById,
					constrainedTypeIds,
					consumerSlotsByDecl,
					constraintLeafTypeIds,
				)
			) {
				continue
			}
			const passedOpaqueVariable = arg.refs.find(ref => constrainedTypeIds.has(ref.typeId))
			if (!passedOpaqueVariable) continue
			const key = `${passedOpaqueVariable.typeId}:${callee.id}:${argumentIndex}`
			const entry = { scopeId, ref: passedOpaqueVariable, calleeName }
			const g = groups.get(key)
			if (g) g.push(entry)
			else groups.set(key, [entry])
		}
	}
	for (const [, group] of groups) {
		if (group.length < 2) continue
		const first = group[0] ?? never()
		const second = group[1] ?? never()
		const variable = typesById.get(first.ref.typeId)
		const variableName = variable ? variable.name : "unknown"
		const consumerName = first.calleeName
		pushViolation(
			`Opaque-constrained type variable ${variableName} cannot be consumed by ${consumerName} more than once in the same branch`,
			scopesById.get(second.scopeId)?.file,
			second.ref,
			scopesById.get(first.scopeId)?.file,
			first.ref,
		)
	}
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

function* listCallsInBranchWithoutNestedConditionals(
	scopeId: string,
	scopesById: Map<string, ScopeEntry>,
): Generator<{ scopeId: string; call: ScopeCall }> {
	const scope = scopesById.get(scopeId)
	if (!scope) return
	for (const call of scope.calls) {
		yield { scopeId: scope.id, call }
	}
	for (const child of scope.children) {
		const childScope = scopesById.get(child.scopeId)
		if (!childScope) continue
		const isNestedConditionalScope =
			childScope.kind === "conditionalCondition" ||
			childScope.kind === "conditionalTrueBranch" ||
			childScope.kind === "conditionalFalseBranch"
		if (isNestedConditionalScope) continue
		yield* listCallsInBranchWithoutNestedConditionals(child.scopeId, scopesById)
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

function resolveCalleeTypeDeclaration(entry: TypeEntry | undefined, types: TypeEntry[]): TypeEntry | undefined {
	if (!entry) return undefined
	if (entry.sourceKind === "typeDeclaration") return entry
	if (entry.sourceKind === "typeImport") {
		return types.find(
			t =>
				t.sourceKind === "typeDeclaration" && t.name === entry.name && t.refFile === entry.refFile,
		)
	}
	return undefined
}

function consumerConstraintAppliesToTypeParam(
	decl: TypeEntry,
	typeArgumentIndexes: number[] | undefined,
	parent: TypeEntry,
	paramIndex: number,
): boolean {
	const arity = decl.arguments.length
	if (arity === 0) {
		return true
	}
	if (!typeArgumentIndexes || typeArgumentIndexes.length === 0) {
		return parent.id === decl.id && paramIndex >= 0 && paramIndex < arity
	}
	if (parent.id !== decl.id) return false
	return typeArgumentIndexes.includes(paramIndex)
}

function never(): never {
	throw new Error("never")
}
