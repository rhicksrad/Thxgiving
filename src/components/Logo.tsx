import { HOME_MARK } from '../lib/marks'
import { useTheme } from '../lib/theme'

/** This month's emblem (a snowflake in January, the turkey in November…), or the year-round house with `home`. */
export default function Logo({ size = 40, className = '', home = false }: { size?: number; className?: string; home?: boolean }) {
  const theme = useTheme()
  return (
    <svg className={`logo ${className}`} width={size} height={size} viewBox="-3 -1 70 66" aria-hidden="true" focusable="false"
      dangerouslySetInnerHTML={{ __html: home ? HOME_MARK : theme.mark }} />
  )
}
