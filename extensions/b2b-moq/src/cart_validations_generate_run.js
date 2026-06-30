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

function ruleMatchesScope(rule, variantId, productId, collectionIds) {
  const scopeType = rule.scopeType || "all";
  const scopeIds = Array.isArray(rule.scopeIds) ? rule.scopeIds : [];

  if (scopeType === "all") return true;
  if (scopeType === "variant") return scopeIds.includes(variantId);
  if (scopeType === "product") return scopeIds.includes(productId);
  if (scopeType === "collection") {
    return scopeIds.some((id) => collectionIds.includes(id));
  }
  return false;
}

function aggregateQuantities(lines) {
  const byVariant = new Map();
  const byProduct = new Map();
  const byCollection = new Map();
  let cartTotal = 0;

  for (const line of lines) {
    const qty = Number(line.quantity || 0);
    cartTotal += qty;

    const variantId = variantIdOf(line);
    const productId = productIdOf(line);
    const collectionIds = collectionIdsOf(line);

    if (variantId) {
      byVariant.set(variantId, (byVariant.get(variantId) || 0) + qty);
    }
    if (productId) {
      byProduct.set(productId, (byProduct.get(productId) || 0) + qty);
    }
    for (const collectionId of collectionIds) {
      byCollection.set(
        collectionId,
        (byCollection.get(collectionId) || 0) + qty,
      );
    }
  }

  return { byVariant, byProduct, byCollection, cartTotal };
}

function quantityForRule(rule, aggregates, line) {
  const scopeType = rule.scopeType || "all";
  const variantId = variantIdOf(line);
  const productId = productIdOf(line);
  const collectionIds = collectionIdsOf(line);

  if (scopeType === "all") return aggregates.cartTotal;
  if (scopeType === "variant") return aggregates.byVariant.get(variantId) || 0;
  if (scopeType === "product") return aggregates.byProduct.get(productId) || 0;
  if (scopeType === "collection") {
    const scopeIds = Array.isArray(rule.scopeIds) ? rule.scopeIds : [];
    return scopeIds.reduce(
      (max, id) => Math.max(max, aggregates.byCollection.get(id) || 0),
      0,
    );
  }
  return 0;
}

export function cartValidationsGenerateRun(input) {
  const config = input.shop?.metafield?.jsonValue ?? null;
  if (!config || config.enabled === false) {
    return { operations: [] };
  }

  const buyer = input.cart?.buyerIdentity;
  if (!buyer?.isAuthenticated) {
    return { operations: [] };
  }

  const activeTags = activeCustomerTags(buyer.customer);
  const moqRules = (Array.isArray(config.moqRules) ? config.moqRules : []).filter(
    (rule) => rule.enabled !== false,
  );
  if (!moqRules.length) return { operations: [] };

  const lines = input.cart?.lines ?? [];
  const aggregates = aggregateQuantities(lines);
  const errors = [];
  const seenMessages = new Set();

  for (const rule of moqRules) {
    if (!ruleMatchesCustomer(rule, activeTags)) continue;

    const minQty = Number(rule.minQty || 0);
    if (minQty <= 0) continue;

    if (rule.scopeType === "all") {
      if (aggregates.cartTotal < minQty) {
        const message =
          rule.message || `批发订单最少需要 ${minQty} 件商品`;
        if (!seenMessages.has(message)) {
          seenMessages.add(message);
          errors.push({ message, target: "$.cart" });
        }
      }
      continue;
    }

    for (const line of lines) {
      const variantId = variantIdOf(line);
      const productId = productIdOf(line);
      const collectionIds = collectionIdsOf(line);

      if (!ruleMatchesScope(rule, variantId, productId, collectionIds)) {
        continue;
      }

      const qty = quantityForRule(rule, aggregates, line);
      if (qty < minQty) {
        const message = rule.message || `最少购买 ${minQty} 件`;
        if (!seenMessages.has(message)) {
          seenMessages.add(message);
          errors.push({ message, target: "$.cart" });
        }
      }
    }
  }

  if (!errors.length) return { operations: [] };

  return {
    operations: [
      {
        validationAdd: {
          errors,
        },
      },
    ],
  };
}
