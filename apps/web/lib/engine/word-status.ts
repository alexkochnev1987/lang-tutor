import type { AppState } from '@/lib/data/types'

export type LexemeStudyStatus = 'known' | 'learning' | 'completed' | 'failed' | 'untouched'

function sessionWordId(sessionId: string): string | null {
  const marker = ':word:'
  const index = sessionId.lastIndexOf(marker)
  return index >= 0 ? sessionId.slice(index + marker.length) : null
}

/** Единый пользовательский статус для словаря и экрана выбора слов. */
export function getLexemeStudyStatus(
  state: AppState | null,
  lexemeId: string,
): LexemeStudyStatus {
  if (state?.lexemeStatus.some((row) => row.lexemeId === lexemeId && row.status === 'known')) {
    return 'known'
  }

  const latestSession = (state?.sessions ?? [])
    .filter((session) => (
      (session.kind === 'words' || session.kind === 'words-failed')
      && sessionWordId(session.id) === lexemeId
    ))
    .reduce<AppState['sessions'][number] | null>((latest, session) => (
      !latest || (session.completedAt?.getTime() ?? 0) > (latest.completedAt?.getTime() ?? 0)
        ? session
        : latest
    ), null)

  if (latestSession?.kind === 'words-failed') return 'failed'
  if (latestSession?.kind === 'words') return 'completed'
  if (state?.studyItems.some((item) => item.refId === lexemeId)) return 'learning'
  return 'untouched'
}

