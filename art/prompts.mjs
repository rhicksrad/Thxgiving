// The prompts behind the site's painted art (made with Codex's image_gen; see scripts/make-art.mjs).
// Per month:
//   bg-<month>    a dark, quiet scene behind every page (public/art/bg-<month>.webp)
//   hero-<month>  a decorative accent for the welcome card and get-together pages (public/art/hero-<month>.webp)
// Year-round:
//   spot-<name>   small painted illustrations for page headers, Home's shortcuts and empty states
//   welcome       the sign-in page's picture
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

// Year-round pieces have to sit on any month's colors, so they use a warm neutral palette on near-black, and the
// site drops the black with a "lighten" blend.
const SPOT = (subject) => `A square 1:1 small spot illustration in soft gouache and watercolor, like a cozy storybook vignette.
Background: perfectly flat solid near-black #0b0b0b filling the whole frame, no texture, no vignette, no frame, no shadow on the ground.
One centered subject, about 60% of the frame, with generous empty margin all around.
Warm, soft, glowing palette: cream #f3e6cc, honey gold #e9b25a, warm coral #e57a5f, sage green #8db38a, soft sky blue #8fb8e0, with gentle warm highlights.
Friendly, simple shapes that read well when shown small. No text, no letters, no numbers, no logos, no people, no faces.
Subject: ${subject}`

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

export const SPOTS = {
  calendar: 'a small wall calendar page with a red ribbon bookmark and a sprig of leaves, a pencil resting beside it.',
  chat: 'two steaming coffee mugs side by side with two little speech bubbles floating up like steam.',
  photos: 'a loose stack of three instant photos (blank warm-toned pictures, no faces) with a small vintage camera.',
  family: 'a cozy little house with glowing windows, a heart on the door and a curl of chimney smoke, a small tree beside it.',
  mine: 'an open keepsake journal with a ribbon bookmark, a dried flower pressed inside and a small brass key.',
  gather: 'a round dinner table seen from above with a pie, a bowl of salad, a pitcher and a candle, cozy and inviting.',
}

// Birthday looks (src/lib/birthdays.ts `art`): keyed by theme, never by person, since the repo is public.
//   bg-bday-<key>, hero-bday-<key>: used on that person's day exactly like the month pieces.
export const BIRTHDAYS = [
  { key: 'garden-opera', colors: { bg: '#0d1a12', gold: '#d9b45a', rush: '#e0475e', aged: '#3f8f5a', dust: '#f3e3c8' },
    scene: 'a moonlit rose garden in full bloom leading up to the glowing arched doors of a grand old opera house, a hint of red velvet curtain and gold balconies through the windows.',
    motif: 'climbing red roses and green leaves woven around a gold opera balcony rail, a swag of red velvet curtain with a gold tassel, and a few floating music notes.' },
  { key: 'fishing-news', colors: { bg: '#0b1a1f', gold: '#f2d27a', rush: '#7cc6d6', aged: '#2f8f9a', dust: '#eef4e6' },
    scene: 'a still lake at first light with mist on the water, a small wooden dock with a fishing rod leaning on a post and a tackle box, pines on the far shore.',
    motif: 'a fishing rod with a red and white bobber, a tackle box, a folded morning newspaper with blank columns (no readable text) and a steaming mug of coffee.' },
  { key: 'chiefs', colors: { bg: '#1a0b0d', gold: '#f2c14e', rush: '#ffd76a', aged: '#d62b3a', dust: '#fbe9d0' },
    scene: 'a football stadium at night seen from the field, bright stadium lights, red and gold crowd glow, a football resting on the grass at the fifty. Team colors only: absolutely no logos, no wordmarks, no arrowheads, no letters or numbers.',
    motif: 'a football, red and gold pennants with no lettering, a red foam finger with no lettering, gold streamers and confetti. No logos, no arrowheads, no letters or numbers.' },
  { key: 'grill-football', colors: { bg: '#18110b', gold: '#f29a4a', rush: '#ffd27a', aged: '#5f9e4a', dust: '#f6e8d0' },
    scene: 'a backyard at dusk with a charcoal kettle grill glowing and smoking, burgers on the grate, a football lying on the lawn, warm string lights across a wooden fence.',
    motif: 'a charcoal grill with sizzling burgers and smoke, a spatula, a football, and a curl of string lights.' },
  { key: 'pets-beach', colors: { bg: '#081a1d', gold: '#ff9a8a', rush: '#ffd9a0', aged: '#3fc9c1', dust: '#e8f7f4' },
    scene: 'a sunny beach in the golden late afternoon, gentle aqua waves, soft sand with seashells, a playful puppy and a curious kitten sitting together at the water line, seen small in the distance.',
    motif: 'a cute puppy and a fluffy kitten cuddled together on a beach towel, seashells, a starfish and a little sand bucket.' },
  { key: 'navy-tattoo', colors: { bg: '#0a1326', gold: '#e7c15a', rush: '#f3e6c8', aged: '#c8323b', dust: '#f6eedc' },
    scene: 'a tall sailing ship on a dark night ocean under nautical stars, painted in bold American traditional sailor tattoo flash style with thick confident outlines and limited flat colors, rope border along the bottom edge.',
    motif: 'American traditional sailor tattoo flash: a bold anchor wrapped in rope, two swallows, a nautical star and an empty banner scroll with NO text, thick black outlines, navy, cream, red and gold.' },
  { key: 'ai-it', colors: { bg: '#0a1024', gold: '#5fe0f0', rush: '#a98cff', aged: '#3a6fd8', dust: '#e2f4ff' },
    scene: 'a cozy night-time tech nook: a server rack with blinking cyan lights, a glowing laptop on a desk, network cables, faint glowing circuit traces running along the floor, and a small friendly round helper robot. No readable text on any screen.',
    motif: 'a cute friendly round helper robot waving, a glowing laptop with an abstract screen (no text), coiled network cables, a small server rack with blinking lights and circuit traces.' },
  { key: 'podcast-party', colors: { bg: '#170c1c', gold: '#ff9a4a', rush: '#ff7ab6', aged: '#9a6cff', dust: '#fde6f0' },
    scene: 'a lively house party at night seen from the yard: warm glowing windows with small silhouettes of friends gathered inside, string lights across the porch, and on a porch table a podcast microphone with headphones. Silhouettes only, no faces.',
    motif: 'a podcast microphone on a stand with headphones, string lights, party cups, a few balloons and confetti.' },
  { key: 'calm-pilates', colors: { bg: '#121a16', gold: '#e8a7b5', rush: '#c3b2ea', aged: '#8fb89a', dust: '#f4ece6' },
    scene: 'a serene Pilates studio at soft dawn: a wooden reformer and a rolled mat by tall windows, potted plants, and in the corner a cozy armchair with a cup of tea and a small side table.',
    motif: 'a rolled yoga mat, a Pilates ring, a trailing pothos plant, a cozy armchair corner with a cup of tea and a small notebook.' },
  { key: 'grandma', colors: { bg: '#1c120d', gold: '#e9b25a', rush: '#e58a8f', aged: '#b5673a', dust: '#f6e8d2' },
    scene: 'the coziest grandma\'s house at evening seen through a warm window: a rocking chair with a patchwork quilt, a pie and cookies cooling on the sill, a knitting basket with yarn, a teapot, flowers in a vase and framed family photos on the wall (no faces in detail). Rich, warm and loving.',
    motif: 'all the grandma goodness: a lattice-top cherry pie and a plate of cookies, a flowered teapot and teacup, a knitting basket with yarn and needles, a patchwork quilt corner, roses in a vase and a little framed photo (no faces in detail).' },
  { key: 'dogs-plants', colors: { bg: '#10170e', gold: '#f2c45a', rush: '#e08a5a', aged: '#5fa65a', dust: '#f4ecd8' },
    scene: 'a cozy family living room at evening full of houseplants in terracotta pots, two happy dogs lounging on a rug by the couch, warm lamp light, framed family photos on the wall (no faces in detail).',
    motif: 'two happy dogs curled up together among potted houseplants in terracotta pots (monstera, pothos, snake plant), a dog bone and a little framed photo (no faces in detail).' },
  { key: 'storm-chaser', colors: { bg: '#0b0f22', gold: '#f5d64a', rush: '#8fc0ef', aged: '#4a4fa8', dust: '#e6ecf8' },
    scene: 'a dramatic rotating supercell thunderstorm over open plains at dusk, a fork of lightning, a storm-chase pickup truck parked on a straight country road with a small weather dish on its roof. No readable text.',
    motif: 'a fork of yellow lightning out of a dark storm cloud, a weather vane, a small radar dish, a windsock and a storm-chase pickup truck. No readable text.' },
  { key: 'newsroom-dogs', colors: { bg: '#0a1124', gold: '#f2c35a', rush: '#e5414a', aged: '#3a5fb8', dust: '#eef1f8' },
    scene: 'a TV news studio after hours: studio cameras, a glowing anchor desk, a wall of monitors showing only abstract colored shapes, a red on-air light with no lettering, and two happy dogs lounging by the desk. No readable text, no logos.',
    motif: 'a studio TV camera, a desk microphone, a red on-air light with no lettering, a clipboard with blank pages, and a happy dog wearing headphones. No readable text, no logos.' },
  { key: 'gamer-youtuber', colors: { bg: '#120a1f', gold: '#5ff28a', rush: '#ff5fb8', aged: '#8a4fe0', dust: '#f1e8ff' },
    scene: 'a gamer and video creator setup in a dark room: an RGB-lit desk glowing violet, green and pink, a monitor with abstract shapes, a game controller, a headset, a streaming microphone on an arm and a ring light. No brand logos, no text.',
    motif: 'a game controller, a gaming headset, a streaming microphone, a ring light, a generic rounded play-button shape and a thumbs-up shape, with neon glow. No brand logos, no text.' },
]

export const JOBS = [
  ...BIRTHDAYS.flatMap((b) => [
    { name: `bg-bday-${b.key}`, prompt: BG(b.colors, b.scene) },
    { name: `hero-bday-${b.key}`, prompt: HERO(b.colors, b.motif) },
  ]),
  ...MONTHS.flatMap((m) => [
    { name: `bg-${m.key}`, prompt: BG(m.colors, m.scene) },
    { name: `hero-${m.key}`, prompt: HERO(m.colors, m.motif) },
  ]),
  ...Object.entries(SPOTS).map(([name, subject]) => ({ name: `spot-${name}`, prompt: SPOT(subject) })),
  { name: 'welcome', prompt: `A wide 3:2 painterly storybook illustration in soft gouache and watercolor for the sign-in page of a family website.
A cozy small house at dusk on a gentle hill, every window glowing warm, a heart shape on the front door, smoke curling from the chimney,
a winding path with little lanterns leading up to it, a few trees around, a big calm dark blue-violet evening sky with a few stars.
The house and hill sit in the lower half; the sky above stays dark and calm. Warm cream, honey gold and coral lights against deep blue shadows.
No text, no letters, no numbers, no logos, no people, no faces.` },
]
