import type { ReadTypesResult, ScopeEntry, TypeEntry, TypeEntryParent, TypeReference } from "./read-types.ts"

export type ConsumingViolation = {
	borrower: { typeId: string; argumentIndex: number }
	borrowedValue: TypeReference
	errorneousUsage: TypeReference
	commonIds: string[]
}

export function getConsumingViolations(options: ReadTypesResult): Generator<ConsumingViolation> {
	return new BorrowChecker(options).getConsumingViolations()
}

export class BorrowChecker {
	constructor(options: ReadTypesResult) {
		this.types = new Map(options.types.map(type => [type.id, type]))
		this.scopes = new Map(options.scopes.map(scope => [scope.id, scope]))
		this.typeDefsById = createTypeDefsById(this.types)
		this.typeIds = createTypeIds(this.typeDefsById)
		this.typesByScope = groupTypesByScope(this.types)
	}

	scopes: Map<string, ScopeEntry>
	types: Map<string, TypeEntry>
	typeDefsById: Map<string, TypeEntry>
	typeIds: Map<string, Set<string>>
	typesByScope: Map<string, TypeEntry[]>;

	*getConsumingViolations(): Generator<ConsumingViolation> {
		const consumingTypes = getInitialConsumingTypes(this.types)

		const checkedConsumingTypes = new Set<string>()

		let current: TypeEntryParent | undefined

		while ((current = consumingTypes.shift())) {
			const { typeId, argumentIndex } = current

			const key = JSON.stringify([typeId, argumentIndex])
			if (checkedConsumingTypes.has(key)) continue
			checkedConsumingTypes.add(key)

			const ids = this.typeIds.get(typeId) ?? never()
			const refScopes = getAllRefScopes(ids, this.types)

			for (const { scopeId } of refScopes) {
				const scope = this.scopes.get(scopeId) ?? never()
				for (const call of scope.calls) {
					if (ids.has(call.calleeTypeId)) {
						const argument = call.arguments[argumentIndex]

						if (!argument) continue

						const outterRefIds = argument.refs.map(ref => ({
							ref,
							ids: new Set(getAllBuiltFrom(ref.typeId, this.types)),
						}))

						const outerParams = new Set(outterRefIds.values().flatMap(ref => ref.ids))
							.values()
							.map(id => this.types.get(id) ?? never())
							.filter(t => t.sourceKind === "typeParam")
							.map(t => t.parent ?? never())
							.toArray()

						consumingTypes.push(...outerParams)

						const infers = new Set(
							scope.kind === "conditionalCondition"
								? (this.typesByScope.get(scope.id) ?? []).map(t => t.id)
								: [],
						)

						const innerRefs = listAllRefsFromScope(scopeId, this.scopes)
							.filter(r => !argument.refs.find(r2 => r2.pos.start === r.pos.start))
							.filter(r => !infers.has(r.typeId))
							.toArray()

						const violations = innerRefs
							.values()
							.flatMap(ref =>
								outterRefIds
									.map(({ ref: innerRef, ids }) => ({
										borrower: { typeId, argumentIndex },
										borrowedValue: innerRef,
										errorneousUsage: ref,
										commonIds: ids
											.intersection(getAllBuiltFrom(ref.typeId, this.types))
											.values()
											.toArray(),
									}))
									.filter(v => v.commonIds.length > 0),
							)
							.toArray()
							// for now only report violations where the borrowed value is the same as the errorneous usage
							.filter(v => v.borrowedValue.typeId === v.errorneousUsage.typeId)

						yield* violations
					}
				}
			}
		}
	}
}

function groupTypesByScope(types: Map<string, TypeEntry>): Map<string, TypeEntry[]> {
	return Map.groupBy(types.values(), type => type.scopeId)
}

function* listAllRefsFromScope(
	scopeId: string,
	scopes: Map<string, ScopeEntry>,
): Generator<TypeReference, undefined, unknown> {
	const scope = scopes.get(scopeId) ?? never()
	yield* scope.refs
	for (const child of scope.children) {
		yield* listAllRefsFromScope(child.scopeId, scopes)
	}
}

function getAllBuiltFrom(id: string, types: Map<string, TypeEntry>) {
	return new Set(listAllBuiltFrom(id, types))
}

function* listAllBuiltFrom(id: string, types: Map<string, TypeEntry>): Generator<string> {
	yield id
	for (const { typeId } of (types.get(id) ?? never()).builtFrom) {
		yield* listAllBuiltFrom(typeId, types)
	}
}

function getAllRefScopes(ids: Iterable<string>, types: Map<string, TypeEntry>): { scopeId: string }[] {
	const seen = new Set<string>()
	const out: { scopeId: string }[] = []
	for (const id of new Set(ids)) {
		for (const rs of (types.get(id) ?? never()).refScopes) {
			if (seen.has(rs.scopeId)) continue
			seen.add(rs.scopeId)
			out.push(rs)
		}
	}
	return out
}

function createTypeIds(typeDefsById: Map<string, TypeEntry>) {
	return new Map(
		Map.groupBy(typeDefsById.entries(), ([_, type]) => type.id)
			.entries()
			.map(([initialTypeId, rec]) => [initialTypeId, new Set(rec.map(([typeId]) => typeId))]),
	)
}

function getInitialConsumingTypes(types: Map<string, TypeEntry>): TypeEntryParent[] {
	return types
		.values()
		.filter(type => type.sourceKind === "typeDeclaration")
		.flatMap(type =>
			type.arguments
				.entries()
				.filter(([_, arg]) => arg.comments.includes("@consume"))
				.map(([index]) => ({ typeId: type.id, argumentIndex: index })),
		)
		.toArray()
}

function createTypeDefsById(types: Map<string, TypeEntry>) {
	const typesByName = new Map(types.values().map(type => [fullTypeName(type), type]))

	const getType = (typeId: string): TypeEntry => {
		let type = types.get(typeId)
		if (!type) throw new Error(`Type ${typeId} not found`)
		while (type.file !== type.refFile) {
			const next = typesByName.get(fullTypeName({ name: type.name, file: type.refFile }))
			if (next === undefined) break
			type = next
		}
		return type
	}

	const result = new Map(types.keys().map(typeId => [typeId, getType(typeId)]))

	return result
}

function fullTypeName({ name, file }: { name: string; file: string }): string {
	return JSON.stringify([name, file])
}

function never(): never {
	throw new Error("never")
}
