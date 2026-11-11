/**
 * The game library: which 3D engines exist, their colour palettes and the
 * ready-made templates a user can start from (and edit).
 */
const ENGINES = {
  runner: { label: "3D runner", controls: "← → switch lanes · ↑ or tap to jump · ↓ to slide", usesLives: true, collect: "Coins" },
  racer: { label: "3D racer", controls: "← → steer · drag to steer on phones", usesLives: true, collect: "Fuel" },
  flyer: { label: "3D flyer", controls: "Arrow keys or drag to fly through the rings", usesLives: true, collect: "Rings" },
  stack: { label: "Tower stack", controls: "Tap, click or press space to drop the block", usesLives: false, collect: "Floors" },
  helix: { label: "Helix drop", controls: "← → or drag to turn the tower · fall through the gaps", usesLives: true, collect: "Floors" },
  maze: { label: "3D maze", controls: "Arrow keys or swipe · grab the gems before time runs out", usesLives: true, collect: "Gems" },
  penalty: { label: "Penalty shoot-out", controls: "Aim with the mouse or finger · click or tap to shoot", usesLives: true, collect: "Goals" },
  shooter: { label: "3D shooter", controls: "Aim and click or tap to shoot · arrow keys + space also work", usesLives: true, collect: "Hits" },
  snake: { label: "3D snake", controls: "Arrow keys or swipe to turn · eat the orbs", usesLives: true, collect: "Length" },
  quiz: { label: "Quiz", controls: "Click an answer or press 1–4 before the timer ends", usesLives: true, collect: "Question" },
  memory: { label: "Memory match", controls: "Flip two cards at a time and find every pair", usesLives: false, collect: "Pairs" },
};

const WORLDS = ["forest", "jungle", "city", "night", "desert", "snow", "candy", "ocean", "space"];
const PLAYERS = ["runner", "ball", "car", "ship", "plane", "box"];
const COLLECTIBLES = ["coin", "gem", "star", "orb"];

/** Colours that look good together for each world. */
const PALETTES = {
  forest: { sky: "#0d1a14", fog: "#0d1a14", ground: "#2a3326", player: "#ffb347", obstacle: "#c2543a", collect: "#ffd34d", accent: "#ffd34d", scenery: "#2f6b3c" },
  jungle: { sky: "#06180f", fog: "#06180f", ground: "#1f3a22", player: "#7affc4", obstacle: "#d9534f", collect: "#ffe14d", accent: "#7affc4", scenery: "#1f8a4c" },
  city: { sky: "#0b0f1a", fog: "#0b0f1a", ground: "#1c2030", player: "#4dd2ff", obstacle: "#ff5d73", collect: "#ffd34d", accent: "#4dd2ff", scenery: "#39415e" },
  night: { sky: "#05050d", fog: "#05050d", ground: "#10121f", player: "#ff4de1", obstacle: "#ffb02e", collect: "#4dffd2", accent: "#ff4de1", scenery: "#6c4dff" },
  desert: { sky: "#2a170b", fog: "#2a170b", ground: "#5a3a1c", player: "#ffd34d", obstacle: "#b8452f", collect: "#4dd2ff", accent: "#ffa94d", scenery: "#c98a4b" },
  snow: { sky: "#0d1622", fog: "#0d1622", ground: "#aebdd0", player: "#ff6b6b", obstacle: "#3a4a63", collect: "#4dd2ff", accent: "#8fd3ff", scenery: "#dbe8f5" },
  candy: { sky: "#1c0b1f", fog: "#1c0b1f", ground: "#5b2a58", player: "#ffe14d", obstacle: "#ff4d8d", collect: "#7affc4", accent: "#ff7ac8", scenery: "#ff9ad5" },
  ocean: { sky: "#041a24", fog: "#041a24", ground: "#0c3b4d", player: "#ffd34d", obstacle: "#ff6b4d", collect: "#7affc4", accent: "#4dd2ff", scenery: "#1c7d99" },
  space: { sky: "#03030a", fog: "#03030a", ground: "#14162a", player: "#7ab8ff", obstacle: "#ff5d73", collect: "#ffd34d", accent: "#9d8cff", scenery: "#3a3f78" },
};

const NAMES = ["Nova", "Blaze", "Pixel", "Echo", "Zed", "Mira", "Orbit", "Rex", "Luna", "Kai"];

const mk = (id, engine, o) => ({
  id,
  engine,
  title: o.title,
  kicker: o.kicker || ENGINES[engine].label,
  tagline: o.tagline,
  description: o.description || o.tagline,
  world: o.world,
  player: o.player || "runner",
  collectible: o.collectible || "coin",
  collectName: o.collectName,
  difficulty: o.difficulty || "normal",
  lives: o.lives || 3,
  speed: 1,
  timeLimit: o.timeLimit,
  quiz: o.quiz,
  memory: o.memory,
  colors: o.colors,
  tags: o.tags || [],
});

const GK = [
  ["Which planet is known as the Red Planet?", ["Venus", "Mars", "Jupiter", "Mercury"], 1],
  ["What is the capital of Japan?", ["Seoul", "Beijing", "Tokyo", "Bangkok"], 2],
  ["How many continents are there?", ["5", "6", "7", "8"], 2],
  ["Which ocean is the largest?", ["Atlantic", "Indian", "Arctic", "Pacific"], 3],
  ["Who painted the Mona Lisa?", ["Van Gogh", "Da Vinci", "Picasso", "Monet"], 1],
  ["What is H2O commonly called?", ["Salt", "Water", "Oxygen", "Hydrogen"], 1],
  ["Which is the fastest land animal?", ["Lion", "Horse", "Cheetah", "Tiger"], 2],
  ["How many days are in a leap year?", ["364", "365", "366", "367"], 2],
  ["Which gas do plants take in?", ["Oxygen", "Carbon dioxide", "Nitrogen", "Helium"], 1],
  ["What is the largest mammal?", ["Elephant", "Blue whale", "Giraffe", "Shark"], 1],
  ["Which country has the city of Paris?", ["Italy", "Spain", "France", "Germany"], 2],
  ["How many sides does a hexagon have?", ["5", "6", "7", "8"], 1],
].map(([q, options, answer]) => ({ q, options, answer }));

const SCIENCE = [
  ["What is the closest star to Earth?", ["Sirius", "The Sun", "Polaris", "Vega"], 1],
  ["Which force pulls things to the ground?", ["Magnetism", "Friction", "Gravity", "Inertia"], 2],
  ["What do bees make?", ["Silk", "Honey", "Milk", "Wax paper"], 1],
  ["Which planet has rings you can see easily?", ["Mars", "Saturn", "Earth", "Mercury"], 1],
  ["What is the boiling point of water in °C?", ["50", "90", "100", "120"], 2],
  ["What is the hardest natural material?", ["Gold", "Iron", "Diamond", "Quartz"], 2],
  ["Which organ pumps blood?", ["Lungs", "Heart", "Liver", "Kidney"], 1],
  ["What do we call a baby frog?", ["Cub", "Tadpole", "Pup", "Kit"], 1],
  ["Light travels fastest in…", ["Water", "Glass", "A vacuum", "Air"], 2],
  ["Which is a renewable energy source?", ["Coal", "Oil", "Solar", "Gas"], 2],
].map(([q, options, answer]) => ({ q, options, answer }));

const TEMPLATES = [
  mk("jungle-dash", "runner", { title: "Jungle Dash", tagline: "Run, jump and grab the gold", world: "forest", collectName: "Coins", tags: ["runner", "forest", "endless", "temple", "coin", "adventure"] }),
  mk("city-sprint", "runner", { title: "City Sprint", tagline: "Race across neon rooftops", world: "city", collectible: "gem", collectName: "Gems", tags: ["runner", "city", "parkour", "neon", "urban"] }),
  mk("desert-run", "runner", { title: "Desert Run", tagline: "Outrun the sandstorm", world: "desert", collectible: "star", collectName: "Stars", tags: ["runner", "desert", "sand", "egypt"] }),
  mk("snow-rush", "runner", { title: "Snow Rush", tagline: "Slide through the frozen valley", world: "snow", player: "ball", collectible: "orb", collectName: "Orbs", tags: ["runner", "snow", "ice", "winter", "ski"] }),
  mk("candy-run", "runner", { title: "Candy Run", tagline: "A sweet dash through candy land", world: "candy", collectible: "star", collectName: "Candies", tags: ["runner", "candy", "sweet", "kids", "cute"] }),
  mk("neon-racer", "racer", { title: "Neon Racer", tagline: "Weave through night traffic", world: "night", player: "car", collectName: "Fuel", tags: ["racer", "car", "racing", "neon", "night", "traffic", "drive"] }),
  mk("desert-rally", "racer", { title: "Desert Rally", tagline: "Floor it across the dunes", world: "desert", player: "car", collectName: "Fuel", tags: ["racer", "rally", "desert", "car", "racing"] }),
  mk("snow-drift", "racer", { title: "Snow Drift", tagline: "Keep control on icy roads", world: "snow", player: "car", collectName: "Fuel", difficulty: "hard", tags: ["racer", "snow", "ice", "drift", "car"] }),
  mk("sky-flyer", "flyer", { title: "Sky Flyer", tagline: "Fly through the golden rings", world: "ocean", player: "plane", collectible: "star", collectName: "Rings", tags: ["flyer", "plane", "sky", "flying", "air", "ocean"] }),
  mk("space-flight", "flyer", { title: "Space Flight", tagline: "Thread your ship between asteroids", world: "space", player: "ship", collectible: "gem", collectName: "Rings", tags: ["flyer", "space", "ship", "asteroid", "galaxy", "rocket"] }),
  mk("canyon-flyer", "flyer", { title: "Canyon Flyer", tagline: "Skim the red canyon walls", world: "desert", player: "plane", collectName: "Rings", difficulty: "hard", tags: ["flyer", "canyon", "plane", "desert"] }),
  mk("tower-stack", "stack", { title: "Tower Stack", tagline: "Stack it higher — perfect drops count double", world: "candy", collectName: "Floors", tags: ["stack", "tower", "build", "blocks", "tap", "casual"] }),
  mk("neon-stack", "stack", { title: "Neon Stack", tagline: "Build a glowing skyscraper", world: "night", collectName: "Floors", tags: ["stack", "neon", "skyscraper", "blocks"] }),
  mk("helix-drop", "helix", { title: "Helix Drop", tagline: "Spin the tower and fall through the gaps", world: "space", player: "ball", collectName: "Floors", tags: ["helix", "ball", "tower", "drop", "spin", "fall"] }),
  mk("candy-helix", "helix", { title: "Candy Helix", tagline: "Bounce down the sweet spiral", world: "candy", player: "ball", collectName: "Floors", tags: ["helix", "candy", "ball", "spiral"] }),
  mk("gem-maze", "maze", { title: "Gem Maze", tagline: "Find every gem before time's up", world: "jungle", collectible: "gem", collectName: "Gems", timeLimit: 75, tags: ["maze", "gem", "puzzle", "labyrinth", "treasure"] }),
  mk("ice-maze", "maze", { title: "Ice Maze", tagline: "Escape the frozen labyrinth", world: "snow", collectible: "orb", collectName: "Orbs", timeLimit: 75, tags: ["maze", "ice", "snow", "puzzle", "escape"] }),
  mk("penalty-kick", "penalty", { title: "Penalty Kick", tagline: "Beat the keeper, score the goals", world: "forest", player: "ball", collectName: "Goals", tags: ["penalty", "football", "soccer", "sports", "goal", "kick"] }),
  mk("space-shooter", "shooter", { title: "Space Shooter", tagline: "Blast the invaders before they land", world: "space", collectName: "Hits", tags: ["shooter", "space", "invaders", "alien", "blaster", "shoot"] }),
  mk("city-defender", "shooter", { title: "City Defender", tagline: "Defend the skyline at night", world: "night", collectName: "Hits", difficulty: "hard", tags: ["shooter", "city", "night", "defend", "drone"] }),
  mk("neon-snake", "snake", { title: "Neon Snake", tagline: "Eat, grow, don't bite yourself", world: "night", collectible: "orb", collectName: "Length", tags: ["snake", "neon", "classic", "retro", "grid"] }),
  mk("garden-snake", "snake", { title: "Garden Snake", tagline: "A calm 3D snake in the garden", world: "forest", collectible: "orb", collectName: "Length", difficulty: "easy", tags: ["snake", "garden", "classic", "easy"] }),
  mk("math-quiz", "quiz", { title: "Math Blitz", tagline: "Quick sums against the clock", world: "space", quiz: { mode: "math", perGame: 15, seconds: 12 }, collectName: "Question", tags: ["quiz", "math", "numbers", "maths", "school", "sums", "arithmetic"] }),
  mk("knowledge-quiz", "quiz", { title: "Brain Quiz", tagline: "Test your general knowledge", world: "night", quiz: { mode: "custom", perGame: 10, seconds: 15, questions: GK }, collectName: "Question", tags: ["quiz", "trivia", "knowledge", "general", "questions", "gk"] }),
  mk("science-quiz", "quiz", { title: "Science Quiz", tagline: "How much science do you know?", world: "ocean", quiz: { mode: "custom", perGame: 10, seconds: 15, questions: SCIENCE }, collectName: "Question", tags: ["quiz", "science", "school", "learn", "education"] }),
  mk("fruit-memory", "memory", { title: "Fruit Match", tagline: "Flip the cards and find every pair", world: "candy", memory: { items: ["🍎", "🍌", "🍇", "🍒", "🍉", "🍍", "🥝", "🍓", "🍑", "🍋"] }, collectName: "Pairs", tags: ["memory", "cards", "match", "fruit", "kids", "pairs"] }),
  mk("animal-memory", "memory", { title: "Animal Match", tagline: "Match the animal pairs", world: "jungle", memory: { items: ["🦁", "🐼", "🐸", "🦊", "🐙", "🦄", "🐢", "🦋", "🐧", "🐳"] }, collectName: "Pairs", tags: ["memory", "animal", "cards", "match", "kids", "zoo"] }),
];

for (const t of TEMPLATES) t.colors = { ...PALETTES[t.world], ...(t.colors || {}) };

const byId = (id) => TEMPLATES.find((t) => t.id === id);

module.exports = { ENGINES, WORLDS, PLAYERS, COLLECTIBLES, PALETTES, NAMES, TEMPLATES, byId };
