export interface ProfileName {
  firstName: string
  lastName: string
}

export const PROFILE_NAME_LIMIT = 80

export function parseProfileName(input: unknown): ProfileName | null {
  if (!input || typeof input !== 'object' || !('firstName' in input) || !('lastName' in input)) return null
  const { firstName, lastName } = input
  if (typeof firstName !== 'string' || typeof lastName !== 'string') return null
  if (/[\p{Cc}\p{Zl}\p{Zp}]/u.test(firstName + lastName)) return null

  const first = firstName.trim()
  const last = lastName.trim()
  if (!first || first.length > PROFILE_NAME_LIMIT || last.length > PROFILE_NAME_LIMIT) return null
  return { firstName: first, lastName: last }
}

export function profileNameFromAccount(fullName: string | null): ProfileName {
  const [firstName = '', ...rest] = (fullName ?? '').trim().split(/\s+/u)
  return { firstName, lastName: rest.join(' ') }
}

export function fullProfileName({ firstName, lastName }: ProfileName): string | null {
  return [firstName, lastName].filter(Boolean).join(' ') || null
}

export function profileInitials(name: ProfileName): string {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return [name.firstName, name.lastName].map((part) => {
    const first = segmenter.segment(part.trim())[Symbol.iterator]().next().value
    return first?.segment.toLocaleUpperCase() ?? ''
  }).join('')
}
