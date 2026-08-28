export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export function requestTimeoutSignal(timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}
