import type { NextConfig } from 'next'

const config: NextConfig = {
  // Бэкенда нет: на выходе статика, которую можно положить куда угодно.
  // Когда появится API — убрать эту строку и добавить app/api/*.
  output: 'export',

  // Оптимизатор изображений Next требует сервера.
  images: { unoptimized: true },

  // Статический экспорт отдаёт /lesson/index.html — так корректнее
  // работает на хостингах без rewrite-правил.
  trailingSlash: true,

  // UI-пакет поставляется исходниками — Next его транспилирует сам
  transpilePackages: ['@polski/ui'],
}

export default config
