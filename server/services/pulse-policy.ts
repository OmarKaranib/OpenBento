export const PULSE_INTERVAL_MS = 30 * 60 * 1000;
export const TOP_CHANNELS_LIMIT = 20;
export const BACKGROUND_REPAIR_WINDOW_MS = 24 * 60 * 60 * 1000;
export const BACKGROUND_REPAIR_LIMIT = 20;

export function maximumDailyPulseChecks(): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return TOP_CHANNELS_LIMIT * Math.ceil(millisecondsPerDay / PULSE_INTERVAL_MS);
}
