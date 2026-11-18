export const metadata = {
  title: 'Политика конфиденциальности — Polski B1',
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-10 text-ink">
      <h1 className="text-3xl font-semibold">Политика конфиденциальности</h1>
      <p className="mt-3 text-sm text-muted">Последнее обновление: 18 ноября 2026 г.</p>

      <div className="mt-8 space-y-6 text-sm leading-6">
        <section>
          <h2 className="text-lg font-semibold">Какие данные мы получаем</h2>
          <p className="mt-2">
            При входе через Google мы получаем имя, email, идентификатор Google-аккаунта
            и фотографию профиля, если Google их передаёт. При использовании словаря
            мы сохраняем добавленные пользователем слова, переводы, примеры и источник.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Зачем это нужно</h2>
          <p className="mt-2">
            Эти данные используются только для входа, синхронизации личного словаря,
            сохранения учебного прогресса и работы расширения Polski B1.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Передача данных</h2>
          <p className="mt-2">
            Мы не продаём пользовательские данные и не используем их для рекламы.
            Данные передаются между приложением и сервером по HTTPS и хранятся в базе,
            необходимой для работы сервиса.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Удаление данных</h2>
          <p className="mt-2">
            Чтобы запросить удаление аккаунта и связанных данных, свяжитесь с владельцем
            приложения через адрес поддержки, указанный в Chrome Web Store.
          </p>
        </section>
      </div>
    </main>
  )
}
