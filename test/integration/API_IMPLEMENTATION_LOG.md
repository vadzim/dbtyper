# API Implementation Design Log

## Мэта

Стварыць 4 варыянты рэалізацыі API ў `src/core/sql-database.ts` і праверыць, які лепш для валідацыі памылак.

## Бягучы стан

Файл: `src/core/sql-database.ts`

Ключавыя тыпы:

- `SqlMigrations<Db>` — інтэрфейс для міграцый
- `DataBase<Db>` — інтэрфейс для БД з `query()` і `stream()`
- `CheckSqlValid<Db, Stmt>` — валідацыя SQL на ўзроўні тыпаў

Бягучая рэалізацыя:

```typescript
export interface SqlMigrations<Db> {
  apply(statement): SqlMigrations<NewDb>
  database(): DataBase<Db>
}

export type DataBase<Db> = {
  query<Stmt>(statement: Stmt extends CheckSqlValid<Db, Stmt> ? Stmt : CheckSqlValid<Db, Stmt>): Promise<Array<...>>
}
```

## План

Стварыць 4 варыянты рэалізацыі:

### Variant 1: Бягучы API (baseline)

Захаваць як ёсць для параўнання.

### Variant 2: Explicit validation method

Дадаць `.validate()` метад для праверкі SQL перад выкананнем.

### Variant 3: Separate typed/untyped interfaces

Раздзяліць `DataBase` на `TypedDataBase` і `UntypedDataBase`.

### Variant 4: Builder-style with validation

Query builder з валідацыяй на кожным кроку.

## Эксперыменты

### Variant 1: Бягучы API (BASELINE) ✅

**Файл:** `test/integration/api-variants/variant1-baseline.ts`

**Структура:**

```typescript
const db = await sqlMigrations({ driver }).apply(`create table users (id text, name text);`).database()

const rows = await db.query(`select id, name from users;`)
```

**Перавагі:**

- ✅ Просты і інтуітыўны
- ✅ Валідацыя працуе праз `CheckSqlValid`
- ✅ Адпавядае філасофіі "Write plain SQL"
- ✅ LLM могуць пісаць SQL адразу

**Недахопы:**

- ⚠️ Error messages могуць быць больш выразнымі
- ⚠️ Няма спосабу праверыць SQL без выканання (але ёсць `InferSqlErrors`)

**Статус:** ✅ Працуе ідэальна

---

### Variant 2: Explicit Validation Method ❌

**Файл:** `test/integration/api-variants/variant2-explicit-validation.ts`

**Ідэя:** Дадаць `.validateQuery()` для праверкі SQL без выканання

**Прапанаваныя змены:**

```typescript
export type DataBase<Db> = {
  query<Stmt>(...): Promise<Array<...>>
  validateQuery<Stmt>(statement: Stmt): InferSqlErrors<Db, Stmt>  // НОВЫ
}
```

**Высновы:**

- ❌ **НЕ ТРЭБА**
- `InferSqlErrors<Db, Stmt>` ужо існуе як тыпавы helper
- Runtime метад не трэба (няма runtime валідацыі)
- Дадатковы API surface без выгоды

**Статус:** ❌ Адхілена

---

### Variant 3: Separate Typed/Untyped Interfaces ❌

**Файл:** `test/integration/api-variants/variant3-separate-interfaces.ts`

**Ідэя:** Раздзяліць `DataBase` на `TypedDataBase` і `UntypedDataBase`

**Прапанаваныя змены:**

```typescript
export type TypedDataBase<Db> = {
  query<Stmt>(...): Promise<Array<...>>
  stream<Stmt>(...): AsyncIterable<...>
}

export type UntypedDataBase = {
  queryUntyped(...): Promise<Array<any>>
  streamUntyped(...): AsyncIterable<any>
}

export type DataBase<Db> = TypedDataBase<Db> & UntypedDataBase & {...}
```

**Высновы:**

- ❌ **НЕ ТРЭБА**
- Раздзяленне не дае практычнай выгоды
- Ускладняе структуру без дадатковай бяспекі
- `queryUntyped()` — escape hatch, не асноўны API

**Статус:** ❌ Адхілена

---

### Variant 4: Query Builder with Validation ❌

**Файл:** `test/integration/api-variants/variant4-query-builder.ts`

**Ідэя:** `db.select().from().where().execute()` з валідацыяй на кожным кроку

**Прапанаваныя змены:**

```typescript
export type DataBase<Db> = {
  query<Stmt>(...): Promise<Array<...>>

  // НОВЫ builder API
  select<Cols>(columns: Cols): SelectBuilder<Db, Cols>
}

type SelectBuilder<Db, Cols> = {
  from<Table>(table: Table): FromBuilder<Db, Cols, Table>
}

type FromBuilder<Db, Cols, Table> = {
  where<Cond>(condition: Cond): WhereBuilder<...>
  execute(): Promise<Array<...>>
}
```

**Параўнанне:**

```typescript
// Бягучы API (1 радок)
await db.query(`select id, name from users where active = true`)

// Builder API (5 радкоў)
await db.select(`id, name`).from(`users`).where(`active = true`).execute()
```

**Высновы:**

- ❌ **НЕ ТРЭБА**
- Супярэчыць філасофіі "Write plain SQL"
- Вельмі многаслоўна
- LLM лепш ведаюць SQL, чым builder DSL
- Не ўсе SQL features можна выразіць праз builder

**Статус:** ❌ Адхілена

---

## Фінальны вынік

**✅ VARIANT 1 (бягучы API) — ідэальны!**

Няма патрэбы мяняць `src/core/sql-database.ts`.

**Чаму бягучы API лепш за ўсе альтэрнатывы:**

1. **Простата** — `db.query(sql)` інтуітыўна зразумела
2. **Валідацыя працуе** — `CheckSqlValid` ловіць памылкі
3. **Plain SQL** — адпавядае філасофіі бібліятэкі
4. **LLM-friendly** — модэлі ведаюць SQL, не builder DSL
5. **Кампактна** — менш кода, больш выразна
6. **Поўнасць** — падтрымлівае ўвесь SQL, не толькі builder subset

**Што ўжо ёсць:**

- ✅ `db.query()` — тыпізаваныя запыты
- ✅ `db.queryUntyped()` — escape hatch
- ✅ `InferSqlErrors<Db, Stmt>` — тыпавая праверка
- ✅ `CheckSqlValid` — валідацыя ў parameter constraint

**Рэкамендацыя:** Захаваць бягучы API без змен.
