import type { ScopeType } from "./constants";

export { SUPPORTED_CUSTOMER_TAGS } from "./constants";
export type { DiscountMode, ScopeType, SupportedCustomerTag } from "./constants";

export const METAFIELD_NAMESPACE = "$app:b2b_pricing";
export const METAFIELD_KEY = "config";

export function parseJsonArray<T = string>(raw: string, fallback: T[] = []): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeTags(input: string): string[] {
  return input
    .split(/[,，\s]+/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

export function scopeSpecificity(scopeType: ScopeType): number {
  switch (scopeType) {
    case "variant":
      return 4;
    case "product":
      return 3;
    case "collection":
      return 2;
  }
  return 1;
}
