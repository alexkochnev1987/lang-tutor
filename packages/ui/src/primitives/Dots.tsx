/** Три кружка-превью палитры в переключателе оформления. */
export function Dots({ colors }: { colors: readonly [string, string, string] }) {
  return (
    <span className="inline-flex shrink-0 items-center">
      {colors.map((c, i) => (
        <i
          key={c + i}
          aria-hidden
          className="block size-4 rounded-pill border border-line not-first:-ml-1.5"
          style={{ background: c }}
        />
      ))}
    </span>
  )
}
