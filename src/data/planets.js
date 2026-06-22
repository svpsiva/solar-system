// Single source of truth for every body in the game.
// Consumed by SolarSystemView, PlanetView and SurfaceView.
//
// Distances/sizes are NOT to real scale — they are tuned so a toddler can see
// and tap everything easily.
//
// textureUrl: local texture files bundled in public/textures/ (sourced from
// jeromeetienne/threex.planets and three.js examples — public domain / CC).
// The loader falls back to procedural generation if a file is missing.
//
// surfaceType drives which surface builder is used in Terrain.js:
//   'gas'      Jupiter, Saturn, Uranus, Neptune — animated cloud layers
//   'volcanic' Venus — lava cracks, orange fog
//   'earth'    Earth — ocean + hills + cloud sprites
//   'desert'   Mars, Mercury — dusty plains with rocks
//   'icy'      Moon — grey craters, black sky

// Local texture base path (files live in public/textures/, served at /textures/).
const T = './textures/';

export const SUN = {
  key: 'sun',
  name: 'The Sun',
  radius: 6,
  color: 0xffcc33,
  emissive: 0xff8800,
  textureUrl: `${T}sun.jpg`,
  narration: {
    name: 'The Sun!',
    fact: 'The Sun is a giant ball of fire. It keeps all the planets warm and bright!',
  },
  surface: { groundColor: 0xff7722, skyColor: 0xffaa33, roughness: 0.9 },
  surfaceType: 'volcanic',
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
    textureUrl: `${T}mercury.jpg`,
    hasRings: false,
    moons: [],
    surfaceType: 'icy',
    surface: { groundColor: 0x7a7570, skyColor: 0x080808, roughness: 1.0 },
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
    textureUrl: `${T}venus.jpg`,
    hasRings: false,
    moons: [],
    surfaceType: 'volcanic',
    surface: { groundColor: 0x8a4a20, skyColor: 0xc8601a, roughness: 0.9 },
    narration: {
      name: 'Venus!',
      fact: 'Venus is covered in thick yellow clouds and is the hottest planet of all!',
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
    textureUrl: `${T}earth.jpg`,
    hasRings: false,
    moons: [
      {
        name: 'The Moon',
        radius: 0.45,
        orbitRadius: 3.2,
        speed: 1.4,
        color: 0xcccccc,
        textureUrl: `${T}moon.jpg`,
      },
    ],
    surfaceType: 'earth',
    surface: { groundColor: 0x4a9e4a, skyColor: 0x70b0ff, roughness: 0.7 },
    narration: {
      name: 'Earth!',
      fact: 'Earth is our home! It has blue oceans, green forests, and one big Moon.',
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
    textureUrl: `${T}mars.jpg`,
    hasRings: false,
    moons: [
      { name: 'Phobos', radius: 0.25, orbitRadius: 2.4, speed: 1.8, color: 0x9a8a7a },
      { name: 'Deimos', radius: 0.2, orbitRadius: 3.4, speed: 1.2, color: 0x8a7a6a },
    ],
    surfaceType: 'desert',
    surface: { groundColor: 0xb24a2a, skyColor: 0xc8906a, roughness: 0.95 },
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
    textureUrl: `${T}jupiter.jpg`,
    hasRings: false,
    moons: [
      { name: 'Metis',    radius: 0.14, orbitRadius: 3.8, speed: 2.20, color: 0x9a8a7a },
      { name: 'Amalthea', radius: 0.18, orbitRadius: 4.4, speed: 1.90, color: 0xc87850 },
      { name: 'Thebe',    radius: 0.15, orbitRadius: 4.8, speed: 1.75, color: 0xa08070 },
      { name: 'Io',       radius: 0.40, orbitRadius: 5.8, speed: 1.60, color: 0xe8d27a },
      { name: 'Europa',   radius: 0.38, orbitRadius: 7.0, speed: 1.30, color: 0xd8cbb0 },
      { name: 'Ganymede', radius: 0.50, orbitRadius: 8.4, speed: 1.00, color: 0xa89a86 },
      { name: 'Callisto', radius: 0.46, orbitRadius: 9.8, speed: 0.80, color: 0x8a7a6a },
    ],
    surfaceType: 'gas',
    surface: { groundColor: 0xc79a6a, skyColor: 0x5a3a1a, roughness: 0.5 },
    narration: {
      name: 'Jupiter!',
      fact: 'Jupiter is the biggest planet! It has a giant red storm and seven amazing moons!',
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
    textureUrl: `${T}saturn.jpg`,
    hasRings: true,
    ringColor: 0xd9c89a,
    ringTextureUrl: `${T}saturn_ring.jpg`,
    moons: [
      { name: 'Mimas',      radius: 0.20, orbitRadius: 5.2,  speed: 1.80, color: 0xd0ccc8 },
      { name: 'Enceladus',  radius: 0.22, orbitRadius: 6.0,  speed: 1.55, color: 0xeeeeff },
      { name: 'Tethys',     radius: 0.26, orbitRadius: 6.9,  speed: 1.35, color: 0xd8d4cc },
      { name: 'Dione',      radius: 0.27, orbitRadius: 7.8,  speed: 1.15, color: 0xccc8c0 },
      { name: 'Rhea',       radius: 0.32, orbitRadius: 8.8,  speed: 0.95, color: 0xc8c0b0 },
      { name: 'Titan',      radius: 0.55, orbitRadius: 10.2, speed: 0.75, color: 0xd8a85a },
      { name: 'Iapetus',    radius: 0.28, orbitRadius: 12.0, speed: 0.50, color: 0xa09080 },
    ],
    surfaceType: 'gas',
    surface: { groundColor: 0xd9c89a, skyColor: 0x4a3a20, roughness: 0.5 },
    narration: {
      name: 'Saturn!',
      fact: 'Saturn has beautiful rings made of billions of pieces of ice and rock, and seven big moons!',
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
    textureUrl: `${T}uranus.jpg`,
    hasRings: true,
    ringColor: 0x9fdfe0,
    moons: [
      { name: 'Miranda',  radius: 0.20, orbitRadius: 4.0, speed: 1.60, color: 0xb0b8bc },
      { name: 'Ariel',    radius: 0.28, orbitRadius: 5.0, speed: 1.30, color: 0xc0c8cc },
      { name: 'Umbriel',  radius: 0.27, orbitRadius: 6.1, speed: 1.05, color: 0x808890 },
      { name: 'Titania',  radius: 0.35, orbitRadius: 7.4, speed: 0.82, color: 0xbfcfd0 },
      { name: 'Oberon',   radius: 0.33, orbitRadius: 8.8, speed: 0.64, color: 0xa8b0b8 },
    ],
    surfaceType: 'gas',
    surface: { groundColor: 0x7ec8c9, skyColor: 0x1a4a4a, roughness: 0.5 },
    narration: {
      name: 'Uranus!',
      fact: 'Uranus is a cold, icy blue planet that spins on its side! It has five big moons.',
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
    textureUrl: `${T}neptune.jpg`,
    hasRings: false,
    moons: [
      { name: 'Triton', radius: 0.42, orbitRadius: 5.2, speed: 0.90, color: 0xbcd0e0 },
      { name: 'Nereid', radius: 0.18, orbitRadius: 7.8, speed: 0.45, color: 0x9090a8 },
    ],
    surfaceType: 'gas',
    surface: { groundColor: 0x2a4fb0, skyColor: 0x0a1a3a, roughness: 0.5 },
    narration: {
      name: 'Neptune!',
      fact: 'Neptune is the furthest planet. It has the fastest winds in the whole solar system!',
    },
  },
];

export const BODIES_BY_KEY = Object.fromEntries(
  [SUN, ...PLANETS].map((b) => [b.key, b])
);
