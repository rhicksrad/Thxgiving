import { useMemo } from 'react'
import { PARTICLES } from '../lib/marks'
import { useTheme } from '../lib/theme'

const COUNT = 16

/** This month's little things drifting behind the page: snow, hearts, clovers, leaves, bats… Purely decoration. */
export default function SeasonSky() {
  const theme = useTheme()
  // Fixed "random" spots so the sky doesn't reshuffle on every render.
  const bits = useMemo(() => Array.from({ length: COUNT }, (_, i) => {
    const r = (n: number) => ((Math.sin((i + 1) * 9301 + n * 49297) + 1) / 2)
    return {
      left: `${(i / COUNT) * 100 + r(1) * (100 / COUNT)}%`,
      top: `${r(2) * 100}%`,
      size: 10 + Math.round(r(3) * 14),
      delay: `${-r(4) * 30}s`,
      dur: `${18 + r(5) * 22}s`,
      color: [theme.colors.gold, theme.colors.rush, theme.colors.aged][i % 3],
    }
  }), [theme])
  const svg = PARTICLES[theme.particle]
  return (
    <div className={`season-sky ${theme.motion}`} aria-hidden="true">
      {bits.map((b, i) => (
        <span key={i} style={{ left: b.left, top: b.top, width: b.size, height: b.size, animationDelay: b.delay, animationDuration: b.dur, color: b.color }}>
          <svg viewBox="0 0 24 24" width="100%" height="100%" dangerouslySetInnerHTML={{ __html: svg }} />
        </span>
      ))}
    </div>
  )
}
