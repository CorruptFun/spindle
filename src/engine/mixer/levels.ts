/**
 * Largest absolute sample value, for meters. Allocation-free because it runs
 * every animation frame. NaN samples are skipped so one bad sample cannot
 * freeze a meter at NaN.
 */
export function peakOf(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i] ?? 0);
    if (v > peak) peak = v;
  }
  return peak;
}
