# API Design Log: db.query() Error Handling

## Мэта

Дызайніць API для `db.query()` і `db.stream()`, каб **няправільныя SQL запыты давалі памылкі кампіляцыі TypeScript** у рэальным выкарыстанні (не толькі ў тыпавых тэстах).

## Бягучы стан

### Існуючы API

```typescript
const db = sqlMigrations({ driver }).apply(`CREATE TABLE users (id TEXT, name TEXT)`).database()

// Гэта НЕ дае памылкі кампіляцыі (але павінна!)
const rows = await db.query(`SELECT invalid_column FROM users`)
```

### Праблема

- `db.query()` выкарыстоўвае `CheckSqlValid` у parameter constraint
- Але ў рэальным выкарыстанні памылкі не з'яўляюцца
- Магчыма праблема ў тым, што `Db` тып не захоўваецца праз `.database()`

## Эксперыменты

### Design 1: Бягучы API (FAILED)

**Ідэя:** Праверыць, ці працуе `CheckSqlValid` у бягучым API.

**Спроба:** `test/integration/api-design/01-current-api.ts`

**Код:**

```typescript
const db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id text, name text);`).database()

// @ts-expect-error — чакаем памылку
const badQuery = await db.query(`select invalid_column from users;`)
```

**Вынік:** ❌ **НЕ ПРАЦУЕ**

- `@ts-expect-error` не спрацоўвае — памылкі кампіляцыі няма
- `db.query()` прымае любы SQL без валідацыі
- `CheckSqlValid` не спрацоўвае ў runtime выкарыстанні

**Праблема:**

- Тып `Db` губляецца праз `.database()`
- Або `CheckSqlValid` не можа вылічыць тып `Db` у runtime
- Магчыма трэба іншы спосаб захавання тыпу БД

**Статус:** Трэба іншы дызайн API

---

### Design 2: Дэталёвая праверка тыпу db.query() (SUCCESS!)

**Ідэя:** Праверыць, ці `CheckSqlValid` рэальна бачыць тып `Db` і валідуе запыты.

**Спроба:** `test/integration/api-design/02b-query-signature.ts`

**Код:**

```typescript
const db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id text, name text);`).database()

const bad = await db.query(`select invalid_column from users;`)
```

**Вынік:** ✅ **ПРАЦУЕ!**

```
error TS2345: Argument of type '"select invalid_column from users;"'
is not assignable to parameter of type '"Unknown column"'.
```

**Высновы:**

- ✅ **API рэальна працуе!** `CheckSqlValid` валідуе запыты
- ✅ Тып `Db` захоўваецца праз `.database()`
- ✅ Няправільныя запыты даюць памылкі кампіляцыі
- ❌ Праблема Design 1: `@ts-expect-error` не паказвае памылку ў `npm run typecheck` (але памылка ёсць!)

**Рашэнне:**
Бягучы API **ужо працуе правільна**! Для тэстаў трэба выкарыстоўваць **тыпавыя тэсты** (як у Design 4 з DESIGN_LOG.md), а не `@ts-expect-error`.

**Статус:** ✅ API працуе! Трэба толькі правільна тэставаць

---

### Design 3: Альтэрнатыўны API з .result() (NOT NEEDED)

**Ідэя:** `db.query(...).result()` замест `db.query(...)`

**Спроба:** `test/integration/api-design/03-result-api.ts`

**Код:**

```typescript
// Бягучы API
const current = await db.query(`select id from users;`)

// Альтэрнатыўны API
const alternative = await db.query(`select id from users`).result()
```

**Вынік:** ❌ **НЕ ТРЭБА**

**Перавагі:**

- Больш выразны (відавочна, що гэта async)
- Можна дадаць .validate() або .check() перад .result()

**Недахопы:**

- Больш многаслоўна
- Breaking change без выгоды
- Не дае дадатковых магчымасцей для валідацыі

**Высновы:**

- Бягучы API ужо працуе і валідуе
- .result() не дае дадатковых магчымасцей
- Прасцей і лепш: `db.query(...)`

**Статус:** ❌ Адхілена

---

### Design 4: Builder pattern API (NOT NEEDED)

**Ідэя:** `db.select(...).from(...).where(...).execute()`

**Спроба:** `test/integration/api-design/04-builder-api.ts`

**Код:**

```typescript
// Бягучы API
const current = await db.query(`select id, name from users where active = true;`)

// Builder API
const builder = await db.select(`id, name`).from(`users`).where(`active = true`).execute()
```

**Вынік:** ❌ **НЕ ТРЭБА**

**Перавагі:**

- Больш структураваны
- Можна валідаваць кожны крок асобна
- Лепшая аўтакамплітацыя

**Недахопы:**

- Вельмі многаслоўна
- Губляецца простата SQL
- Гэта ўжо query builder (супярэчыць філасофіі бібліятэкі)
- LLM лепш ведаюць SQL, чым builder DSL

**Высновы:**

- Супярэчыць філасофіі "Write plain SQL"
- LLM лепш ведаюць SQL, чым builder DSL
- Бягучы API прасцей і выразней

**Статус:** ❌ Адхілена

---

## Фінальны вынік

**✅ Бягучы API ідэальны!**

```typescript
const db = sqlMigrations({ driver }).apply(`create table users (id text, name text);`).database()

// ✅ Правільны SQL — кампілюецца
const good = await db.query(`select id, name from users;`)

// ❌ Няправільны SQL — памылка кампіляцыі
const bad = await db.query(`select invalid_column from users;`)
// error TS2345: Argument of type '"select invalid_column from users;"'
// is not assignable to parameter of type '"Unknown column"'.
```

**Чаму бягучы API лепш:**

1. ✅ Валідацыя працуе праз `CheckSqlValid`
2. ✅ Просты SQL (універсальны, вядомы ўсім)
3. ✅ LLM могуць пісаць SQL адразу
4. ✅ Менш кода, больш выразна
5. ✅ Адпавядае філасофіі "Write plain SQL"

**Што трэба для тэстаў:**

- Выкарыстоўваць **тыпавыя тэсты** (як у `test/integration/smoke/01-basic-select.test.ts`)
- НЕ выкарыстоўваць `@ts-expect-error` (не паказвае памылкі ў typecheck)
