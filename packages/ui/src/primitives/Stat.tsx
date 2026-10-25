import { Stack } from './Stack'

/** Крупное число с подписью. */
export function Stat({
  value, label, hint,
}: { value: React.ReactNode; label: string; hint?: string }) {
  return (
    <Stack gap="none" className="min-w-20">
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted">{label}</span>
      {hint && <span className="text-xs text-muted/70">{hint}</span>}
    </Stack>
  )
}
