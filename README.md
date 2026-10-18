# FORMULA 1 — Driver POV Multiplayer

Four files required at the repository root: `index.html`, `server.js`, `track.js`, `package.json`.

## Controls
- W / Up: accelerate
- S / Down: brake
- A / Left: steer left
- D / Right: steer right

## Deploy
Push the four files to the GitHub repository connected to Render. Render Web Service: build command `npm install`, start command `npm start`.

## Gameplay
The server tracks car x/y position and heading. Cars do not automatically follow the circuit; the browser projects the shared track geometry from the driver's world position. Race rooms support up to eight drivers, a three-lap race, a safety car, a pit stop during safety-car periods, and results.

## Notes
This is a prototype. Server-side multiplayer and driving feel should be tested in multiple browsers before public release.
