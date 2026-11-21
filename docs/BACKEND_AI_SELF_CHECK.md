# Backend + Applied AI — вопросы для самопроверки

Использование: отвечай письменно или вслух без документации. Для каждого
вопроса оцени себя:

- `0` — не знаю;
- `1` — могу дать определение;
- `2` — могу объяснить trade-offs;
- `3` — реализовал и могу показать тест/production evidence.

Цель перед собеседованием: не менее `2` по всем P0 и не менее `2` по вопросам
AI, отмеченным P1.

## A. HTTP и API — P0

1. Чем отличаются `PUT`, `PATCH` и `POST`?
2. Что означает idempotency для HTTP endpoint?
3. Как безопасно повторить запрос после timeout, если неизвестно, был ли он
   выполнен?
4. Какие status codes вернёт API для validation error, unauthorized,
   forbidden, conflict, rate limit и provider timeout?
5. Как проектировать pagination для большой таблицы: offset или cursor?
6. Как версионировать API без поломки старых клиентов?
7. Какие поля должны быть в едином error response?
8. Где и как проверять размер тела запроса?
9. Как проверять подпись webhook и защищаться от replay?
10. Чем authentication отличается от authorization?

## B. PostgreSQL — P0

1. Как выбрать индекс для запроса с `WHERE user_id = ? AND due < ?`?
2. Когда composite index не используется?
3. Что показывает `EXPLAIN ANALYZE`?
4. Чем `READ COMMITTED` отличается от `REPEATABLE READ` и `SERIALIZABLE`?
5. Когда нужна транзакция?
6. Что такое lost update и как его предотвратить?
7. Когда использовать optimistic locking?
8. Когда JSONB лучше нормализованной таблицы, а когда хуже?
9. Как выполнить migration без остановки production?
10. Что такое N+1 query и как его обнаружить?
11. Как удалять пользовательские данные с учётом foreign keys и audit log?
12. Как бы ты хранил SRS progress и почему?

## C. Backend reliability — P0

1. Когда использовать синхронный request, а когда queue?
2. Как устроен exponential backoff?
3. Когда retry вреден?
4. Что такое dead-letter queue?
5. Как сделать worker idempotent?
6. Что произойдёт при повторной доставке одного сообщения?
7. Зачем нужны timeout и cancellation?
8. Чем liveness отличается от readiness health check?
9. Что такое outbox pattern?
10. Как восстановить систему после падения worker посередине операции?
11. Как ограничить queue backlog?
12. Какие метрики покажут, что background processing деградирует?

## D. Security — P0

1. Где хранить API keys и почему не в frontend?
2. Как защитить cookie session?
3. Что такое CSRF и когда он актуален?
4. Как возникает SSRF в backend с URL input?
5. Как защищаться от SQL injection при ORM и raw SQL?
6. Что такое least privilege для service account?
7. Как разделить данные двух пользователей в каждом API route?
8. Какие пользовательские данные нельзя отправлять в LLM provider без политики?
9. Как удалить персональные данные из логов?
10. Как реагировать на утечку provider key?

## E. Testing — P0

1. Что проверять unit-тестом, а что integration-тестом?
2. Что должен проверять contract test API?
3. Как протестировать idempotency?
4. Как протестировать duplicate webhook/message?
5. Как протестировать database race condition?
6. Какие failure cases обязательны для endpoint с внешним provider?
7. Чем snapshot test слабее проверки пользовательского результата?
8. Как построить минимальный end-to-end critical path?

## F. Observability and cloud — P0/P1

1. Какие поля должны быть в structured log?
2. Чем отличаются logs, metrics и traces?
3. Что такое correlation ID?
4. Какие SLI выбрать для AI endpoint?
5. Как найти причину роста latency?
6. Что должно попасть в alert, а что только в dashboard?
7. Как устроить rollback после неудачной migration?
8. Как разделить dev/staging/production secrets?
9. Как оценить стоимость API, DB и AI provider?
10. Что должно быть в incident runbook?

## G. LLM application engineering — P1

1. Чем structured output отличается от просьбы «верни JSON» в prompt?
2. Как проверить, что model output соответствует JSON Schema?
3. Что делать с невалидным output?
4. Как ограничить model-linked IDs только существующими grammar rules?
5. Как версионировать prompt, model, rubric и evaluator code?
6. Как измерить token usage, latency и cost на один evaluation?
7. Когда нужен streaming?
8. Когда нужен обычный workflow, а когда agent?
9. Как защищаться от prompt injection в пользовательском тексте?
10. Что такое hallucination в контексте language-learning app?
11. Как построить fallback при provider timeout?
12. Почему model confidence нельзя автоматически считать учебным mastery score?

## H. Evaluation и качество AI — P1

1. Что такое golden dataset?
2. Как выбрать 30–50 примеров для первой оценки writing evaluator?
3. Кто создаёт human labels и как проверяется согласованность оценок?
4. Какие метрики нужны для исправленного текста, ошибок и linked rules?
5. Как сравнить две модели на одном наборе примеров?
6. Как обнаружить regression после изменения prompt?
7. Как отличить хорошую языковую коррекцию от красивого, но неверного ответа?
8. Какие ответы должен отклонять evaluator?
9. Как показывать пользователю provisional result?
10. Как не выдавать AI feedback за официальный экзаменационный балл?

## I. RAG — P2

1. Когда RAG нужен, а когда достаточно обычного context window?
2. Что такое chunking и как выбрать размер chunk?
3. Что такое embedding?
4. Как измерить retrieval quality отдельно от generation quality?
5. Зачем metadata filters?
6. Как не вернуть пользователю документы другого tenant?
7. Что делать с устаревшими документами?
8. Почему RAG не исправляет плохой source content?

## J. Python — P1

1. Как устроен async I/O в Python?
2. Когда FastAPI endpoint блокируется?
3. Как валидировать request/response через Pydantic?
4. Как устроить retry и timeout для async HTTP client?
5. Как тестировать async code?
6. Как упаковать service в Docker?
7. Чем health и readiness endpoint отличаются?
8. Как передавать job из Node API в Python worker?

## K. System design drills

### Drill 1 — AI writing evaluator

Спроектируй систему: пользователь отправляет польский текст, backend вызывает
LLM, сохраняет результат, создаёт персональные упражнения и не ломает обычный
курс при недоступности provider.

Обязательно объясни:

- API и database schema;
- sync vs async;
- idempotency;
- structured output validation;
- retries/timeouts;
- privacy;
- evaluation dataset;
- cost and rate limits;
- observability;
- rollback/fallback.

### Drill 2 — SRS at scale

Спроектируй систему повторений для миллиона пользователей. Объясни:

- выбор индексов;
- генерацию due queue;
- timezone/day boundaries;
- concurrent answers;
- late reviews;
- cache и invalidation;
- background jobs;
- reporting/readiness.

### Drill 3 — User content import

Спроектируй импорт статьи или субтитров с выделением слов, переводом и SRS.
Объясни SSRF protection, parsing, deduplication, queue, rate limits, storage,
privacy и удаление контента.

## L. Повторение перед интервью

За 7 дней до интервью:

1. каждый день ответить на 10 вопросов без подсказок;
2. один system design drill записать голосом на 10 минут;
3. выбрать 3 реальные истории: failure, trade-off, leadership;
4. повторить PostgreSQL, retries, security и structured output;
5. подготовить объяснение Polski B1 за 60 секунд и за 5 минут;
6. все ответы с оценкой `0–1` превратить в маленький практический task.

## M. Минимальный порог готовности

Перед подачей на backend/full-stack AI-oriented роль ты должен уметь показать:

- один API с validation и idempotency;
- одну PostgreSQL migration и query analysis;
- один retry-safe worker;
- один threat model;
- один structured LLM output test;
- один evaluation dataset;
- одну архитектурную схему;
- один рассказ о production incident или честно смоделированный failure case.
