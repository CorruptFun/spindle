/**
 * The eight ready-made loops, one per slot. Each is two bars: bar two varies
 * bar one and ends in a small fill that leads back to the top, so the loop
 * breathes instead of ticking over every bar.
 *
 * Written by role, not by sound, so every loop plays on every kit.
 */

import { STEPS_PER_BAR } from '@/engine/sequencer/types';
import { loopFromPattern } from './layers';
import { STEP_ACCENT, STEP_ON } from './pattern';
import { PAD_ROLES, type FactoryLoop, type PadRole, type StudioLoop } from './types';

/**
 * One character per sixteenth step. Velocity carries the feel: accents, a
 * normal hit, a medium and a soft in-between hit, and ghost notes that are
 * felt more than heard.
 */
const VELOCITY: Readonly<Record<string, number>> = {
  '.': 0,
  g: 0.3,
  h: 0.5,
  m: 0.65,
  x: STEP_ON,
  X: STEP_ACCENT,
};

const LOOP_BARS = 2;

/** Turns 'X...x... ........' (spaces ignored) into velocities. Throws on a typo. */
function lane(text: string): number[] {
  const chars = text.replace(/ /g, '');
  if (chars.length !== LOOP_BARS * STEPS_PER_BAR) {
    throw new Error(`Loop lane has ${chars.length} steps: ${text}`);
  }
  return [...chars].map((c) => {
    const v = VELOCITY[c];
    if (v === undefined) throw new Error(`Unknown step "${c}" in ${text}`);
    return v;
  });
}

const REST = '................ ................';

function loop(
  id: string,
  name: string,
  bpm: number,
  lanes: Partial<Record<PadRole, string>>,
): FactoryLoop {
  // Frozen: these are shared by every project that has not changed them yet.
  const pattern = Object.freeze({
    bars: LOOP_BARS,
    lanes: Object.freeze(PAD_ROLES.map(({ role }) => Object.freeze(lane(lanes[role] ?? REST)))),
  });
  return Object.freeze({ id, name, bpm, pattern });
}

export const FACTORY_LOOPS: readonly FactoryLoop[] = [
  // Slot 0 is what plays when a child taps Play: a kick on every beat and a
  // clap to clap along with. A snare run lifts it back to the top.
  loop('house', 'House', 124, {
    kick: 'X...X...X...X... X...X...X...X...',
    snare: '................ .............hmX',
    clap: '....X.......X... ....X.......X...',
    'closed-hat': '.g.h.g.h.g.h.g.h .g.h.g.h.g.h.g..',
    'open-hat': '..x...x...x...x. ..x...x...x.....',
    shaker: '................ ........g.g.h.m.',
    extra: '...........h.... ...h.......h....',
  }),

  // Head-nod hip-hop: lazy kick, hard backbeat, ghost snare before beat 3.
  loop('boom-bap', 'Boom Bap', 90, {
    kick: 'X..x......X..... X..x......X..x..',
    snare: '....X..g....X... ....X..g....Xg.x',
    'closed-hat': 'x.h.x.h.x.h.x.h. x.h.x.h.x.h.x...',
    'open-hat': '................ ..............x.',
    extra: '..........g..... ......g...g.....',
  }),

  // Half-time trap: snare on beat 3, busy sixteenth hats with accents and a
  // hat roll into the repeat.
  loop('trap', 'Trap', 140, {
    kick: 'X......X..X..... X......X.X...X..',
    snare: '........X....... ........X.......',
    clap: '........x....... ........x......h',
    'closed-hat': 'xgmgxgmgxgmgxgmg xgmgxgmgxgm.ghmx',
    'open-hat': '................ ...........x....',
  }),

  // A classic break: double kick, ghost-note snare, toms to finish.
  loop('break', 'Break', 112, {
    kick: 'X.X.......XX.... X.X.......X.....',
    snare: '....X..g.g..X..g ....X..g.g..x...',
    'closed-hat': 'x.h.x.h.x.h.x.h. x.h.x.h.x...x...',
    'open-hat': '................ ..........x.....',
    tom: '................ .............Xxm',
    shaker: '....h.......h... ....h.......h...',
  }),

  // Dembow: kick on every beat, the snare's "boom-ch-boom-chick" in between.
  loop('dembow', 'Dembow', 96, {
    kick: 'X...X...X...X... X...X...X...X...',
    snare: '...x..x....x..x. ...x..x....x.hmx',
    'closed-hat': '..h...h...h...h. ..h...h...h.....',
    shaker: 'h.g.h.g.h.g.h.g. h.g.h.g.h.g.h.g.',
    extra: '................ .......h...h....',
  }),

  // Funk: syncopated kick, ghost notes all over the snare, an open hat that
  // breathes just before beat three, and a cowbell keeping time.
  loop('funk', 'Funk', 104, {
    kick: 'X.x.......X..x.. X.x.......X.x...',
    snare: '....X..g.g.gX..g ....X..g.g..X.hX',
    'closed-hat': 'xgmgxgm.xgmgxgmg xgmgxgm.xgmgx...',
    'open-hat': '.......x........ .......x........',
    extra: 'h...h...h...h... h...h...h.......',
  }),

  // Disco: four on the floor with loud open hats on every off-beat.
  loop('disco', 'Disco', 118, {
    kick: 'X...X...X...X... X...X...X...X...',
    snare: '....X.......X... ....X.......Xhxx',
    clap: '................ ....h.......h...',
    'closed-hat': 'h..gh..gh..gh..g h..gh..gh..gh...',
    'open-hat': '..X...X...X...X. ..X...X...X.....',
  }),

  // Straight rock beat, the one everybody can play on a table, with a tom
  // roll at the end.
  loop('rock', 'Rock', 100, {
    kick: 'X.......X.X..... X.......X.X.....',
    snare: '....X.......X... ....X...........',
    'closed-hat': 'x.h.x.h.x.h.x.h. x.h.x.h.x.h.....',
    tom: '................ ............xxXX',
  }),
];

function freezeLoop(loop: StudioLoop): StudioLoop {
  return Object.freeze({
    bars: loop.bars,
    layers: Object.freeze(
      loop.layers.map((layer) =>
        Object.freeze({
          muted: layer.muted,
          pattern: Object.freeze({
            bars: layer.pattern.bars,
            lanes: Object.freeze(layer.pattern.lanes.map((lane) => Object.freeze(lane.slice()))),
          }),
        }),
      ),
    ),
  });
}

/** Each factory loop split into its layers, one per drum family. Frozen, like the patterns. */
const FACTORY_LAYERED: readonly StudioLoop[] = FACTORY_LOOPS.map((factory) =>
  freezeLoop(loopFromPattern(factory.pattern)),
);

/** The ready-made loop for a slot, as layers. Null for a slot that does not exist. */
export function factoryLoop(slot: number): StudioLoop | null {
  if (!Number.isInteger(slot)) return null;
  return FACTORY_LAYERED[slot] ?? null;
}
