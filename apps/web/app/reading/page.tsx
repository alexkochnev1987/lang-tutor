import { ReadingPreview } from './ReadingPreview'

export default function ReadingPage() {
  const preview = process.env.VERCEL_ENV !== 'production' &&
    (process.env.VERCEL_ENV === 'preview' || (!process.env.VERCEL && process.env.READING_PREVIEW === '1'))
  return <ReadingPreview preview={preview} />
}
