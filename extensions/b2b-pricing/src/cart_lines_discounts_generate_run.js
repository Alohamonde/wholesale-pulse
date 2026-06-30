import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
} from "../generated/api";

const SCOPE_WEIGHT = {
  variant: 4,
  product: 3,
  collection: 2,
  all: 1,
};

const TAG_ALIASES = {
  wholesale: "tagWholesale",
  b2b: "tagB2b",
  "b2b-vip": "tagB2bVip",
  reseller: "tagReseller",
  distributor: "tagDistributor",
  trade: "tagTrade",
  vip: "tagVip",
  bulk: "tagBulk",
};

function variantIdOf(line) {
  if (line.merchandise?.__typename !== "ProductVariant") return null;
  return line.merchandise.id ?? null;
}

function productIdOf(line) {
  if (line.merchandise?.__typename !== "ProductVariant") return null;
  return line.merchandise.product?.id ?? null;
}

function collectionIdsOf(line) {
  if (line.merchandise?.__typename !== "ProductVariant") return [];
  return (line.merchandise.product?.inCollections ?? [])
    .map((entry) => entry.collectionId)
    .filter(Boolean);
}

function activeCustomerTags(customer) {
  if (!customer) return new Set();
  const active = new Set();
  for (const [tag, alias] of Object.entries(TAG_ALIASES)) {
    if (customer[alias]) active.add(tag);
  }
  return active;
}

function ruleMatchesCustomer(rule, activeTags) {
  const tags = Array.isArray(rule.customerTags) ? rule.customerTags : [];
  if (!tags.length) return true;
  return tags.some((tag) => activeTags.has(String(tag).toLowerCase()));
}

function ruleMatchesLine(rule, line) {
  const scopeType = rule.scopeType || "all";
  const scopeIds = Array.isArray(rule.scopeIds) ? rule.scopeIds : [];

  if (scopeType === "all") return true;

  const variantId = variantIdOf(line);
  const productId = productIdOf(line);

  if (scopeType === "variant") {
    return scopeIds.includes(variantId);
  }

  if (scopeType === "product") {
    return scopeIds.includes(productId);
  }

  if (scopeType === "collection") {
    const collectionIds = collectionIdsOf(line);
    return scopeIds.some((id) => collectionIds.includes(id));
  }

  return false;
}

function pickBestRule(rules, line, activeTags) {
  const matches = rules
    .filter((rule) => rule.enabled !== false)
    .filter((rule) => ruleMatchesCustomer(rule, activeTags))
    .filter((rule) => ruleMatchesLine(rule, line));

  if (!matches.length) return null;

  return matches.sort((a, b) => {
    const priorityDiff = Number(b.priority || 0) - Number(a.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;
    return (
      (SCOPE_WEIGHT[b.scopeType] || 0) - (SCOPE_WEIGHT[a.scopeType] || 0)
    );
  })[0];
}

function pickBestTier(rule, quantity) {
  const tiers = Array.isArray(rule.tiers) ? rule.tiers : [];
  const eligible = tiers
    .filter((tier) => quantity >= Number(tier.minQty || 0))
    .sort((a, b) => Number(b.minQty || 0) - Number(a.minQty || 0));
  return eligible[0] ?? null;
}

function buildDiscountValue(rule, tier, line) {
  const mode = rule.discountMode || "percent";

  if (mode === "fixed_price") {
    const unitPrice = Number(line.cost?.amountPerQuantity?.amount ?? 0);
    const target = Number(tier.value || 0);
    if (unitPrice <= 0 || target < 0 || target >= unitPrice) return null;
    const percentOff = ((unitPrice - target) / unitPrice) * 100;
    return {
      percentage: {
        value: Math.min(100, Math.max(0, percentOff)),
      },
    };
  }

  const percent = Number(tier.value || 0);
  if (percent <= 0) return null;
  return {
    percentage: {
      value: Math.min(100, Math.max(0, percent)),
    },
  };
}

export function cartLinesDiscountsGenerateRun(input) {
  const lines = input.cart?.lines ?? [];
  if (!lines.length) return { operations: [] };

  if (!input.discount.discountClasses.includes(DiscountClass.Product)) {
    return { operations: [] };
  }

  const config = input.shop?.metafield?.jsonValue ?? null;
  if (!config || config.enabled === false) {
    return { operations: [] };
  }

  const buyer = input.cart?.buyerIdentity;
  if (!buyer?.isAuthenticated) {
    return { operations: [] };
  }

  const activeTags = activeCustomerTags(buyer.customer);
  const rules = Array.isArray(config.priceRules) ? config.priceRules : [];
  if (!rules.length) return { operations: [] };

  const candidates = [];

  for (const line of lines) {
    const rule = pickBestRule(rules, line, activeTags);
    if (!rule) continue;

    const tier = pickBestTier(rule, Number(line.quantity || 0));
    if (!tier) continue;

    const value = buildDiscountValue(rule, tier, line);
    if (!value) continue;

    const label =
      rule.discountMode === "fixed_price"
        ? `Wholesale $${tier.value}`
        : `Wholesale ${tier.value}% OFF`;

    candidates.push({
      message: label,
      targets: [{ cartLine: { id: line.id } }],
      value,
    });
  }

  if (!candidates.length) return { operations: [] };

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: ProductDiscountSelectionStrategy.All,
        },
      },
    ],
  };
}
