import type { Metadata, Viewport } from 'next'
import { IntlProvider } from './_providers/IntlProvider'
import { ServiceWorker } from './_providers/ServiceWorker'
import { ThemeInit } from './_providers/ThemeInit'
import { ThemeScript } from './_providers/ThemeScript'
import './globals.css'

export const metadata: Metadata = {
  title: 'Polski B1',
  description: 'Подготовка к государственному экзамену по польскому языку B1',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    // iOS не читает manifest: без этого на домашний экран уедет скриншот страницы
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Polski B1' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // UX_UI.md §1.5б: без этого виртуальная клавиатура накрывает поле ввода,
  // а 100dvh продолжает считаться по полной высоте
  interactiveWidget: 'resizes-content',
  // Конкретное значение ставит lib/theme из активного токена --head:
  // у каждой палитры своя шапка
  themeColor: '#1d1d20',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeInit />
        <ServiceWorker />
        <IntlProvider>{children}</IntlProvider>
      </body>
    </html>
  )
}
