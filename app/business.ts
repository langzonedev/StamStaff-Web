// Public display configuration only; account access is enforced by the service.
export const businessName =
  (process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "").trim().slice(0, 120);
