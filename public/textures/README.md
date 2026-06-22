# Optional planet textures

The game generates all planet visuals **procedurally** at runtime, so it works
with no network access and no downloads.

If you'd like more photo-realistic planets later, you can drop real equirectangular
texture images here (for example public-domain NASA maps such as
`earth.jpg`, `mars.jpg`, `jupiter.jpg`, …) and wire them up in
`src/utils/textures.js` (`getPlanetTexture`) with a graceful fallback to the
procedural generator when an image is missing.
