# Plan

What we are building, in what order, and what has to be decided along the way.
Companion documents: [FEATURES.md](FEATURES.md) (the full feature list),
[DESIGN.md](DESIGN.md) (how it looks and feels), [ARCHITECTURE.md](ARCHITECTURE.md) (how the
code is organised) and [STREAMING.md](STREAMING.md) (what Apple Music and Spotify allow).

## The product

A turntable DJ app that installs from the browser, works offline, and grows with the person
using it. A four-year-old can make two songs blend on a tablet with no reading. A working DJ
can run four decks with a hardware controller. Both are using the same audio engine.

Four principles decide most arguments:

1. **It cannot sound bad in Play mode.** Tempo-matched, on the beat, volume capped. Mistakes
   are impossible before they are interesting.
2. **One engine, three faces.** Play, Mix and Pro only differ in which controls are shown and
   how large they are. Nothing learned in one mode is unlearned in the next.
3. **Your music stays yours.** Files are decoded and stored on the device. No account, no
   upload, no server in the audio path.
4. **It looks and feels like a real instrument.** Industry-grade finish, inviting to a child
   and credible to a professional. Every screen is held to [DESIGN.md](DESIGN.md), and "it
   works" is not done until it also meets that bar.

## Skill modes

| Mode     | For                    | Decks | What is on screen                                                                               |
| -------- | ---------------------- | ----- | ----------------------------------------------------------------------------------------------- |
| **Play** | Ages 4 and up          | 2     | Two big records, play buttons, a crossfader, a magic FX pad, sound pads. Always in sync.        |
| **Mix**  | Beginners and families | 2     | Adds waveforms, tempo, sync, EQ, filter, hot cues, loops, three effects, and guided lessons.    |
| **Pro**  | Experienced DJs        | 2–4   | Everything: full mixer, beat FX, key lock, slip, beat jump, headphone cue, MIDI, and recording. |

The exact control list per mode is typed data in `src/config/modes.ts`, and the app shell
renders it, so the preview on screen is always the current plan.

## Milestones

Each milestone ends in something a person can use, and is checked on a real phone or tablet as
well as a desktop browser.

### M0 · Foundation — done

Repository structure, toolchain (Vite, React, TypeScript, Vitest, ESLint, Prettier), installable
PWA shell with offline caching and an update prompt, CI workflow, and these documents.

The design language is written down and the first real controls are built to it: a record that
can be grabbed, spun and thrown (with a tested motor-and-inertia model), a play button, and a
crossfader that fades each deck's colour. They move but are silent until M1.

### M1 · First mix — built, waiting on ears and real devices

- Engine: audio context lifecycle (switched on by the first touch), four decks into a mixer
  with channel faders, crossfader, limiter and real level meters.
- Deck playback runs on the audio thread and follows the record: play, pause, back to start,
  grab, scratch (backwards too), throw. Pulled forward from M2, because a record that moves
  while the sound ignores it would be a control that does nothing.
- Your own files: file picker and drag-and-drop onto a deck, decoded on the device.
- Four starter songs, written as code and synthesised by the app, so it makes sound before
  anyone adds a file and there is nothing to license. Same tempo and key family, so any two
  blend.
- Song picker, track display with time left, channel strips in Mix and Pro, all built to
  [DESIGN.md](DESIGN.md).

**Done when** a child who has never seen the app can start two records and slide between them
on a tablet without being told how.

Everything above is built and measured: unit tests, a real browser audio graph, and the live
app. What no test can say is whether the starter songs sound good, how the scratch feels under
a finger, and whether it all holds up on an iPhone, an iPad and an Android phone. That is the
remaining work for this milestone.

### M2 · Platters and waveforms

- Tempo fader, nudge and brake on top of the M1 playhead.
- Scratch feel tuned on real devices, with touch-to-sound latency measured and shown.
- Waveform peaks computed in a worker; overview and scrolling waveforms on canvas.

**Done when** scratching feels attached to the finger (round-trip latency measured and shown)
and waveforms scroll at the display's full frame rate on a mid-range phone.

### M3 · Analysis, sync and library

- BPM, beat grid and key detection in workers; results cached.
- Sync, quantize, key lock (time-stretch in WebAssembly), key shift.
- Library on the device: IndexedDB for records, origin-private file system for audio. Crates,
  search, sorting, "goes well next" suggestions from BPM and key.

**Done when** two analysed tracks stay locked for a full song, and the library is still there
after closing and reopening the app with no connection.

### M4 · Mixer, effects and pads

- Trim and auto-gain, 3-band EQ and isolator, filter, colour effects, beat effects.
- Hot cues, loops, rolls, beat jump, slip mode.
- Sampler pads, quantized to the master tempo. Magic FX pad for Play mode.

**Done when** Mix mode can do everything an entry-level hardware controller can.

### M5 · Kid-first experience

- Play mode polish: big targets, colour and shape instead of text, forgiving gestures.
- Guided lessons and challenges in Mix mode.
- Safe-volume cap, a grown-ups corner behind a simple gate, screen-reader and switch support.

**Done when** kids of different ages have used it unprompted and the things that confused them
are fixed. This milestone is driven by watching, not by a checklist.

### M6 · Pro rig

- Four decks, stacked waveforms, tempo ranges, crossfader curve and assign.
- Headphone cue (second audio output where the browser allows it, split-mono fallback).
- MIDI controllers: mappings for common devices and MIDI learn. Keyboard shortcuts.
- Recording the mix to a file.

**Done when** a DJ can play a set from a hardware controller with headphones and record it.

### M7 · Streaming jukebox (Apple Music and Spotify)

- **Spike first** (can run any time after M1): confirm on real devices what the two web
  players actually do, and re-read both sets of developer terms. Questions in
  [STREAMING.md](STREAMING.md).
- Apple Music: MusicKit on the web, sign-in, library and playlists, token service.
- Spotify: Web Playback SDK, sign-in, playlists. Mainly for Android users.
- Both are **listen-only**: one song at a time, the decks and pads go quiet while it plays.
  Behind a feature flag until the spike says it is worth shipping.

**Done when** someone can sign in, pick a song from their own playlists and hear it, and the
app makes it obvious why that song cannot go on a deck and how to get one that can.

### M8 · Ship

- Performance pass on low-end devices; memory budget for long tracks.
- Offline polish, install flow (including the Add to Home Screen hint on iPhone and iPad),
  persistent storage, wake lock, lock-screen controls.
- End-to-end tests, accessibility audit, deploy workflow, screenshots, public repository.

### Later

Stem separation (vocals / drums / melody), microphone input, visualiser, sharing recorded
mixes, syncing a library between devices.

## Streaming, in one paragraph

Apple Music and Spotify can be **played** inside the app. They cannot be **mixed**. Their audio
is encrypted so a web app never touches the samples, and both companies' developer terms rule
out layering or altering it. The DJ apps that do mix these catalogues have private licensing
deals. So streaming is a jukebox next to the decks, and the decks run on files the listener
owns, which includes anything bought from the iTunes Store. The detail and the sources are in
[STREAMING.md](STREAMING.md).

## Decisions needed from the owner

| #   | Decision                                                                                                                                                                    | Needed by | Default if nobody decides                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------- |
| 1   | **Name.** "Spindle" is a working title, set in one file (`src/config/brand.ts`).                                                                                            | M8        | Keep Spindle                              |
| 2   | **Is a listen-only jukebox worth building?** It needs an Apple Developer Program membership (paid, yearly) and a Spotify Premium account.                                   | M7        | Run the spike, then decide                |
| 3   | **Starter songs.** Four built-in songs are generated by the app, so nothing is licensed or downloaded. Do they sound good enough, or should real recordings be added later? | After M1  | Keep the generated songs                  |
| 4   | **Test devices.** Which phones and tablets the family actually uses; M1 and M2 are tuned on these.                                                                          | M1        | iPad, iPhone, one Android phone, a laptop |
| 5   | **Hosting.** The app is on GitHub Pages. The Apple Music token service needs somewhere to run (a Cloudflare Worker is planned).                                             | M7 / M8   | GitHub Pages + one Worker                 |
| 6   | **Repository visibility and licence.**                                                                                                                                      | M8        | Private until M8                          |

## Risks

| Risk                                                                                | What we do about it                                                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Touch-to-sound latency on Android varies a lot between phones.                      | Measure and display it from M2. Tune the platter on the worst device we own.                |
| Decoded audio is large: about 100 MB for a five-minute stereo track.                | Budget in M2 (16-bit storage halves it), unload on eject, cap deck count on small devices.  |
| iPhone and iPad browsers have no Web MIDI and limited audio-output routing.         | Hardware controllers and headphone cue are desktop and Android features; say so in the app. |
| Browsers may clear stored data for sites that are not installed.                    | Ask for persistent storage, nudge installation, keep imports re-linkable.                   |
| Key lock and analysis need heavy DSP.                                               | WebAssembly in worklets and workers; pick libraries in M3 with their licences checked.      |
| Streaming terms or SDKs change (Spotify changed its developer rules twice in 2026). | Streaming is isolated in `src/sources/*`, feature-flagged, and never on the critical path.  |
