# Design language

**A real instrument in toy-bright colour.**

The app should look like a well-made piece of gear that happens to live on a screen: matte,
precise and calm, with a small number of saturated colours doing real work. That is what makes
it credible to a working DJ and inviting to a five-year-old at the same time. The appeal for
kids comes from big objects that respond the instant they are touched, not from cartoon
decoration. The appeal for adults comes from restraint.

Every screen is held to this document. If a change needs to break it, change the document
first.

## Principles

1. **Objects, not widgets.** A record can be grabbed and spun. A fader has a cap and a slot.
   Controls look like the physical thing and move with weight: inertia, friction, a motor
   pulling a record back up to speed.
2. **Colour means something.** Each deck owns one colour, and that colour marks everything
   belonging to it: the record label, the ring, its side of the crossfader, later its waveform.
   Everything else is neutral. There is no decorative colour.
3. **One of everything.** One typeface. One spacing grid. One radius scale. One set of motion
   timings. A new value needs a reason and goes in the tokens file.
4. **Same parts at every size.** Play mode is not a different app. It is the same record, the
   same fader, the same button, larger and with fewer neighbours.
5. **It answers within a frame.** Touch feedback never waits for audio, the network or a
   re-render. Anything that moves continuously is drawn outside React.
6. **Honest screens.** No control that does nothing. No meter that is not measuring. No
   placeholder numbers. If a thing is not built, the screen says so plainly or leaves it out.

## Tokens

All values live in `src/ui/theme/tokens.css`. Components use the variables and never a literal
colour, size or duration.

| Group     | Tokens                                                       | Notes                                                              |
| --------- | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| Chassis   | `--chassis` `--panel` `--panel-raised` `--well` `--hairline` | Warm near-black neutrals. `--well` is for recessed slots.          |
| Ink       | `--ink` `--ink-dim` `--ink-faint`                            | Warm white. `--ink-faint` is for marks and ticks, never body text. |
| Decks     | `--deck-a` `--deck-b` `--deck-c` `--deck-d`                  | Blue, orange, pink, lime. Always paired with the deck's letter.    |
| Materials | `--vinyl` `--vinyl-groove` `--vinyl-sheen` `--metal`         | Only for drawing physical objects.                                 |
| Type      | `--font`, `--text-xs` … `--text-xl`, `--label-tracking`      | Figtree, self-hosted. Numbers are tabular.                         |
| Space     | `--space-1` … `--space-7`                                    | 4 px grid.                                                         |
| Radius    | `--radius-cap` `--radius-control` `--radius-panel`           | 6 / 12 / 20.                                                       |
| Motion    | `--dur-fast` `--dur` `--ease-out`                            | 90 ms for touch feedback, 180 ms for state changes.                |
| Touch     | `--touch-min` `--touch-play`                                 | 48 px everywhere, 72 px in Play mode.                              |

Selected and active states use `--ink` on `--chassis` (a light cap on a dark body), or the
deck's own colour when the control belongs to a deck. There is no separate brand accent.

## Type

- One family, Figtree. Weights 500 (text), 650 (controls), 800 (deck letters).
- Hardware-style labels: `--text-xs`, uppercase, `--label-tracking`, `--ink-dim`.
- Play mode avoids words. Where a word is unavoidable it is one short word next to a shape.
- Times, tempos and levels use tabular figures so they do not jitter.

## Every control

A control is not finished until it:

- has a touch target of at least `--touch-min` (`--touch-play` in Play mode);
- works with touch, mouse and keyboard, and shows a clear focus ring;
- announces its name, state and value to a screen reader;
- has a designed disabled state (used when a deck's capabilities rule it out);
- behaves sensibly with reduced motion switched on;
- holds its frame rate on the slowest device we test with.

## Play mode, specifically

- Nothing can be broken, lost or made to sound bad by tapping around.
- Shape and colour before text: "the blue record", not "Deck A".
- One gesture per object. A record spins. A fader slides. A pad is hit.
- No menus, no small close buttons, no long-press, no double-tap.
- Grown-up settings sit behind a gate and never appear by accident.

## What we do not do

These are the tells of a rushed interface. None of them ship.

- Gradient text, neon glows, or blurred glass panels.
- Purple-on-dark as a default accent.
- Emoji as icons, or icons from mixed sets. Icons are drawn for this app, on one grid.
- Shadows as decoration. A shadow is only used where one object really sits above another.
- Cards inside cards, pills for everything, and several corner radii on one screen.
- Animation that does not explain a change of state.
- Fake data: sample track names, invented BPMs, meters that only look busy.
- Layouts that only work at one window size.

## Review checklist

Before a UI change is merged:

1. Looked at on a phone (375 px), a tablet (768 px) and a laptop (1280 px).
2. Text contrast at least 4.5:1; control outlines and states at least 3:1.
3. Reachable and operable by keyboard; focus is visible.
4. Only tokens: no literal colours, sizes or durations in component styles.
5. Reduced motion checked.
6. Nothing on screen is pretending.
