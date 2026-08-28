export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export function requestTimeoutSignal(
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  parentSignal?: AbortSignal,
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return parentSignal ? AbortSignal.any([parentSignal, timeoutSignal]) : timeoutSignal;
}
