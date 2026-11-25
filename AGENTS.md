# Repository instructions

Read [docs/DEV_RULES.md](docs/DEV_RULES.md) before changing code.

## CI/CD — обязательный порядок выпуска

- Работать в отдельной ветке; изменения в main только через pull request.
- Перед merge провести ревью и дождаться успешного GitHub Actions check `verify`
  для актуального HEAD PR (и актуальной базы main). Не обходить проверки.
- CI: установка по lockfile, автоматические тесты, production-like Next.js build,
  TypeScript и миграции на отдельном временном PostgreSQL. Никаких production-секретов,
  production-БД или деплоя из PR.
- **Не создавать Vercel Preview Deployments** для проверки веток и PR, включая
  ручные запуски и повторные сборки. Preview отключён в настройках проекта;
  `apps/web/vercel.json` разрешает Git-деплой только из main.
- Только после успешного CI и ревью — merge PR в main, затем один production
  deployment через Vercel Git integration. Проверять статус нужного коммита
  и миграций; не дублировать deployment, если он уже запущен.
- Если CI недоступен, не пройден или не относится к последнему коммиту — не
  мержить и сообщить о блокере. Vercel Preview не заменяет GitHub Actions.
