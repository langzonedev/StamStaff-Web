export type DeliveryStatus = {
  pending: number;
  sent: number;
  failed: number;
  heldUnknown?: number;
  retryable?: number;
  legacyEmailSent?: number;
  legacyEmailHeld?: number;
};

// Older status responses do not identify safe retries. Fail closed for that
// action rather than treating every failed/uncertain handoff as retryable.
export function deliveryView(status: DeliveryStatus) {
  const heldUnknown = Math.max(0, Math.min(status.failed, status.heldUnknown ?? 0));
  const ordinaryFailed = Math.max(0, status.failed - heldUnknown);
  return {
    ...status,
    heldUnknown,
    ordinaryFailed,
    retryable: Math.max(0, Math.min(ordinaryFailed, status.retryable ?? 0)),
  };
}
