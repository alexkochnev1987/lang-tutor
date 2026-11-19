import { Screen } from '@polski/ui'
import { Nav } from '../_components/Nav'
import { SessionsWorkspace } from './SessionsWorkspace'

export default function SessionsPage() {
  return (
    <Screen>
      <header className="mx-auto w-full max-w-2xl px-4 py-3">
        <div className="min-h-11">
          <h1 className="text-lg font-semibold">Занятия</h1>
          <p className="text-xs text-muted">Планируйте встречи и практику</p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-6">
        <SessionsWorkspace />
      </main>
      <Nav />
    </Screen>
  )
}
