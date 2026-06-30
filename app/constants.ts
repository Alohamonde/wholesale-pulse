export const SUPPORTED_CUSTOMER_TAGS = [
  "wholesale",
  "b2b",
  "b2b-vip",
  "reseller",
  "distributor",
  "trade",
  "vip",
  "bulk",
] as const;

export type SupportedCustomerTag = (typeof SUPPORTED_CUSTOMER_TAGS)[number];

export type ScopeType = "variant" | "product" | "collection" | "all";

export type DiscountMode = "percent" | "fixed_price";
