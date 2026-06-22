// Single source of truth for every body in the game.
// Consumed by SolarSystemView, PlanetView and SurfaceView.
//
// Distances/sizes are NOT to real scale — they are tuned so a toddler can see
// and tap everything easily. Narration is written in simple, friendly language.

export const SUN = {
  key: 'sun',
  name: 'The Sun',
  radius: 6,
  color: 0xffcc33,
  emissive: 0xff8800,
  narration: {
    name: 'The Sun!',
    fact: 'The Sun is a giant ball of fire. It keeps all the planets warm and bright!',
  },
  surface: { groundColor: 0xff7722, skyColor: 0xffaa33, roughness: 0.9 },
};

export const PLANETS = [
  {
    key: 'mercury',
    name: 'Mercury',
    radius: 1.0,
    color: 0xb1a999,
    color2: 0x8a8175,
    orbitRadius: 14,
    orbitSpeed: 1.6,
    rotationSpeed: 0.4,
    textureType: 'rocky',
    hasRings: false,
    moons: [],
    surface: { groundColor: 0x9c948a, skyColor: 0x1a1a1a, roughness: 1.0 },
    narration: {
      name: 'Mercury!',
      fact: 'Mercury is the smallest planet and it zooms around the Sun the fastest!',
    },
  },
  {
    key: 'venus',
    name: 'Venus',
    radius: 1.5,
    color: 0xe8b35a,
    color2: 0xc98b3a,
    orbitRadius: 19,
    orbitSpeed: 1.2,
    rotationSpeed: 0.3,
    textureType: 'cloudy',
    hasRings: false,
    moons: [],
    surface: { groundColor: 0xd99a4a, skyColor: 0xe0a85c, roughness: 0.8 },
    narration: {
      name: 'Venus!',
      fact: 'Venus is covered in yellow clouds and is the hottest planet of all!',
    },
  },
  {
    key: 'earth',
    name: 'Earth',
    radius: 1.6,
    color: 0x2a6fd6,
    color2: 0x2f9e44,
    orbitRadius: 25,
    orbitSpeed: 1.0,
    rotationSpeed: 0.5,
    textureType: 'earth',
    hasRings: false,
    moons: [{ name: 'The Moon', radius: 0.45, orbitRadius: 3.2, speed: 1.4, color: 0xcccccc }],
    surface: { groundColor: 0x4a9e4a, skyColor: 0x88bbff, roughness: 0.7 },
    narration: {
      name: 'Earth!',
      fact: 'Earth is our home! It has blue oceans, green land, and one big Moon.',
    },
  },
  {
    key: 'mars',
    name: 'Mars',
    radius: 1.3,
    color: 0xd1603a,
    color2: 0x9e3b1f,
    orbitRadius: 32,
    orbitSpeed: 0.8,
    rotationSpeed: 0.48,
    textureType: 'rocky',
    hasRings: false,
    moons: [
      { name: 'Phobos', radius: 0.25, orbitRadius: 2.4, speed: 1.8, color: 0x9a8a7a },
      { name: 'Deimos', radius: 0.2, orbitRadius: 3.4, speed: 1.2, color: 0x8a7a6a },
    ],
    surface: { groundColor: 0xb24a2a, skyColor: 0xd9a07a, roughness: 0.95 },
    narration: {
      name: 'Mars!',
      fact: 'Mars is the red planet! It is dusty and rocky, with two tiny moons.',
    },
  },
  {
    key: 'jupiter',
    name: 'Jupiter',
    radius: 3.6,
    color: 0xd8b48a,
    color2: 0xa9764a,
    orbitRadius: 46,
    orbitSpeed: 0.45,
    rotationSpeed: 0.7,
    textureType: 'gas',
    hasRings: false,
    moons: [
      { name: 'Io', radius: 0.4, orbitRadius: 5.2, speed: 1.6, color: 0xe8d27a },
      { name: 'Europa', radius: 0.38, orbitRadius: 6.4, speed: 1.3, color: 0xd8cbb0 },
      { name: 'Ganymede', radius: 0.5, orbitRadius: 7.8, speed: 1.0, color: 0xa89a86 },
      { name: 'Callisto', radius: 0.46, orbitRadius: 9.2, speed: 0.8, color: 0x8a7a6a },
    ],
    surface: { groundColor: 0xc79a6a, skyColor: 0xd8b48a, roughness: 0.6 },
    narration: {
      name: 'Jupiter!',
      fact: 'Jupiter is the biggest planet! It has a giant red storm and many moons.',
    },
  },
  {
    key: 'saturn',
    name: 'Saturn',
    radius: 3.1,
    color: 0xe6d3a3,
    color2: 0xc9a86a,
    orbitRadius: 60,
    orbitSpeed: 0.35,
    rotationSpeed: 0.65,
    textureType: 'gas',
    hasRings: true,
    ringColor: 0xd9c89a,
    moons: [
      { name: 'Titan', radius: 0.55, orbitRadius: 6.5, speed: 1.1, color: 0xd8a85a },
      { name: 'Rhea', radius: 0.35, orbitRadius: 8.2, speed: 0.85, color: 0xc8c0b0 },
    ],
    surface: { groundColor: 0xd9c89a, skyColor: 0xe6d3a3, roughness: 0.6 },
    narration: {
      name: 'Saturn!',
      fact: 'Saturn has beautiful rings made of ice and rock that go all around it!',
    },
  },
  {
    key: 'uranus',
    name: 'Uranus',
    radius: 2.4,
    color: 0x9fdfe0,
    color2: 0x7ec8c9,
    orbitRadius: 74,
    orbitSpeed: 0.28,
    rotationSpeed: 0.55,
    textureType: 'ice',
    hasRings: true,
    ringColor: 0x9fdfe0,
    moons: [{ name: 'Titania', radius: 0.4, orbitRadius: 5.0, speed: 1.0, color: 0xbfcfd0 }],
    surface: { groundColor: 0x7ec8c9, skyColor: 0x9fdfe0, roughness: 0.5 },
    narration: {
      name: 'Uranus!',
      fact: 'Uranus is a cold, icy blue planet that spins on its side!',
    },
  },
  {
    key: 'neptune',
    name: 'Neptune',
    radius: 2.3,
    color: 0x3b6fd6,
    color2: 0x2a4fb0,
    orbitRadius: 88,
    orbitSpeed: 0.22,
    rotationSpeed: 0.55,
    textureType: 'ice',
    hasRings: false,
    moons: [{ name: 'Triton', radius: 0.42, orbitRadius: 5.2, speed: 0.9, color: 0xbcd0e0 }],
    surface: { groundColor: 0x2a4fb0, skyColor: 0x3b6fd6, roughness: 0.5 },
    narration: {
      name: 'Neptune!',
      fact: 'Neptune is a deep blue planet far, far away. It is very windy there!',
    },
  },
];

// Quick lookup by key (includes the Sun).
export const BODIES_BY_KEY = Object.fromEntries(
  [SUN, ...PLANETS].map((b) => [b.key, b])
);
