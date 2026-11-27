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

// One-day looks for holidays and special days (src/lib/days.ts): bg-day-<key>, hero-day-<key>.
const C = (bg, gold, rush, aged, dust) => ({ bg, gold, rush, aged, dust })
export const DAYS = [
  { key: 'nye', colors: C('#0b0a10', '#e9c46a', '#f6e7b0', '#8a6d2f', '#fff6dc'),
    scene: 'a city skyline at midnight with golden fireworks bursting, a grand clock tower with its hands near twelve, sparkling gold and black.',
    motif: 'two champagne glasses clinking, a gold clock with hands at nearly twelve, streamers, gold confetti and a party popper.' },
  { key: 'newyear', colors: C('#0c1622', '#e9c46a', '#cfe8ff', '#6fa3d8', '#f4f9ff'),
    scene: 'a bright crisp winter morning over snowy hills, the first sunrise of the year, a few leftover confetti pieces and streamers on the snow.',
    motif: 'party hats, a noisemaker, gold and icy blue confetti, a fresh blank calendar page and a steaming mug.' },
  { key: 'valentine', colors: C('#1c0b12', '#ff6f91', '#ffb3c6', '#d62f50', '#ffe0e8'),
    scene: 'a cozy candlelit evening in a garden with soft glowing hearts floating in the air and climbing roses on a trellis.',
    motif: 'red and pink roses, sealed love letters with heart wax seals, a box of chocolates and little hearts.' },
  { key: 'stpatrick', colors: C('#0a180f', '#5fcf80', '#f2d36b', '#2f8f4a', '#e3f6e8'),
    scene: 'rolling green hills under a bright rainbow that ends at a pot of gold, stone walls and clover, evening light.',
    motif: 'a pot of gold coins, shamrocks and four-leaf clovers, a green bowler hat and a little rainbow.' },
  { key: 'easter', colors: C('#15121c', '#f2a7c3', '#f7e07a', '#8fd1a8', '#f4edff'),
    scene: 'a spring meadow at golden hour with tulips and daffodils, painted eggs hidden in the grass and a bunny peeking out.',
    motif: 'a basket of pastel painted eggs, a fluffy bunny, tulips, daffodils and a ribbon bow.' },
  { key: 'mothers', colors: C('#1a0f16', '#f2a1b8', '#ffd6a0', '#c86f8f', '#ffeef3'),
    scene: 'a sunny kitchen window at morning with a big bouquet of peonies and a breakfast tray on the table, soft pink light.',
    motif: 'a bouquet of pink peonies and roses, a breakfast-in-bed tray with coffee, pancakes and a small handmade card with no text.' },
  { key: 'fathers', colors: C('#0d1420', '#d9b37a', '#e6d3a8', '#3a5f8a', '#f3ecdd'),
    scene: 'a backyard at late afternoon with a hammock strung between two trees, a grill smoking gently and a toolbox on the porch steps.',
    motif: 'a hammock, a grill spatula and tongs, a toolbox with a hammer and wrench, a fishing hat and a mug.' },
  { key: 'memorial', colors: C('#0b1020', '#d9b45a', '#e8ecf5', '#b5313b', '#f4f1ea'),
    scene: 'a quiet, respectful field of small American flags and red poppies at sunset, rolling hills and a calm sky.',
    motif: 'a folded American flag, red poppies and a few small flags, calm and respectful.' },
  { key: 'veterans', colors: C('#0a1024', '#d9b45a', '#e8ecf5', '#b5313b', '#f4f1ea'),
    scene: 'a respectful dusk scene of an American flag waving on a tall pole over a quiet memorial green with white stars faintly in the sky. No people.',
    motif: 'an American flag, white stars, a gold service medal on a ribbon and a few red poppies. No faces.' },
  { key: 'july4', colors: C('#0b1128', '#ff6b6b', '#9cc2ff', '#3d6fd8', '#f1f4ff'),
    scene: 'fireworks bursting in red, white and blue over a backyard cookout with string lights and a picnic table.',
    motif: 'bunting in red, white and blue, sparklers, a watermelon slice, a hot dog and small stars.' },
  { key: 'halloween', colors: C('#110a17', '#ff8a1f', '#b98cff', '#7ad957', '#f1dcc4'),
    scene: 'a friendly haunted house on a hill under a full moon, glowing jack-o\'-lanterns along the path and bats in the purple sky.',
    motif: 'glowing jack-o\'-lanterns, a black cat, a witch hat, candy corn, a cauldron and small cute bats.' },
  { key: 'thanksgiving', colors: C('#1a110a', '#f0a04b', '#f2cf6b', '#c8553d', '#f6e6c8'),
    scene: 'a warm farmhouse dining room at dusk seen through the window: a long harvest table set with a roast turkey, pies and candles, autumn trees outside.',
    motif: 'a roast turkey on a platter, a pumpkin pie and an apple pie, autumn leaves, gourds and a candle.' },
  { key: 'xmas-eve', colors: C('#0a1220', '#f4d37a', '#e8f0ff', '#c8323b', '#f4eedc'),
    scene: 'a snowy village on Christmas Eve night, warm lit windows, and the silhouette of a sleigh with reindeer flying across a big full moon.',
    motif: 'a plate of cookies and a glass of milk, a candle, a sprig of holly, a small sleigh bell and falling snow.' },
  { key: 'christmas', colors: C('#0b1712', '#ff5d5d', '#f4d37a', '#4caf6e', '#f6e6c4'),
    scene: 'a cozy living room on Christmas morning: a glowing decorated tree with presents underneath, stockings hung on a stone fireplace with a fire.',
    motif: 'wrapped presents with red bows, a stocking, ornaments, a candy cane, holly and warm lights.' },
  { key: 'superbowl', colors: C('#0d1218', '#f2b84a', '#7fc8a0', '#c8553d', '#f3efe6'),
    scene: 'a living room football watch party at night: a big TV glowing with an abstract green field (no logos), a couch, a coffee table covered in snacks.',
    motif: 'a football, a platter of chicken wings, a bowl of chips and dip, a foam finger and a pennant with no lettering. No logos.' },
  { key: 'pi', colors: C('#14110d', '#f0b45a', '#f6d7a0', '#c8553d', '#f6eadc'),
    scene: 'a bakery window at evening with rows of pies cooling and a chalk-drawn pi symbol on the glass, playful and warm.',
    motif: 'a lattice pie, a slice of pie, a big friendly pi symbol, a rolling pin and a few cherries.' },
  { key: 'aprilfools', colors: C('#140f1f', '#ffcf4a', '#7fe0c8', '#ff6fa8', '#f8f0ff'),
    scene: 'a silly topsy-turvy living room where the furniture floats upside down, confetti in the air, playful jester colors.',
    motif: 'a jester hat with bells, a whoopee cushion, a rubber chicken, a joy buzzer and confetti, silly and playful.' },
  { key: 'earth', colors: C('#0a1712', '#6fd08c', '#8fc8f0', '#3f9e5a', '#e8f6ea'),
    scene: 'planet Earth glowing green and blue rising over a forest of young trees and wildflowers at dusk.',
    motif: 'a small green and blue globe wrapped in leaves, a sapling in soil, wildflowers and a watering can.' },
  { key: 'indy500', colors: C('#0e0f12', '#f2c94a', '#e8e8e8', '#d23b3b', '#f6f2e6'),
    scene: 'a sunny race day at a historic oval speedway: grandstands, a strip of old bricks at the finish line, an open-wheel race car flying past, checkered flags waving. No sponsor logos, no text.',
    motif: 'an open-wheel race car, crossed checkered flags, a bottle of milk, a few old bricks and a laurel wreath. No sponsor logos, no text.' },
  { key: 'summer', colors: C('#0a1a21', '#ffc94a', '#ffe28a', '#3fc9c1', '#fff2c8'),
    scene: 'the first evening of summer at a backyard pool, the sun setting golden, a float in the water and palm-like leaves.',
    motif: 'a big smiling sun, a pool float, a glass of lemonade, sunglasses and a beach ball.' },
  { key: 'fall', colors: C('#18110a', '#e8a23a', '#f2d36b', '#c8463b', '#f6e4c8'),
    scene: 'the first day of fall: a country lane lined with red and gold trees, leaves drifting, pumpkins by a wooden fence.',
    motif: 'red and gold maple leaves, small pumpkins, a cozy knit sweater, a mug of cider and acorns.' },
  { key: 'grandparents', colors: C('#1a120d', '#e9b25a', '#e58a8f', '#8a6d4a', '#f6e8d2'),
    scene: 'a farmhouse porch at golden hour with a porch swing and two rocking chairs, flower boxes and lemonade on a little table.',
    motif: 'an open photo album with blank pictures (no faces), reading glasses, a knitted blanket, a teacup and a few flowers.' },
  { key: 'blackfriday', colors: C('#141010', '#f0a04b', '#f6d27a', '#a85a3a', '#f4e8d8'),
    scene: 'a cozy living room the day after Thanksgiving: a couch with blankets, leftovers on the coffee table, shopping bags by the door, a fire in the fireplace.',
    motif: 'a turkey sandwich, a slice of pumpkin pie, a fuzzy blanket and two shopping bags with no logos or text.' },
  { key: 'beach', colors: C('#081a22', '#ffb36b', '#ffe0a8', '#3fb8c8', '#eef8f6'),
    scene: 'a South Carolina island beach at sunset: sand dunes with sea oats, palmetto trees, a red and white striped lighthouse, beach umbrellas and calm ocean.',
    motif: 'a striped beach umbrella, a sand bucket and shovel, seashells, a palmetto frond and a little lighthouse.' },
  { key: 'together', colors: C('#17100c', '#f2b45a', '#ffd9a0', '#c8553d', '#f8ecdc'),
    scene: 'a big family house at dusk with every window glowing, cars in the driveway, string lights in the yard and a long table set outside. Small silhouettes only, no faces.',
    motif: 'a long table with dishes being passed, string lights, a welcome wreath on a door and lots of chairs. No faces.' },
]

// Second and third tier days.
DAYS.push(
  { key: 'mlk', colors: C('#0c1220', '#e9c46a', '#cfe0f5', '#6a7fb8', '#f4f1ea'),
    scene: 'a quiet, dignified dawn over a long reflecting pool with a lit podium and microphones at the near end and white doves rising into the soft light. No people, no faces, no text.',
    motif: 'a podium microphone, white doves in flight and a soft sunrise glow. No faces, no text.' },
  { key: 'groundhog', colors: C('#0e1418', '#e9c46a', '#cfe0f5', '#8a6d4a', '#f2f4f6'),
    scene: 'a snowy meadow at morning where a groundhog peeks out of its burrow, its shadow stretched long on the snow.',
    motif: 'a cute groundhog popping out of a snowy burrow, its shadow beside it, a few snowflakes.' },
  { key: 'presidents', colors: C('#0b1128', '#e9c46a', '#e8ecf5', '#b5313b', '#f4f1ea'),
    scene: 'a classic marble monument at dusk with flags and red, white and blue bunting, stars in the sky. No faces, no text.',
    motif: 'a stovepipe hat, a tricorn hat, a quill pen, stars and bunting. No faces, no text.' },
  { key: 'mardigras', colors: C('#140c1c', '#e9c46a', '#5fcf80', '#8a4fe0', '#f6eefc'),
    scene: 'a festive street at night with balconies hung with purple, green and gold beads and lanterns, confetti in the air.',
    motif: 'a feathered carnival mask, strings of purple, green and gold beads and a slice of king cake.' },
  { key: 'spring', colors: C('#111a14', '#f2c45a', '#c3a3f0', '#6fbf7a', '#f2f6ea'),
    scene: 'the first day of spring: crocuses pushing up through melting snow in a garden, a robin on a branch with fresh buds.',
    motif: 'purple and yellow crocuses, a robin, budding branches and a little melting snow.' },
  { key: 'taxday', colors: C('#0f1418', '#7fd08a', '#f2d36b', '#4a8f6a', '#eef4ee'),
    scene: 'a playful home desk at night with a calculator, a cup of coffee, a lamp and stacks of paper forms with no readable text.',
    motif: 'a calculator, a pencil, a piggy bank with coins and a stack of paper forms with no readable text, playful.' },
  { key: 'cinco', colors: C('#140f0c', '#f2b84a', '#ff7a6a', '#5fbf7a', '#fbefe0'),
    scene: 'a festive patio at dusk under strings of colorful papel picado banners with no text, lanterns glowing and a table set with food.',
    motif: 'tacos, limes, maracas and colorful papel picado banners with no text.' },
  { key: 'derby', colors: C('#140c0e', '#e9c46a', '#e0475e', '#4a8f5a', '#f8ecdc'),
    scene: 'a historic horse racing track at golden hour with twin-spired grandstands, a racehorse silhouette galloping past and red roses along the rail.',
    motif: 'a garland of red roses, a big fancy derby hat with flowers, a mint drink and a horseshoe.' },
  { key: 'flagday', colors: C('#0b1128', '#e9c46a', '#e8ecf5', '#c8323b', '#f4f1ea'),
    scene: 'a small-town street of front porches each flying an American flag, bunting on the railings, a summer evening sky with stars.',
    motif: 'an American flag on a porch post, red, white and blue bunting and stars.' },
  { key: 'juneteenth', colors: C('#140c0a', '#f2c45a', '#e0474e', '#3f9e5a', '#fbefe0'),
    scene: 'a joyful backyard celebration cookout at sunset with string lights, a sunburst sky in red, gold and green, a long table of food. Silhouettes only, no faces, no text.',
    motif: 'a bottle of strawberry soda, a slice of watermelon, a red velvet cupcake and a sunburst in red, green, gold and black. No text.' },
  { key: 'labor', colors: C('#0e161a', '#f2a04a', '#ffd27a', '#3f9ec8', '#f2efe6'),
    scene: 'the last cookout of summer by a lake at sunset: a grill smoking, lawn chairs on the dock, a canoe pulled up on shore.',
    motif: 'a grill with corn on the cob and burgers, a folding lawn chair, a cooler and a sunset.' },
  { key: 'winter', colors: C('#0a1220', '#f2c45a', '#cfe8ff', '#6f8fd8', '#eef4fc'),
    scene: 'the first day of winter, the longest night: a snowy cabin in the woods with firelight glowing in the windows under a sky full of stars.',
    motif: 'a crackling fireplace corner, a mug of cocoa, a knit blanket, a lantern and snowflakes.' },
)

// Persian holidays: warm and accurate, no text or calligraphy, no detailed faces.
const PERSIAN = ' No text, no script, no calligraphy, no detailed faces.'
DAYS.push(
  { key: 'nowruz', colors: C('#0e1a12', '#f2c45a', '#ff9ab0', '#4fb87a', '#f6f1e2'),
    scene: 'Persian New Year at the spring equinox: a garden courtyard with a turquoise-tiled fountain and blossoming trees at dusk, a haft-sin table glowing with candles inside an open doorway.' + PERSIAN,
    motif: 'a haft-sin spread: sprouted wheat sabzeh tied with a red ribbon, a goldfish in a round glass bowl, painted eggs, a purple hyacinth, a mirror, candles, red apples, garlic and a few gold coins, in spring green and gold.' + PERSIAN },
  { key: 'chaharshanbe-suri', colors: C('#0c0b1c', '#ff9a3a', '#ffd27a', '#e0473a', '#f6e6d8'),
    scene: 'the festival of fire at dusk: a row of small bonfires along a neighborhood lane, silhouettes leaping over the flames, sparklers and sparks rising into an indigo sky.' + PERSIAN,
    motif: 'small bonfires with rising sparks, sparklers and a bowl of mixed nuts and dried fruit (ajil), in ember orange against indigo.' + PERSIAN },
  { key: 'sizdah-bedar', colors: C('#0c1a10', '#f2d36b', '#9fd0ff', '#5fbf6a', '#f2f8e8'),
    scene: 'nature day: a family picnic outdoors on a sunny spring day, a picnic blanket by a clear stream under trees, a tea samovar, kites in the sky, small silhouettes.' + PERSIAN,
    motif: 'a picnic blanket with a brass tea samovar and glass tea cups, a kite, and knotted green sabzeh being set afloat on a stream, fresh greens.' + PERSIAN },
  { key: 'tirgan', colors: C('#061a22', '#5fd6e8', '#f2d36b', '#2f7fc8', '#e8f8fb'),
    scene: 'the midsummer water festival in the mountains: splashing water in a garden pool, rainbow-colored thread wristbands, snowy peaks beyond, turquoise and blue.' + PERSIAN,
    motif: 'splashing water from a pitcher, rainbow thread wristbands, a traditional archer\'s bow and arrow, and blue summer flowers in turquoise and blue.' + PERSIAN },
  { key: 'mehregan', colors: C('#160c18', '#e9b84a', '#c8324a', '#7a4fa8', '#f6ecdc'),
    scene: 'the autumn harvest festival in a Persian garden at sunset: a spread table with fruit, a mirror and a rosewater flask, marigolds, golden trees, purple and gold light.' + PERSIAN,
    motif: 'pomegranates, apples and grapes, orange marigolds, a small mirror and a glass rosewater flask on a spread cloth, in purple, gold and pomegranate red.' + PERSIAN },
  { key: 'yalda', colors: C('#0e0a1a', '#e9b25a', '#d62f4a', '#7a1f3a', '#fbe8e2'),
    scene: 'Yalda, the longest night: a cozy room around a korsi (a low table covered by a big red blanket), candles glowing, a window showing a deep night-blue starry winter sky.' + PERSIAN,
    motif: 'split-open pomegranates with jewel-like seeds, a slice of watermelon, a bowl of nuts, candles and an open poetry book with blank pages, in deep red and night blue.' + PERSIAN },
  { key: 'sadeh', colors: C('#0a1224', '#f2b44a', '#ffd88a', '#4f7fc8', '#eef4fc'),
    scene: 'the midwinter fire festival: one large bonfire blazing on a snowy plain under a sky full of stars, small silhouettes gathered around it at a distance.' + PERSIAN,
    motif: 'a bonfire with golden flames and sparks on snow, stars, and a few winter pine sprigs, in fire gold and winter blue.' + PERSIAN },
  { key: 'sepandarmazgan', colors: C('#140c14', '#f29ab0', '#3fc8c8', '#c84a7a', '#fbecef'),
    scene: 'the Persian day of love and the earth in late winter: a garden at dusk with early blossoms, lanterns and turquoise Persian tiles on a low wall.' + PERSIAN,
    motif: 'roses and flowers, a small wrapped gift, and heart shapes decorated with turquoise Persian tile patterns, in rose and turquoise.' + PERSIAN },
)
const ANNIVERSARY = { key: 'anniversary', colors: C('#1a0b12', '#e7b9a0', '#f4d4c8', '#8a1f3a', '#fbeee8'),
  scene: 'a romantic candlelit table for two by a window at night, roses in a vase, soft rose gold glow and deep wine red tones.',
  motif: 'two champagne glasses clinking, a pair of gold wedding rings, red roses and a lit candle, rose gold and deep wine red.' }

// Game days (src/lib/games.ts): a different look for every football and basketball game of a season, in
// old gold and black. Generic on purpose: no school, conference or opponent logos, wordmarks or mascots.
const GAME = C('#0d0c0a', '#cfb991', '#e8d9a8', '#8e6f3e', '#f5efe0')
const NO_MARKS = ' No logos, no wordmarks, no letters or numbers, no mascots, no detailed faces.'
// Scene numbers match the look names in src/lib/games.ts.
export const FOOTBALL = [
  ['the opening kickoff at sunset: a football on a tee at midfield, the stadium glowing gold.', 'a football on a kicking tee, a gold pennant with no lettering and stadium light beams.'],
  ['a tailgate in a grassy lot at golden hour: grills smoking, coolers, gold and black canopy tents, string lights.', 'a tailgate grill with burgers, a cooler, a football and gold and black bunting.'],
  ['a giant bass drum on the field with the marching band lined up behind it under the lights.', 'a giant bass drum with mallets, a plumed band hat and gold music notes.'],
  ['an old-fashioned black and gold steam locomotive puffing steam beside a stadium at dusk.', 'a black and gold steam locomotive with puffs of steam and a football.'],
  ['a night game under bright stadium lights, the green field striped, a gold and black crowd glow.', 'a football glowing under a stadium light, gold sparkles.'],
  ['a blacksmith forge glowing at night beside a stadium: anvil, sparks flying, a plain gold football helmet with no marks.', 'a plain gold football helmet with no marks, a blacksmith hammer, rivets and sparks.'],
  ['a homecoming parade on a campus street of old brick buildings: banners with no text, chrysanthemum mums, gold and black balloons.', 'a big homecoming mum corsage with gold and black ribbons, balloons and a crown.'],
  ['a marching band\'s brass section and sousaphones gleaming on the field at halftime.', 'a sousaphone, a trumpet and a drum major\'s plumed hat in old gold and black.'],
  ['a roaring student section in gold and black waving pom-poms, confetti in the air, seen from behind.', 'gold and black pom-poms, a megaphone with no lettering and confetti.'],
  ['a frosty late-fall game: breath visible in the cold air, scarves in the stands, frost on the field edges.', 'a gold and black scarf, mittens, a thermos and a frosty football.'],
  ['the goal line: an orange pylon and a football crossing the plane, chalk dust flying.', 'a goal-line pylon, a football and a burst of chalk dust.'],
  ['rivalry week: an old wooden oaken bucket trophy on a pedestal at midfield under the lights.', 'an old wooden oaken bucket with an iron handle, a football and a laurel wreath.'],
  ['a snow game: snowflakes swirling through the stadium lights, the field dusted white.', 'a football in the snow, a gold and black knit hat and falling snowflakes.'],
  ['a championship trophy case glowing in a quiet stadium hallway, gold trophies and footballs.', 'gold trophies, a vintage football and a gold star.'],
  ['a bowl trip: a warm-weather stadium at sunset with palm trees and sunshine beyond the stands.', 'palm fronds, sunglasses, a football and a gold trophy.'],
  ['victory fireworks bursting in gold over the stadium after a win.', 'gold fireworks, a football and gold streamers.'],
]
export const BASKETBALL = [
  ['the opening tip-off: the jump ball high above center court, two silhouetted players reaching.', 'a basketball at the top of its arc with gold streaks.'],
  ['a gleaming hardwood court under bright arena lights, the polish reflecting everything.', 'a basketball resting on shining hardwood with a gold glow.'],
  ['the net in close-up as a ball swishes through, arena lights blurred behind.', 'a net mid-swish with a basketball and motion lines.'],
  ['a domed college arena exterior at night, lit up gold, fans walking up.', 'a little domed arena shape glowing gold, a basketball and stars.'],
  ['a roaring student section jumping in gold and black, seen from the court.', 'gold and black foam fingers with no lettering, confetti and a megaphone.'],
  ['a fast break: a player silhouette racing down the court, motion blur.', 'a basketball with speed lines and gold sparks.'],
  ['the three-point arc on the floor with a ball in flight toward the hoop.', 'a basketball in flight over a curved court line, gold stars.'],
  ['a battle in the paint: silhouetted players jostling under the basket.', 'a basketball, a rim and a burst of gold energy.'],
  ['a pep band in the arena corner with brass instruments and a drum.', 'a trumpet, a snare drum and gold music notes.'],
  ['a scoreboard glowing high above the court with no digits or text, lights everywhere.', 'a hanging scoreboard shape with no digits, a basketball and lights.'],
  ['a pair of gold and black basketball sneakers on the court with a ball beside them.', 'high-top basketball sneakers in gold and black with no logos and a basketball.'],
  ['a black and gold team bus on a highway at dusk heading to an away game.', 'a black and gold bus, a road and a basketball.'],
  ['holiday hoops: the arena decorated with evergreen garland and warm lights in December.', 'a basketball with a red bow, holly and gold ornaments.'],
  ['a snowy night outside the arena, warm light spilling from the doors, fans in hats arriving.', 'a knit beanie, a basketball, snowflakes and a cup of cocoa.'],
  ['new year\'s hoops: gold balloons and confetti dropping from the rafters.', 'gold balloons, a basketball and confetti.'],
  ['a deep-winter conference grind: a loud dark road arena with spotlights sweeping.', 'a basketball, spotlights and gold sparks.'],
  ['a buzzer beater: the ball in the air, a red clock light glowing with no readable digits, fans leaping.', 'a basketball in flight, a glowing red light and gold confetti.'],
  ['a full house: every seat filled, the whole arena glowing gold and black, seen from the rafters.', 'a packed crowd silhouette, a basketball and gold sparkles.'],
  ['a coach\'s clipboard with chalk X and O marks only, a whistle and chalk dust on the bench.', 'a clipboard with abstract chalk marks only, a whistle and a piece of chalk.'],
  ['a locker room with gold lockers, jerseys with no numbers hanging, a ball on the bench.', 'a jersey with no numbers, a towel, a water bottle and a basketball.'],
  ['a gold-out crowd: the entire arena dressed in old gold, shimmering.', 'gold shakers, gold confetti and a basketball.'],
  ['a black-out crowd: the entire arena dressed in black with gold lights.', 'black shakers, gold sparkles and a basketball.'],
  ['a train whistle and steam rising in the arena tunnel as the team runs out.', 'a brass train whistle with steam and a basketball.'],
  ['the free throw line: a ball held at the stripe, the hoop waiting, quiet tension.', 'a basketball on a free throw line with a gold glow.'],
  ['a rebound: hands reaching up for the ball above the rim, silhouettes.', 'a basketball bouncing off the rim with gold sparks.'],
  ['a slam dunk silhouette against bright arena lights, the rim bending.', 'a basketball, a bending rim and a starburst.'],
  ['rivalry night: two halves of the crowd in different colors, the court glowing in the middle.', 'two crossed foam fingers with no lettering, a basketball and lightning bolts.'],
  ['senior night: roses and a framed jersey with no numbers at center court.', 'a bouquet of roses, a framed jersey with no numbers and a basketball.'],
  ['cutting down the nets after a big win: a ladder under the hoop, scissors, confetti falling.', 'scissors, a cut piece of net, a small ladder and gold confetti.'],
  ['a gold championship trophy on a stand at center court under a spotlight.', 'a gold trophy, a basketball and confetti.'],
  ['a blank tournament bracket on a wall with empty lines only, pencils and a basketball on a table.', 'a bracket chart with blank lines only, a pencil and a basketball.'],
  ['a conference tournament arena in a big city with a skyline beyond, lights glowing.', 'a city skyline silhouette, a basketball and a gold trophy.'],
  ['a selection-day watch party: a living room crowd around a TV, silhouettes, snacks and gold and black blankets.', 'a bowl of popcorn, a gold and black blanket, a remote and a basketball.'],
  ['the March tournament dance: a huge dome arena with gold light and confetti.', 'a basketball, dancing confetti and a gold trophy.'],
  ['the road to the next round: a highway at dawn stretching toward a distant city.', 'a winding road, a sunrise and a basketball.'],
  ['the final buzzer: a confetti storm in gold and black over the court.', 'a whirlwind of gold and black confetti around a basketball.'],
]
// NFL game days (src/lib/games.ts): 12 looks per team in team colors only. No logos, wordmarks, mascots,
// letters, numbers, horseshoes, arrowheads or animal-head marks.
const NFL_MARKS = ' Team colors only: absolutely no logos, no wordmarks, no mascots, no letters, no numbers, no horseshoes, no arrowheads, no animal-head marks, no detailed faces.'
export const NFL = {
  bears: { colors: C('#0b1020', '#f07a2a', '#f6a86a', '#26345e', '#eef1f8'),
    city: 'Chicago: the lakefront skyline and cold wind off the lake', team: 'navy blue and orange' },
  colts: { colors: C('#08122a', '#3f7fe8', '#cfe0ff', '#1f4fb0', '#f2f6ff'),
    city: 'Indianapolis: the downtown skyline and a big stadium with a retractable roof', team: 'royal blue and white' },
  chiefs: { colors: C('#1a0a0c', '#f2c14e', '#ffd76a', '#d62b3a', '#fbe9d0'),
    city: 'Kansas City: the city fountains and barbecue smoke drifting over the parking lot', team: 'red and gold' },
}
const NFL_SCENES = [
  ['the opening kickoff: a football on a tee at midfield, the stadium full', 'a football on a kicking tee and stadium light beams'],
  ['a tailgate in the stadium lot: grills smoking, canopy tents and flags in team colors, string lights', 'a tailgate grill, a cooler, a football and team-color bunting'],
  ['a Sunday watch party in a cozy living room: a couch, a big TV glowing with an abstract green field, snacks on the table', 'a bowl of chips and dip, wings, a team-color blanket and a football'],
  ['a night game under bright stadium lights, the field glowing', 'a football glowing under a stadium light with sparkles'],
  ['a snow game: snowflakes swirling through the stadium lights, the field dusted white', 'a football in the snow, a team-color knit hat and falling snowflakes'],
  ['the red zone: an orange pylon at the goal line and a football crossing it, chalk dust flying', 'a goal-line pylon, a football and a burst of chalk dust'],
  ['the two-minute drill: a tense crowd on its feet, a glowing stadium clock with no digits', 'a stopwatch with no digits, a football and lightning sparks'],
  ['the home crowd roaring, a sea of team colors filling the stands, seen from the field', 'foam fingers with no lettering, a megaphone and confetti in team colors'],
  ['a road trip at dawn: a team-color bus on a highway and an airplane wing over the clouds', 'an airplane wing, a suitcase with team-color tags and a football'],
  ['rivalry Sunday: the sky split in two tones, team color on one side and stormy grey on the other, over the stadium', 'two crossed foam fingers with no lettering, one team color and one grey, and a football'],
  ['the late-season playoff push: cold breath in the air, frosty stadium lights, a determined crowd bundled up', 'a scarf and mittens in team colors, a thermos and a frosty football'],
  ['a victory celebration: team-color confetti and fireworks over the stadium after a win', 'team-color confetti, a football and fireworks'],
]

export const JOBS = [
  ...Object.entries(NFL).flatMap(([team, t]) => NFL_SCENES.flatMap(([scene, motif], i) => {
    const n = String(i + 1).padStart(2, '0')
    const flavor = ` City flavor: ${t.city}. Colors: ${t.team}.`
    return [
      { name: `bg-game-${team}-${n}`, prompt: BG(t.colors, `${scene}.${flavor}${NFL_MARKS}`) },
      { name: `hero-game-${team}-${n}`, prompt: HERO(t.colors, `${motif}, in ${t.team}.${NFL_MARKS}`) },
    ]
  })),
  ...FOOTBALL.flatMap(([scene, motif], i) => {
    const n = String(i + 1).padStart(2, '0')
    return [{ name: `bg-game-fb-${n}`, prompt: BG(GAME, scene + NO_MARKS) }, { name: `hero-game-fb-${n}`, prompt: HERO(GAME, motif + NO_MARKS) }]
  }),
  ...BASKETBALL.flatMap(([scene, motif], i) => {
    const n = String(i + 1).padStart(2, '0')
    return [{ name: `bg-game-bb-${n}`, prompt: BG(GAME, scene + NO_MARKS) }, { name: `hero-game-bb-${n}`, prompt: HERO(GAME, motif + NO_MARKS) }]
  }),
  ...DAYS.flatMap((d) => [
    { name: `bg-day-${d.key}`, prompt: BG(d.colors, d.scene) },
    { name: `hero-day-${d.key}`, prompt: HERO(d.colors, d.motif) },
  ]),
  { name: 'bg-bday-anniversary', prompt: BG(ANNIVERSARY.colors, ANNIVERSARY.scene) },
  { name: 'hero-bday-anniversary', prompt: HERO(ANNIVERSARY.colors, ANNIVERSARY.motif) },
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
