// Serializes membership reconciliation with explicit revocation. The lock is
// transaction-scoped, so crashes and thrown errors release it automatically.
export const STAFF_REVOCATION_LOCK_KEY = 8765001;
