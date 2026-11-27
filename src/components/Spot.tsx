// A small painted illustration (public/art/spot-<name>.webp, made with Codex, background made see-through by
// scripts/art-webp.py), so it sits on any month's colors. Purely decoration.
export type SpotName = 'calendar' | 'chat' | 'photos' | 'family' | 'mine' | 'gather'

export const artUrl = (file: string) => new URL(`art/${file}.webp`, document.baseURI).href

export default function Spot({ name, size = 96, className = '' }: { name: SpotName; size?: number; className?: string }) {
  return <img className={`spot ${className}`} src={artUrl(`spot-${name}`)} width={size} height={size} alt="" aria-hidden="true" loading="lazy" decoding="async" />
}
