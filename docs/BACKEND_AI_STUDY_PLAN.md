# План изучения Backend + Applied AI

Цель: перейти от сильного frontend/full-stack профиля к роли
**Senior Full-stack / Backend Engineer with Applied AI**.

Главный принцип: не учить технологии списком. Каждая тема должна заканчиваться
рабочим артефактом, тестом и объяснением вслух на собеседовании.

## Приоритеты

```text
P0  Backend fundamentals + production reliability
P1  System design + cloud/data/security
P2  Applied AI integration
P3  Python service and optional RAG/agents
```

Не начинай с fine-tuning, сложных агентов или математики ML. Сначала нужно уметь
надёжно построить обычный backend, а затем встроить AI как один из его
ненадёжных внешних компонентов.

## 1. Backend foundations — повторить и углубить

### HTTP и API design

- HTTP methods, status codes, headers, caching;
- REST resource modelling и versioning;
- validation, pagination, filtering, sorting;
- idempotency keys и safe retries;
- rate limiting и request size limits;
- API error contract;
- authentication vs authorization;
- webhook signature verification.

Практика: спроектировать API для writing submissions в Polski B1 с POST, GET,
retry и идемпотентностью.

### PostgreSQL и data modelling

- primary/foreign keys, unique constraints;
- composite indexes и порядок колонок;
- `EXPLAIN ANALYZE` и поиск N+1/query bottlenecks;
- transactions и isolation levels;
- optimistic/pessimistic locking;
- migrations и backward-compatible schema changes;
- soft delete, audit log и retention;
- JSONB: когда оправдан и когда лучше нормальная таблица.

Практика: написать migration, concurrent update test и объяснить, какой
consistency нужен для progress/SRS.

### Async work и distributed reliability

- queue vs synchronous request;
- retries with exponential backoff;
- dead-letter state;
- idempotent workers;
- timeouts и cancellation;
- outbox/inbox pattern;
- eventual consistency;
- scheduled jobs и long-running workflows.

Практика: сделать worker, который обрабатывает evaluation job и безопасно
повторяет её после падения.

### Security

- session/cookie security;
- OAuth/OIDC basics;
- RBAC/ABAC;
- OWASP API risks;
- SQL injection, SSRF, XSS, CSRF;
- secret management;
- PII classification и data deletion;
- tenant/user isolation.

Практика: написать threat model для текста пользователя и AI provider request.

## 2. Production engineering

### Testing

- unit tests для domain logic;
- integration tests с реальной БД или test container;
- API contract tests;
- end-to-end critical flow;
- property-based tests для parser/normalizer;
- regression tests для AI outputs;
- тесты retries, timeouts и duplicate delivery.

### Observability

- structured logs;
- correlation/request id;
- metrics: latency, error rate, throughput, queue depth;
- traces между API, DB, worker и provider;
- SLI/SLO/error budget;
- alerting и incident runbook.

### Cloud и delivery

- Docker image и health checks;
- CI: lint, typecheck, tests, build;
- AWS basics: IAM, ECS/EKS/Lambda, RDS, S3, CloudWatch;
- environment separation;
- zero-downtime migration;
- rollback и feature flags;
- cost estimation.

Практика: нарисовать deployment diagram для Polski B1 и описать recovery после
падения API, базы и AI provider.

## 3. Applied AI engineering

### Базовый AI application layer

- chat/completions/responses API concepts;
- messages, context window, token usage;
- temperature и determinism;
- streaming;
- tool/function calling;
- structured output и JSON Schema;
- model/provider fallback;
- prompt injection и untrusted input.

### Evaluation, а не «магия промпта»

- gold dataset из 30–50 примеров;
- expected output и допустимые варианты;
- correctness, groundedness, refusal и latency metrics;
- regression suite перед сменой model/prompt;
- human review для языковой оценки;
- versioning prompt, model и rubric;
- разделение model score и пользовательского progress score.

### RAG

Изучать только после structured output и evaluation:

- embeddings и chunking;
- hybrid search;
- metadata filters;
- retrieval quality;
- citation/grounding;
- stale documents и re-indexing;
- access control на retrieved data.

Для Polski B1 RAG не нужен для всей программы: авторский curriculum уже есть в
JSON. Он может понадобиться для справочных материалов или импортированного
пользовательского контента.

### Agents

Сначала научись строить обычный workflow. Агент оправдан только если заранее
неизвестно, какие инструменты и шаги понадобятся. Для фиксированной проверки
письма лучше обычный pipeline:

```text
input validation
  -> rubric context
  -> model structured output
  -> schema validation
  -> allow-list IDs
  -> persistence
  -> practice generation
```

## 4. Python

Тебе не нужен полный переход в data science. Нужен один production-style
артефакт:

- FastAPI или async worker;
- Pydantic validation;
- async HTTP/DB;
- pytest;
- Docker;
- structured logging;
- health/readiness endpoints;
- retry и timeout;
- CI.

Проект: отдельный Python evaluation worker, который получает job, вызывает
provider adapter и возвращает versioned result.

## 5. 12 недель

| Период | Изучить | Артефакт | Доказательство |
|---|---|---|---|
| Недели 1–2 | HTTP, API contracts, validation | versioned writing API design | объяснить status/error/idempotency |
| Недели 3–4 | PostgreSQL, indexes, transactions | migration + query plan + concurrency test | system design discussion |
| Недели 5–6 | queues, retries, workers | retry-safe evaluation worker | failure demo |
| Недели 7–8 | auth, security, observability | threat model + logs/metrics/traces | incident walkthrough |
| Недели 9–10 | LLM API, structured output, cost | provider adapter + JSON Schema | invalid-output tests |
| Неделя 11 | evaluation/RAG basics | 30–50 golden cases | quality comparison |
| Неделя 12 | Python + interview practice | FastAPI/worker case study | mock interview + CV bullet |

## 6. Еженедельный ритм

Каждую неделю:

1. 2 часа — теория и документация;
2. 4–6 часов — реализация маленького артефакта;
3. 1–2 часа — тесты и failure cases;
4. 30 минут — объяснить решение вслух;
5. 30 минут — записать trade-offs и новые вопросы.

Если тема не превращается в код, тест или объяснение, её пока не нужно
расширять.

## 7. Что считать готовностью

Ты готов претендовать на backend/full-stack AI-oriented роли, когда можешь без
подсказок:

- спроектировать API и схему данных;
- объяснить transaction/isolation/index trade-offs;
- описать retry-safe queue worker;
- провести threat model;
- показать observability и recovery path;
- валидировать AI output и объяснить, почему модель не является source of truth;
- оценить latency/cost и выбрать fallback;
- рассказать о реальном артефакте за 5 минут на английском.
