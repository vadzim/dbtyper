# Integration Test Plan — Real-World Usage Testing

## Мэта

Стварыць набор інтэграцыйных тэстаў, якія імітуюць рэальнае выкарыстанне бібліятэкі:

- Міграцыі ствараюць схему БД
- Тэсты правяраюць, што запыты кампілююцца (або не кампілююцца) як чакаецца
- Кожны функцыянал павінен мець тэсты на **поспех** (запыт кампілюецца) і **памылку** (TypeScript памылка ў патрэбным месцы)

## Структура

```
test/
  integration/           # новая тэчка для інтэграцыйных тэстаў
    setup/
      migrations.ts      # агульныя міграцыі для тэстаў
      test-db.ts         # helper для стварэння тыпізаванай БД
    select.test.ts       # тэсты SELECT
    insert.test.ts       # тэсты INSERT
    update.test.ts       # тэсты UPDATE
    delete.test.ts       # тэсты DELETE
    joins.test.ts        # тэсты JOIN
    subqueries.test.ts   # тэсты subqueries
    functions.test.ts    # тэсты функцый
    group-by.test.ts     # тэсты GROUP BY / HAVING
    ...
```

## Падыход да тэставання

### Тэст на поспех (OK)

```typescript
// Запыт павінен кампіліравацца без памылак
const rows = await db.query(`SELECT id, name FROM users`)
// TypeScript вылічае тып: Array<{ id: string; name: string }>
```

### Тэст на памылку (ERROR)

```typescript
// @ts-expect-error — чакаем памылку: калонка 'invalid_column' не існуе
const rows = await db.query(`SELECT invalid_column FROM users`)
```

Дырэктыва `@ts-expect-error` азначае:

- Наступны радок **павінен** даваць TypeScript памылку
- Калі памылкі няма — тэст правальваецца
- Калі памылка ёсць — тэст праходзіць

## Этапы рэалізацыі

### Этап 0: План (гэты дакумент)

Запісаць падрабязны план усіх тэстаў, якія трэба рэалізаваць.

### Этап 1: Пробныя тэсты (2 штукі)

Стварыць мінімальную інфраструктуру:

- `test/integration/setup/` — міграцыі і helpers
- Адзін тэст на поспех: `SELECT id, name FROM users` кампілюецца
- Адзін тэст на памылку: `SELECT invalid_column FROM users` дае TypeScript памылку

Калі працуе — push.

### Этап 2: Дакумент са спісам усіх тэстаў

Створым `test/integration/TEST_COVERAGE.md` з поўным спісам:

- Якія функцыяналы трэба пакрыць
- Якія сцэнарыі поспеху
- Якія сцэнарыі памылак
- Прыярытэт кожнага тэста

### Этап 3: Рэалізацыя тэстаў (без фіксаў)

Напісаць усе тэсты згодна з дакументам:

- Тэсты на поспех (запыты павінны кампіліравацца)
- Тэсты на памылку (з `@ts-expect-error`)
- **Не фіксіць** код бібліятэкі, калі тэсты не праходзяць

### Этап 4: Фіксы кода

Выпраўляць код бібліятэкі, пакуль усе тэсты не запрацуюць:

- Калі тэст на поспех не кампілюецца — фіксім парсер/resolver
- Калі тэст на памылку не дае памылкі — дадаем валідацыю
- Пасля кожнага фікса — `npm test` і commit

## Прынцыпы

1. **Кожны функцыянал** павінен мець мінімум 2 тэсты: поспех + памылка
2. **Рэальныя сцэнарыі**: міграцыі → схема → запыты (як у `examples/typed-postgres`)
3. **Ізаляваныя тэсты**: кожны файл тэстаў можа мець свае міграцыі або выкарыстоўваць агульныя
4. **Дакументаваныя чаканні**: кожны `@ts-expect-error` павінен мець каментар, чаму гэта памылка

## Пакрыццё функцыяналу (high-level)

### Базавыя SELECT

- [x] SELECT named columns (ужо ёсць у `test/parse-select.test.ts`)
- [ ] SELECT \* expansion
- [ ] SELECT with aliases
- [ ] SELECT from qualified table (schema.table)

### JOIN

- [ ] INNER JOIN
- [ ] LEFT JOIN (nullability)
- [ ] Cross-schema JOIN
- [ ] Multiple JOINs

### WHERE

- [ ] Simple conditions (=, !=, <, >)
- [ ] AND / OR / NOT
- [ ] IN (list)
- [ ] BETWEEN
- [ ] IS NULL / IS NOT NULL

### INSERT

- [ ] INSERT single row
- [ ] INSERT multiple rows
- [ ] INSERT with RETURNING
- [ ] INSERT type mismatch (error)

### UPDATE

- [ ] UPDATE with WHERE
- [ ] UPDATE with RETURNING
- [ ] UPDATE type mismatch (error)

### DELETE

- [ ] DELETE with WHERE
- [ ] DELETE with RETURNING

### Subqueries

- [ ] Scalar subquery in SELECT
- [ ] IN (SELECT ...)
- [ ] EXISTS (SELECT ...)
- [ ] Correlated subquery

### CTEs

- [ ] WITH ... SELECT
- [ ] Multiple CTEs
- [ ] CTE used in JOIN

### Functions

- [ ] Built-in functions (LOWER, COUNT, etc.)
- [ ] Custom functions (via Db.functions)
- [ ] Unknown function (error)

### GROUP BY / HAVING

- [ ] GROUP BY single column
- [ ] GROUP BY multiple columns
- [ ] HAVING with aggregate
- [ ] Invalid GROUP BY (error)

### Arrays (PostgreSQL)

- [ ] ARRAY constructor
- [ ] Array indexing
- [ ] Array operators (@>, &&)

### Error cases

- [ ] Unknown table
- [ ] Unknown column
- [ ] Type mismatch in WHERE
- [ ] Type mismatch in INSERT
- [ ] Ambiguous column reference
- [ ] Invalid JOIN condition

## Наступныя крокі

1. ✅ Запісаць план (гэты файл)
2. ⏳ Дазволіць карыстальніку азнаёміцца з планам
3. ⏳ Стварыць 2 пробныя тэсты (поспех + памылка)
4. ⏳ Стварыць падрабязны дакумент TEST_COVERAGE.md
5. ⏳ Рэалізаваць усе тэсты
6. ⏳ Фіксіць код да праходжання ўсіх тэстаў
