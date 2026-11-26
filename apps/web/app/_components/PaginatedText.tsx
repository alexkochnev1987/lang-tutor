'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { Button, Row } from '@polski/ui'

type Page = { start: number; end: number }

/** Split only at word boundaries, preferring complete sentences when possible.
 * A word that cannot fit on a tiny viewport gets a scrollable page of its own. */
export function paginateText(text: string, fits: (value: string) => boolean): Page[] {
  const words = Array.from(text.matchAll(/\S+\s*/gu))
  if (!words.length) return [{ start: 0, end: text.length }]
  const ends = words.map(word => word.index! + word[0].length)
  const pages: Page[] = []
  let first = 0
  while (first < ends.length) {
    const start = first === 0 ? 0 : ends[first - 1]!
    let low = first, high = ends.length - 1, best = first - 1
    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      if (fits(text.slice(start, ends[mid]!).trim())) {
        best = mid
        low = mid + 1
      } else high = mid - 1
    }
    best = Math.max(first, best)
    // Avoid leaving a mostly empty page just to preserve a sentence.
    if (best < ends.length - 1) {
      const limit = first + Math.floor((best - first) * 0.7)
      for (let j = best; j >= limit; j--) {
        if (/[.!?…]["”»)]?\s*$|\n\s*\n/u.test(words[j]![0])) {
          best = j
          break
        }
      }
    }
    pages.push({ start, end: ends[best]! })
    first = best + 1
  }
  return pages
}

export function PaginatedText({ text, active }: { text: string; active: boolean }) {
  const area = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const [pages, setPages] = useState<Page[]>([{ start: 0, end: text.length }])
  // Keep the current reading position on resize and when returning from questions.
  const [anchor, setAnchor] = useState(0)
  const index = Math.max(0, pages.findIndex(page => anchor >= page.start && anchor < page.end))
  const page = pages[index]!
  const typography = 'whitespace-pre-wrap break-words text-left text-base leading-7'

  useLayoutEffect(() => {
    const visible = area.current
    const probe = measure.current
    if (!active || !visible || !probe) return
    let cancelled = false
    let frame = 0
    const update = () => {
      frame = 0
      if (cancelled || !visible.clientWidth || !visible.clientHeight) return
      const result = paginateText(text, value => {
        probe.textContent = value
        return probe.scrollHeight <= probe.clientHeight
      })
      probe.textContent = ''
      setPages(previous => previous.length === result.length &&
        previous.every((p, i) => p.start === result[i]!.start && p.end === result[i]!.end)
        ? previous : result)
    }
    const schedule = () => {
      if (!cancelled && !frame) frame = requestAnimationFrame(update)
    }
    update()
    const observer = new ResizeObserver(schedule)
    observer.observe(visible)
    void document.fonts?.ready.then(schedule)
    return () => {
      cancelled = true
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [text, active])

  const move = (direction: number) => {
    const target = pages[index + direction]
    if (!target) return
    setAnchor(target.start)
    if (area.current) area.current.scrollTop = 0
  }

  return <section className="flex min-h-0 flex-1 flex-col gap-2" lang="pl" aria-label="Tekst do czytania">
    <div className="flex min-h-0 flex-1 flex-col rounded-card bg-soft2 p-4">
      <p className="mb-2 shrink-0 text-xs tracking-wide text-muted uppercase">Tekst</p>
      <div className="relative min-h-0 flex-1">
        <div ref={area} className={`h-full overflow-y-auto overscroll-contain ${typography}`} tabIndex={0}
          onTouchStart={event => { const point = event.touches[0]; touch.current = point ? { x: point.clientX, y: point.clientY } : null }}
          onTouchEnd={event => {
            const start = touch.current
            touch.current = null
            const end = event.changedTouches[0]
            if (!start || !end || window.getSelection()?.toString()) return
            const dx = end.clientX - start.x
            const dy = end.clientY - start.y
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1)
          }}
          onTouchCancel={() => { touch.current = null }}>
          {text.slice(page.start, page.end).trim()}
        </div>
        <div ref={measure} aria-hidden="true" className={`invisible pointer-events-none absolute inset-0 overflow-hidden ${typography}`} />
      </div>
    </div>
    {/* Reserve the controls' height to avoid changing page count when they appear. */}
    <div className={pages.length === 1 ? 'invisible shrink-0' : 'shrink-0'} inert={pages.length === 1}>
      <Row justify="between" align="center">
        <Button variant="outline" size="lg" type="button" aria-label="Poprzednia strona" disabled={index === 0} onClick={() => move(-1)}>←</Button>
        <span role="status" className="text-sm tabular-nums text-muted">Strona {index + 1} / {pages.length}</span>
        <Button variant="outline" size="lg" type="button" aria-label="Następna strona" disabled={index === pages.length - 1} onClick={() => move(1)}>→</Button>
      </Row>
    </div>
  </section>
}
