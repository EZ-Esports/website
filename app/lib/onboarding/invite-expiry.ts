/**
 * The only link lifetimes a player invite may have. A longer-lived bearer link is a larger window
 * for a forwarded or leaked link to be used, so the server rejects any other value rather than
 * clamping it. Lives outside the 'use server' actions file so client code can share it.
 */
export const INVITE_EXPIRY_DAYS = [3, 5, 7] as const;
export type InviteExpiryDays = (typeof INVITE_EXPIRY_DAYS)[number];
export const DEFAULT_INVITE_EXPIRY_DAYS: InviteExpiryDays = 7;

export function isInviteExpiryDays(value: unknown): value is InviteExpiryDays {
  return INVITE_EXPIRY_DAYS.some((days) => days === value);
}
