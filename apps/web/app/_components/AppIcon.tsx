const paths = {
  today: 'M7 3v4m10-4v4M4 10h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm3 10 2 2 4-4',
  course: 'M6 17h.01M18 7h.01M8 17h6a3 3 0 0 0 0-6h-4a2 2 0 0 1 0-4h6M8 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm12-10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  words: 'M8 5h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM3 16V6a4 4 0 0 1 4-4h10M10 10h7m-7 4h4',
  grammar: 'M12 6a7 7 0 0 0-8-2v15a7 7 0 0 1 8 2 7 7 0 0 1 8-2V4a7 7 0 0 0-8 2Zm0 0v15',
  profile: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 20a8 8 0 0 1 16 0',
  review: 'M20 9a8 8 0 1 0 0 6m0-10v4h-4M12 8v4l3 2',
  speaker: 'M4 9h4l4-4v14l-4-4H4Zm11 0a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12',
  muted: 'M4 9h4l4-4v14l-4-4H4Zm11 1 5 5m0-5-5 5',
  sync: 'M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 2M4 17l2 2a8 8 0 0 0 13-3',
  cloudOff: 'M3 3l18 18M7 7a6 6 0 0 0-1 12h12M9 5a7 7 0 0 1 9 6h1a4 4 0 0 1 2 7',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  back: 'M19 12H5m7-7-7 7 7 7',
} as const

export function AppIcon({ name, className }: { name: keyof typeof paths; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={paths[name]} />
    </svg>
  )
}
