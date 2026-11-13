# Features

The target is what a modern club setup does (two to four decks and a full mixer), reshaped so
the same abilities are reachable at three skill levels. This is the checklist the milestones in
[PLAN.md](PLAN.md) work through.

**●** in the mode · **◐** simplified or automatic · **–** hidden

## Decks

| Capability                  | Play | Mix | Pro | Milestone | Notes                                                 |
| --------------------------- | :--: | :-: | :-: | :-------: | ----------------------------------------------------- |
| Play, pause, cue            |  ●   |  ●  |  ●  |    M1     |                                                       |
| Platter: scratch, spin-back |  ●   |  ●  |  ●  |    M1     | Needs low touch-to-sound latency                      |
| Nudge / pitch bend          |  –   |  ●  |  ●  |    M2     |                                                       |
| Tempo fader                 |  –   |  ●  |  ●  |    M2     | Pro adds range choices                                |
| Waveforms                   |  ◐   |  ●  |  ●  |    M2     | Play: progress ring. Pro: stacked, frequency-coloured |
| Sync and quantize           |  ◐   |  ●  |  ●  |    M3     | Play: always on                                       |
| Key lock                    |  ◐   |  ●  |  ●  |    M3     | Play: always on. Pro adds key shift                   |
| Hot cues                    |  –   |  4  |  8  |    M4     |                                                       |
| Loops: auto, manual, roll   |  –   |  ◐  |  ●  |    M4     | Mix: auto loops only                                  |
| Beat jump                   |  –   |  –  |  ●  |    M4     |                                                       |
| Slip mode, reverse, brake   |  –   |  –  |  ●  |    M4     |                                                       |
| Decks three and four        |  –   |  –  |  ●  |    M6     | Limited by memory on phones                           |

## Mixer

| Capability                  | Play | Mix | Pro | Milestone | Notes                                                      |
| --------------------------- | :--: | :-: | :-: | :-------: | ---------------------------------------------------------- |
| Crossfader                  |  ●   |  ●  |  ●  |    M1     | Pro adds curve and channel assign                          |
| Channel faders              |  –   |  ●  |  ●  |    M1     |                                                            |
| Level meters                |  ◐   |  ●  |  ●  |    M1     |                                                            |
| Limiter and safe-volume cap |  ●   |  ●  |  ●  |  M1 / M5  | Cap is set in the grown-ups corner                         |
| Trim and auto-gain          |  ◐   |  ◐  |  ●  |    M4     | Automatic outside Pro                                      |
| 3-band EQ / isolator        |  –   |  ●  |  ●  |    M4     |                                                            |
| Filter                      |  ◐   |  ●  |  ●  |    M4     | Play: part of the magic FX pad                             |
| Headphone cue               |  –   |  –  |  ●  |    M6     | Second output on desktop Chrome/Edge; split-mono elsewhere |
| Microphone input            |  –   |  –  |  ●  |   Later   |                                                            |

## Effects and pads

| Capability                                 | Play | Mix | Pro | Milestone | Notes                                            |
| ------------------------------------------ | :--: | :-: | :-: | :-------: | ------------------------------------------------ |
| Magic FX pad (drag a finger, hear a sweep) |  ●   |  –  |  –  |    M4     |                                                  |
| Colour effects (one knob per channel)      |  –   |  ◐  |  ●  |    M4     | Filter, noise, crush, dub echo, space            |
| Beat effects                               |  –   |  3  |  ●  |    M4     | Echo, delay, reverb, flanger, phaser, roll, gate |
| Sound pads / sampler                       |  ●   |  ●  |  ●  |    M4     | Always quantized in Play                         |
| Stems (vocals / drums / melody)            |  –   |  –  |  ●  |   Later   | Heavy; needs WebGPU                              |

## Music and library

| Capability                               | Play | Mix | Pro | Milestone | Notes                                         |
| ---------------------------------------- | :--: | :-: | :-: | :-------: | --------------------------------------------- |
| Starter songs (works with nothing added) |  ●   |  ●  |  ●  |    M1     |                                               |
| Your own files                           |  ●   |  ●  |  ●  |    M1     | MP3, M4A/AAC, WAV, FLAC, OGG                  |
| BPM, key, beat grid, waveform analysis   |  ◐   |  ●  |  ●  |    M3     | Play uses it silently                         |
| Library, crates, search                  |  ◐   |  ●  |  ●  |    M3     | Play: picture grid                            |
| "Goes well next" suggestions             |  ●   |  ●  |  ●  |    M3     | From BPM and key                              |
| Apple Music jukebox                      |  ●   |  ●  |  ●  |    M7     | Listen-only. See [STREAMING.md](STREAMING.md) |
| Spotify jukebox                          |  ●   |  ●  |  ●  |    M7     | Listen-only, five approved accounts           |

## Hardware, output and app

| Capability                 | Play | Mix | Pro | Milestone | Notes                                 |
| -------------------------- | :--: | :-: | :-: | :-------: | ------------------------------------- |
| Multi-touch                |  ●   |  ●  |  ●  |    M1     |                                       |
| Installable, works offline |  ●   |  ●  |  ●  |  M0 / M8  |                                       |
| Guided lessons             |  –   |  ●  |  –  |    M5     |                                       |
| Record the mix             |  –   |  ●  |  ●  |    M6     | Never includes streamed audio         |
| Keyboard shortcuts         |  –   |  –  |  ●  |    M6     |                                       |
| MIDI controllers           |  –   |  –  |  ●  |    M6     | Not available in iPhone/iPad browsers |

## Studio

| Capability                                 | Play | Mix | Pro | Stage | Notes                                         |
| ------------------------------------------ | :--: | :-: | :-: | :---: | --------------------------------------------- |
| Eight drum pads                            |  ●   |  ●  |  ●  |  S1   | Several at once; colour marks the drum family |
| Three synthesised kits                     |  ●   |  ●  |  ●  |  S1   | Nothing downloaded or licensed                |
| Eight ready-made loops, swapped on the bar |  ●   |  ●  |  ●  |  S1   |                                               |
| Record your hits into a loop               |  –   |  ●  |  ●  |  S1   | Snapped to the nearest step                   |
| Step editor                                |  –   |  ●  |  ●  |  S1   | One pad at a time, sixteen steps              |
| Tempo                                      |  –   |  ●  |  ●  |  S1   |                                               |
| Swing                                      |  –   |  –  |  ●  |  S1   |                                               |
| Beat kept on the device                    |  ●   |  ●  |  ●  |  S1   |                                               |
| Bass, keys and lead instruments            |  ◐   |  ●  |  ●  |  S2   | Play: a keyboard that cannot hit a wrong note |
| Note editor                                |  –   |  ●  |  ●  |  S2   |                                               |
| Arrange loops into a song                  |  ◐   |  ●  |  ●  |  S3   |                                               |
| Mixer and effects per sound                |  –   |  ◐  |  ●  |  S3   |                                               |
| Record voice or instrument                 |  –   |  ●  |  ●  |  S4   | Needs the microphone, asked for when used     |
| Your own sounds on the pads                |  –   |  ●  |  ●  |  S4   |                                               |
| Save as an audio file, save projects       |  ●   |  ●  |  ●  |  S5   |                                               |

## Not planned

Third-party plug-ins (VST, Audio Units) and multi-input audio interfaces in the Studio.
Timecode vinyl control, exporting to club-player USB formats, lighting and video control. Each
needs hardware access or proprietary formats that a browser app cannot reach.
