# Spindle

A turntable DJ app for every age. It installs from the browser, works offline, and has three
skill levels on one audio engine: **Play** for small kids, **Mix** for learners, **Pro** for
the full booth.

**Try it: <https://corruptfun.github.io/spindle/>** On a phone or tablet, open the link and
choose _Add to Home Screen_ (iPhone, iPad) or _Install app_ (Android, desktop) to keep it as an
app that works offline.

> "Spindle" is a working title. Status: **Milestone 1 of 8** — two decks (four in Pro) that
> play, scratch and mix, four built-in starter songs, and your own music files. Waveforms,
> tempo sync, effects and the rest are listed in [docs/PLAN.md](docs/PLAN.md).

## Run it

Requires Node 22 or newer.

```bash
npm install
npm run dev
```

| Command           | What it does                                          |
| ----------------- | ----------------------------------------------------- |
| `npm run dev`     | Start the dev server                                  |
| `npm run build`   | Type-check and build the installable app into `dist`  |
| `npm run preview` | Serve the built app (the service worker runs here)    |
| `npm test`        | Run unit tests                                        |
| `npm run lint`    | Lint, including the folder-boundary rules             |
| `npm run check`   | Everything CI runs: types, lint, format, tests, build |
| `npm run icons`   | Regenerate app icons from `public/logo.svg`           |

Pushing to `main` checks, builds and publishes the app to GitHub Pages.

## Where things are

```
src/engine      the audio engine (no UI code allowed)
src/sources     where music comes from: starter songs, your files, Apple Music, Spotify
src/analysis    waveform, BPM and key detection (workers)
src/library     the collection stored on the device
src/controllers MIDI and keyboard input
src/ui          components and the Play / Mix / Pro layouts
src/state       stores between the engine and the screen
services        the Apple Music token signer
docs            plan, features, architecture, streaming
```

## Read next

- [docs/PLAN.md](docs/PLAN.md) — milestones, open decisions, risks
- [docs/FEATURES.md](docs/FEATURES.md) — every feature, by skill level
- [docs/DESIGN.md](docs/DESIGN.md) — the design language every screen is held to
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the code is organised and why
- [docs/STREAMING.md](docs/STREAMING.md) — what Apple Music and Spotify can and cannot do here

## Your music

The decks play audio files you own: iTunes Store purchases, CD rips, Bandcamp downloads, your
own recordings. Files are decoded and kept on your device and are never uploaded.

Apple Music and Spotify are planned as a listen-only jukebox beside the decks. Their audio is
protected and their terms do not allow third-party apps to mix it.
