# Design Log: Integration Tests Error Handling

## Мэта

Знайсці спосаб тэставання, каб **няправільныя SQL запыты давалі памылкі кампіляцыі TypeScript**.

## Праблема

- `@ts-expect-error` у runtime тэстах не спрацоўвае
- `db.query()` выкарыстоўвае `CheckSqlValid`, але памылкі не з'яўляюцца
- Існуючыя тэсты выкарыстоўваюць тыпавыя тэсты (`Expect<Extends<...>>`), не runtime

## Эксперыменты

### Design 1: Runtime тэсты з @ts-expect-error (FAILED)

**Ідэя:** Выкарыстоўваць `await db.query(...)` з `@ts-expect-error` для няправільных запытаў.

**Спроба:** `test/integration/smoke/01-basic-select.test.ts`

**Вынік:** ❌ Не працуе

- `@ts-expect-error` паказвае "Unused directive" — памылкі няма
- `mockDriver` з пустым `scalarTypes: {}` не дае правільнай валідацыі
- Трэба правільны PostgresTypeMap

**Статус:** Адкат, спрабуем іншае

---

### Design 2: Тыпавыя тэсты як у parse-select.test.ts (FAILED)

**Ідэя:** Выкарыстоўваць `ParseSqlStatement` + `Expect<Extends<Tuple3At2<...>>>` як у існуючых тэстах.

**Спроба:** `test/integration/smoke/02-design2-type-level.test.ts`

**Вынік:** ❌ Не працуе

- Усе `Expect<Extends<...>>` даюць `Type 'false' does not satisfy the constraint 'true'`
- Магчыма праблема ў `ApplyStatements` або структуры `TestDb`
- Трэба глыбей разабрацца, чаму тыпы не супадаюць

**Статус:** Адкат, спрабуем іншае

---

### Design 3: InferSqlErrors API (PARTIAL SUCCESS)

**Ідэя:** Выкарыстоўваць `InferSqlErrors<Db, Stmt>` — публічны API для праверкі памылак.

**Спроба:** `test/integration/smoke/03-design3-infer-errors.test.ts`

**Вынік:** ⚠️ Частковы поспех

- ✅ Тэсты на поспех (правільныя запыты) **працуюць** — `InferSqlErrors` вяртае `null`
- ❌ Тэсты на памылкі **не працуюць** — `InferSqlErrors` не вяртае `SqlParserError` для няправільных запытаў
- Магчыма валідацыя калонак/табліц не рэалізавана ў парсеры

**Высновы:**

- API `InferSqlErrors` існуе і працуе для поспешных сцэнараў
- Але валідацыя памылак (няправільныя калонкі/табліцы) можа не быць рэалізавана
- Трэба праверыць, ці парсер рэальна валідуе існаванне калонак/табліц

**Статус:** Трэба глыбей даследаваць, ці валідацыя ўвогуле рэалізавана

---

### Design 4: Скапіраваць дакладна як у parse-select.test.ts (SUCCESS!)

**Ідэя:** Выкарыстоўваць **дакладна** тую ж структуру БД і стыль тэстаў як у `parse-select.test.ts`.

**Спроба:** `test/integration/smoke/04-design4-exact-copy.test.ts`

**Вынік:** ✅ **ПОСПЕХ!**

- ✅ Тэст на поспех (правільны SELECT) — **працуе**
- ✅ Тэст на памылку (няправільная калонка) — **працуе**! `SqlParserError` вяртаецца
- ❌ Тэст на памылку (няправільная табліца) — **не працуе** (магчыма валідацыя табліц не рэалізавана)

**Высновы:**

- ✅ **Валідацыя калонак працуе!** Парсер правярае існаванне калонак у табліцы
- ❌ Валідацыя табліц можа не працаваць (або патрабуе іншага падыходу)
- ✅ **Знойдзены працуючы падыход:** `ParseSqlStatement` + `Tuple3At2` + `Expect<Extends<..., SqlParserError<string>>>`

**Рашэнне:**
Выкарыстоўваць гэты стыль для ўсіх інтэграцыйных тэстаў:

```typescript
type TestDb = ApplyStatements<SqlDatabase, `create schema public; create table users (...);`>[0]
type TBadQuery = ParseSqlStatement<ParseSqlTokens<`select wrong_col from users;`>, TestDb>
type _test = Expect<Extends<Tuple3At2<TBadQuery>, SqlParserError<string>>>
```

**Статус:** ✅ Гатова! Маем працуючы дызайн

---

## Падсумаванне

**Працуючы дызайн:** Design 4

**Што працуе:**

- ✅ Тыпавыя тэсты праз `ParseSqlStatement` + `Tuple3At2`
- ✅ Валідацыя калонак (няправільная калонка → `SqlParserError`)
- ✅ Тэсты на поспех (правільны SQL → `JsqlSelectStatementResult`)

**Што не працуе:**

- ❌ Валідацыя табліц (магчыма не рэалізавана або патрабуе іншага падыходу)

**Наступныя крокі:**

1. Выкарыстоўваць Design 4 для smoke tests
2. Даследаваць, чаму валідацыя табліц не працуе
3. Пакрыць усе функцыяналы тэстамі ў гэтым стылі
