// The prompts behind the site's seasonal art (made with Codex's image_gen; see scripts/make-art.mjs).
// Two pieces per month:
//   bg-<month>    a dark, quiet scene behind every page (public/art/bg-<month>.webp)
//   hero-<month>  a decorative accent for the welcome card on Home (public/art/hero-<month>.webp)
// Kept generic on purpose: no people, names, places or text, since the repo is public.

const BG = (palette, scene) => `A wide 3:2 landscape painterly illustration to sit behind a dark website, in soft gouache and watercolor.
It must be VERY dark and low contrast overall, mostly deep shadow close to ${palette.bg}, so white text stays easy to read on top of it.
Put the scene in the bottom third of the frame; leave the top two thirds as calm, nearly empty dark sky with only faint texture.
Gentle, cozy, family-friendly mood. Muted colors with small soft glows only. No text, no letters, no numbers, no logos, no people, no faces.
Palette: deep ${palette.bg} background, accents of ${palette.gold}, ${palette.rush} and ${palette.aged}, highlights of ${palette.dust}.
Scene: ${scene}`

const HERO = (palette, motif) => `A wide 3:2 decorative illustration in soft gouache and watercolor, used as a corner accent on a dark website card.
Background: a flat, very dark ${palette.bg} that fills the whole frame, with no texture, no vignette and no border.
Arrange the decoration along the RIGHT edge and the bottom-right corner only, as a loose cluster that fades out toward the middle; the left half must stay empty and flat ${palette.bg}.
Rich but soft colors: ${palette.gold}, ${palette.rush}, ${palette.aged}, ${palette.dust}. Gentle, cozy, family-friendly.
No text, no letters, no numbers, no logos, no people, no faces.
Decoration: ${motif}`

export const MONTHS = [
  { key: 'january', colors: { bg: '#0d1520', gold: '#8fc8f0', rush: '#cfe8ff', aged: '#6f8fd8', dust: '#e6f2ff' },
    scene: 'snowy rolling hills with dark pine trees at night, light snowfall, one small cabin far away with a warm glowing window.',
    motif: 'a sprig of snowy pine, a few delicate snowflakes, a knitted mitten and a mug of hot cocoa with steam.' },
  { key: 'february', colors: { bg: '#1c0d14', gold: '#ff6f91', rush: '#ffb3c6', aged: '#e0314f', dust: '#ffd9e2' },
    scene: 'a quiet garden at dusk with rose bushes along a low fence, soft blurred heart-shaped bokeh lights floating in the air.',
    motif: 'red and pink roses with leaves, a few small paper hearts and a curl of ribbon.' },
  { key: 'march', colors: { bg: '#0c1a12', gold: '#5fcf80', rush: '#e8d36a', aged: '#3f9e5a', dust: '#d7f2de' },
    scene: 'green rolling hills at twilight with a stone wall and clover in the grass, a very faint rainbow arc low on the horizon.',
    motif: 'shamrocks and four-leaf clovers, a few small gold coins and early spring buds.' },
  { key: 'april', colors: { bg: '#15121f', gold: '#c3a3f0', rush: '#f7d774', aged: '#7fc8a9', dust: '#e8ddfa' },
    scene: 'a tulip field in gentle spring rain at dusk, puddles reflecting soft light, a few raindrops catching the glow.',
    motif: 'purple and yellow tulips with raindrops, pastel speckled eggs and a small umbrella.' },
  { key: 'may', colors: { bg: '#18121e', gold: '#ff9aa8', rush: '#ffd66b', aged: '#8fd18a', dust: '#ffe0e5' },
    scene: 'a blooming garden at dusk with peonies and a flowering cherry branch, a few fireflies glowing.',
    motif: 'pink peonies, cherry blossoms and small yellow wildflowers with green leaves.' },
  { key: 'june', colors: { bg: '#0c1a21', gold: '#ffc94a', rush: '#ffe28a', aged: '#4fd1c5', dust: '#fff0c2' },
    scene: 'a calm lake at late sunset with a wooden dock, the last golden light on teal water, reeds at the shore.',
    motif: 'sunflowers, a straw sun hat and a glass of lemonade with a lemon slice.' },
  { key: 'july', colors: { bg: '#0c1228', gold: '#ff6b6b', rush: '#9cc2ff', aged: '#3d6fd8', dust: '#dfe7ff' },
    scene: 'fireworks blooming softly in a night sky over a dark meadow and a line of trees, faint red and blue sparkles.',
    motif: 'red, white and blue bunting, small stars and a couple of sparkler bursts.' },
  { key: 'august', colors: { bg: '#081b1e', gold: '#3fd0c9', rush: '#ffd27a', aged: '#ff8a65', dust: '#d4f5f2' },
    scene: 'a quiet beach at dusk, gentle waves, a striped beach umbrella and dune grass, the sea glowing faintly teal.',
    motif: 'seashells, a starfish, a slice of watermelon and a pair of sunglasses.' },
  { key: 'september', colors: { bg: '#15170e', gold: '#e8b23a', rush: '#f2d36b', aged: '#d9483b', dust: '#f5e8c2' },
    scene: 'an apple orchard at dusk, rows of trees heavy with red apples, a wooden ladder and a basket in the grass.',
    motif: 'red apples with leaves, a wooden crate, a few yellow pencils and early autumn leaves.' },
  { key: 'october', colors: { bg: '#110c17', gold: '#ff8a1f', rush: '#b98cff', aged: '#7ad957', dust: '#f1dcc4' },
    scene: 'a moonlit pumpkin patch with a crooked wooden fence, a few small bats far off against a purple night sky.',
    motif: 'friendly jack-o\'-lanterns, curly pumpkin vines, a few small cute bats and fallen leaves.' },
  { key: 'november', colors: { bg: '#1a120c', gold: '#f0a04b', rush: '#f2cf6b', aged: '#c8553d', dust: '#f3dfb8' },
    scene: 'a harvest field at dusk with round hay bales, corn shocks and autumn trees, warm amber light on the horizon.',
    motif: 'autumn maple leaves, small pumpkins and gourds, wheat stalks and a few acorns.' },
  { key: 'december', colors: { bg: '#0b1712', gold: '#ff5d5d', rush: '#f4d37a', aged: '#4caf6e', dust: '#f6e6c4' },
    scene: 'a snowy evening among pine trees strung with warm little lights, soft snowfall, a glowing window far away.',
    motif: 'evergreen garland with red ornaments, holly berries, a small wrapped present and warm string lights.' },
]

export const JOBS = MONTHS.flatMap((m) => [
  { name: `bg-${m.key}`, prompt: BG(m.colors, m.scene) },
  { name: `hero-${m.key}`, prompt: HERO(m.colors, m.motif) },
])
