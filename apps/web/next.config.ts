import type { NextConfig } from 'next'

const config: NextConfig = {
  // Данные пользователя живут в Postgres, значит нужны route handlers —
  // статического экспорта здесь больше нет. Контент курса остаётся
  // статическими JSON в public/ (ARCHITECTURE.md §2, R3).

  // Ссылки по всему приложению ведут на /lesson/ со слэшем.
  trailingSlash: true,

  // UI и движок поставляются исходниками — Next транспилирует их сам
  transpilePackages: ['@polski/ui', '@polski/engine'],
}

export default config
