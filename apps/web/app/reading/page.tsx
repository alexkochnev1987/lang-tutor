import { notFound } from 'next/navigation'
import { ReadingPreview } from './ReadingPreview'

// Experimental practice is available independently of the approved daily lessons.
export default function ReadingPage() {
  if ((process.env.NEXT_PUBLIC_COURSE_ID ?? 'pl-b1-ru') !== 'pl-b1-ru') notFound()
  return <ReadingPreview />
}
