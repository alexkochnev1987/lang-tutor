import { notFound } from 'next/navigation'
import { ReadingPreview } from './ReadingPreview'

// Preview is deliberately inaccessible in production. The generated files are also absent there.
export default function ReadingPage() {
  const enabled = process.env.VERCEL_ENV !== 'production' &&
    (process.env.VERCEL_ENV === 'preview' || (!process.env.VERCEL && process.env.READING_PREVIEW === '1'))
  if (!enabled) notFound()
  return <ReadingPreview />
}
