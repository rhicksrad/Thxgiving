import {
  Apple, Baby, Beer, Bird, BookOpen, CakeSlice, Car, Carrot, Cat, ChefHat, Cherry, Coffee, Cookie, Croissant, Crown,
  Dices, Dog, Drumstick, Fish, Flame, Flower, Gamepad2, Gift, Glasses, Grape, Guitar, Ham, HandHeart, Heart, House,
  IceCreamCone, Leaf, Music, PawPrint, Plane, Puzzle, Rabbit, Salad, Smile, Snowflake, Soup, Sparkles, Sprout,
  Squirrel, Star, Sun, TreeDeciduous, Trophy, Tv, Turtle, Wheat, Wine,
  type LucideIcon,
} from 'lucide-react'
import type { Profile } from '../lib/types'
import { useSignedUrls } from '../lib/signedUrls'

// Badge tints, tuned to read on the dark harvest UI.
const TINT = {
  pumpkin: '#f0a04b', cranberry: '#e3707a', maize: '#f2cf6b', sage: '#9cc48a',
  sky: '#8fb8e0', plum: '#c09be0', bark: '#c9a27e', rose: '#ec98b0',
}
type Tint = keyof typeof TINT

/** The avatar badges people pick from. The key is what gets saved in profiles.emoji. */
export const BADGES: { key: string; Icon: LucideIcon; tint: Tint; label: string }[] = [
  { key: 'turkey', Icon: Bird, tint: 'pumpkin', label: 'Turkey' },
  { key: 'drumstick', Icon: Drumstick, tint: 'bark', label: 'Drumstick' },
  { key: 'ham', Icon: Ham, tint: 'rose', label: 'Ham' },
  { key: 'pie', Icon: CakeSlice, tint: 'pumpkin', label: 'Pie' },
  { key: 'leaf', Icon: Leaf, tint: 'pumpkin', label: 'Leaf' },
  { key: 'tree', Icon: TreeDeciduous, tint: 'sage', label: 'Oak' },
  { key: 'wheat', Icon: Wheat, tint: 'maize', label: 'Wheat' },
  { key: 'corn', Icon: Sprout, tint: 'sage', label: 'Sprout' },
  { key: 'apple', Icon: Apple, tint: 'cranberry', label: 'Apple' },
  { key: 'cherry', Icon: Cherry, tint: 'cranberry', label: 'Cranberry' },
  { key: 'grape', Icon: Grape, tint: 'plum', label: 'Grapes' },
  { key: 'carrot', Icon: Carrot, tint: 'pumpkin', label: 'Carrot' },
  { key: 'salad', Icon: Salad, tint: 'sage', label: 'Salad' },
  { key: 'soup', Icon: Soup, tint: 'maize', label: 'Gravy boat' },
  { key: 'roll', Icon: Croissant, tint: 'maize', label: 'Roll' },
  { key: 'cookie', Icon: Cookie, tint: 'bark', label: 'Cookie' },
  { key: 'icecream', Icon: IceCreamCone, tint: 'rose', label: 'Ice cream' },
  { key: 'chef', Icon: ChefHat, tint: 'maize', label: 'Chef' },
  { key: 'coffee', Icon: Coffee, tint: 'bark', label: 'Coffee' },
  { key: 'wine', Icon: Wine, tint: 'cranberry', label: 'Wine' },
  { key: 'beer', Icon: Beer, tint: 'maize', label: 'Beer' },
  { key: 'house', Icon: House, tint: 'bark', label: 'Home' },
  { key: 'heart', Icon: Heart, tint: 'cranberry', label: 'Heart' },
  { key: 'thankful', Icon: HandHeart, tint: 'rose', label: 'Thankful' },
  { key: 'baby', Icon: Baby, tint: 'sky', label: 'Baby' },
  { key: 'crown', Icon: Crown, tint: 'maize', label: 'Crown' },
  { key: 'star', Icon: Star, tint: 'maize', label: 'Star' },
  { key: 'sparkles', Icon: Sparkles, tint: 'plum', label: 'Sparkles' },
  { key: 'gift', Icon: Gift, tint: 'cranberry', label: 'Gift' },
  { key: 'flower', Icon: Flower, tint: 'rose', label: 'Flower' },
  { key: 'sun', Icon: Sun, tint: 'maize', label: 'Sun' },
  { key: 'snowflake', Icon: Snowflake, tint: 'sky', label: 'Snowflake' },
  { key: 'flame', Icon: Flame, tint: 'pumpkin', label: 'Fireplace' },
  { key: 'trophy', Icon: Trophy, tint: 'maize', label: 'Trophy' },
  { key: 'tv', Icon: Tv, tint: 'sky', label: 'Football on TV' },
  { key: 'game', Icon: Gamepad2, tint: 'plum', label: 'Games' },
  { key: 'dice', Icon: Dices, tint: 'sage', label: 'Board games' },
  { key: 'puzzle', Icon: Puzzle, tint: 'sky', label: 'Puzzle' },
  { key: 'book', Icon: BookOpen, tint: 'bark', label: 'Book' },
  { key: 'music', Icon: Music, tint: 'plum', label: 'Music' },
  { key: 'guitar', Icon: Guitar, tint: 'bark', label: 'Guitar' },
  { key: 'glasses', Icon: Glasses, tint: 'sky', label: 'Glasses' },
  { key: 'smile', Icon: Smile, tint: 'sage', label: 'Smile' },
  { key: 'car', Icon: Car, tint: 'sky', label: 'Road trip' },
  { key: 'plane', Icon: Plane, tint: 'sky', label: 'Flying in' },
  { key: 'dog', Icon: Dog, tint: 'bark', label: 'Dog' },
  { key: 'cat', Icon: Cat, tint: 'plum', label: 'Cat' },
  { key: 'paw', Icon: PawPrint, tint: 'bark', label: 'Paw' },
  { key: 'rabbit', Icon: Rabbit, tint: 'rose', label: 'Bunny' },
  { key: 'squirrel', Icon: Squirrel, tint: 'bark', label: 'Squirrel' },
  { key: 'turtle', Icon: Turtle, tint: 'sage', label: 'Turtle' },
  { key: 'fish', Icon: Fish, tint: 'sky', label: 'Fish' },
]
const BY_KEY = Object.fromEntries(BADGES.map((b) => [b.key, b]))

export const DEFAULT_BADGE = 'turkey'

/** The badge for a saved profiles.emoji value, if there is one. */
export const badgeFor = (value?: string | null) => (value ? BY_KEY[value] : undefined)

const initials = (name?: string) =>
  (name ?? '?').trim().split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean)
    .slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'

/** Someone's avatar: their photo, else their badge, else initials. */
export function Avatar({ p, size = 32, className = '' }: { p?: Profile | null; size?: number; className?: string }) {
  const url = useSignedUrls(p?.avatar_path ? [p.avatar_path] : [])(p?.avatar_path)
  const style = { width: size, height: size }
  const title = p?.display_name
  if (url) {
    return <img className={`avatar photo ${className}`} style={style} src={url} alt="" title={title} draggable={false} />
  }
  return <Badge value={p?.emoji} name={p?.display_name} size={size} className={className} title={title} />
}

/** A badge on its own (the picker uses this too). Unknown values fall back to initials. */
export function Badge({ value, name, size = 32, className = '', title }: {
  value?: string | null; name?: string; size?: number; className?: string; title?: string
}) {
  const b = badgeFor(value)
  const style = { width: size, height: size, '--tint': TINT[b?.tint ?? 'pumpkin'] } as React.CSSProperties
  return (
    <span className={`avatar ${b ? 'badge-av' : 'initials'} ${className}`} style={style} title={title}>
      {b
        ? <b.Icon size={Math.round(size * 0.52)} strokeWidth={size < 28 ? 2.25 : 1.9} aria-hidden="true" />
        : <span style={{ fontSize: Math.round(size * 0.4) }}>{initials(name)}</span>}
    </span>
  )
}

export const nameOf = (p?: Profile | null) => p?.display_name ?? 'Someone'
