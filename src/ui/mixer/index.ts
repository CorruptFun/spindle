/**
 * ui/mixer: the middle of the booth.
 *
 * Today: Crossfader, ChannelFader, and for screens with room to stand the
 * mixer between the decks, ChannelStrip (a meter beside its fader) and
 * MixerUnit (the strips, the master level and the crossfader as one unit).
 * Meters come from ui/components (LevelMeter).
 * Milestone 4: EqStrip, FilterKnob, FxPanel, MagicFxPad (Play mode), SamplerPads.
 * Milestone 6: HeadphoneCue.
 */
export * from './ChannelFader';
export * from './ChannelStrip';
export * from './Crossfader';
export * from './MixerUnit';
