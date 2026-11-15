/**
 * Limits on FRESH result submissions (a "Check again" on saved IDs is not counted). Every fresh
 * submission can cost up to three requests against the shared API key, so they are spaced out per
 * match and capped per user. The decision is pure; the attempts it reads are persisted in
 * `match_result_attempts` so the limit holds across serverless instances.
 */

/** Minimum gap between fresh submissions for one match. */
export const MATCH_COOLDOWN_MS = 30_000;
/** Window and cap for one user's fresh submissions. */
export const USER_WINDOW_MS = 60 * 60 * 1000;
export const USER_MAX_PER_WINDOW = 10;

export type ThrottleDecision = { ok: true } | { ok: false; waitSeconds: number; message: string };

function waitText(seconds: number): string {
  if (seconds < 90) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minutes`;
}

export function throttleDecision(params: {
  now: Date;
  /** When this match last had a fresh submission, if ever. */
  lastForMatch: Date | null;
  /** This user's fresh submissions inside the last hour (any order). */
  userAttempts: readonly Date[];
}): ThrottleDecision {
  const now = params.now.getTime();

  if (params.lastForMatch) {
    const wait = params.lastForMatch.getTime() + MATCH_COOLDOWN_MS - now;
    if (wait > 0) {
      const waitSeconds = Math.ceil(wait / 1000);
      return {
        ok: false,
        waitSeconds,
        message: `This match was just submitted. Wait ${waitText(waitSeconds)} before submitting again.`,
      };
    }
  }

  const recent = params.userAttempts.map((d) => d.getTime()).filter((t) => t > now - USER_WINDOW_MS);
  if (recent.length >= USER_MAX_PER_WINDOW) {
    // The oldest attempt in the window frees a slot when it ages out.
    const oldest = Math.min(...recent);
    const waitSeconds = Math.ceil((oldest + USER_WINDOW_MS - now) / 1000);
    return {
      ok: false,
      waitSeconds,
      message: `You have submitted results ${USER_MAX_PER_WINDOW} times in the last hour. Try again in ${waitText(waitSeconds)}.`,
    };
  }
  return { ok: true };
}
