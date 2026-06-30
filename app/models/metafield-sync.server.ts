import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import prisma from "../db.server";
import {
  METAFIELD_KEY,
  METAFIELD_NAMESPACE,
  parseJsonArray,
  type DiscountMode,
  type ScopeType,
} from "../constants.server";
import { ensureB2bDiscount } from "./b2b-discount.server";
import { ensureB2bValidation } from "./b2b-validation.server";

export type PriceTierInput = {
  minQty: number;
  value: number;
};

export type PriceRuleInput = {
  name: string;
  customerTags: string[];
  scopeType: ScopeType;
  scopeIds: string[];
  scopeTitles?: string[];
  discountMode?: DiscountMode;
  priority?: number;
  enabled?: boolean;
  tiers: PriceTierInput[];
};

export type MoqRuleInput = {
  name?: string;
  customerTags: string[];
  scopeType: ScopeType;
  scopeIds: string[];
  scopeTitles?: string[];
  minQty: number;
  message?: string;
  enabled?: boolean;
};

export type B2bPricingConfig = {
  enabled: boolean;
  guestMessage: string;
  showTierTable: boolean;
  tableHeaderBg: string;
  tableAccent: string;
  allCustomerTags: string[];
  priceRules: Array<{
    id: string;
    enabled: boolean;
    name: string;
    customerTags: string[];
    scopeType: ScopeType;
    scopeIds: string[];
    scopeTitles: string[];
    discountMode: DiscountMode;
    priority: number;
    tiers: PriceTierInput[];
  }>;
  moqRules: Array<{
    id: string;
    enabled: boolean;
    name: string;
    customerTags: string[];
    scopeType: ScopeType;
    scopeIds: string[];
    scopeTitles: string[];
    minQty: number;
    message: string;
  }>;
};

export async function getOrCreateShopSettings(shop: string) {
  return prisma.shopSettings.upsert({
    where: { shop },
    create: { shop },
    update: {},
  });
}

export async function updateShopSettings(
  shop: string,
  data: Partial<{
    enabled: boolean;
    guestMessage: string;
    showTierTable: boolean;
    tableHeaderBg: string;
    tableAccent: string;
  }>,
) {
  await getOrCreateShopSettings(shop);
  return prisma.shopSettings.update({
    where: { shop },
    data,
  });
}

export async function getPriceRules(shop: string) {
  return prisma.priceRule.findMany({
    where: { shop },
    include: { tiers: { orderBy: { minQty: "asc" } } },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
}

export async function createPriceRule(shop: string, data: PriceRuleInput) {
  return prisma.priceRule.create({
    data: {
      shop,
      name: data.name,
      customerTags: JSON.stringify(data.customerTags),
      scopeType: data.scopeType,
      scopeIds: JSON.stringify(data.scopeIds),
      scopeTitles: JSON.stringify(data.scopeTitles ?? []),
      discountMode: data.discountMode ?? "percent",
      priority: data.priority ?? 0,
      enabled: data.enabled ?? true,
      tiers: {
        create: data.tiers.map((tier) => ({
          minQty: tier.minQty,
          value: tier.value,
        })),
      },
    },
    include: { tiers: true },
  });
}

export async function deletePriceRule(shop: string, id: string) {
  return prisma.priceRule.deleteMany({ where: { id, shop } });
}

export async function togglePriceRule(
  shop: string,
  id: string,
  enabled: boolean,
) {
  return prisma.priceRule.updateMany({
    where: { id, shop },
    data: { enabled },
  });
}

export async function getMoqRules(shop: string) {
  return prisma.moqRule.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });
}

export async function createMoqRule(shop: string, data: MoqRuleInput) {
  return prisma.moqRule.create({
    data: {
      shop,
      name: data.name ?? "MOQ Rule",
      customerTags: JSON.stringify(data.customerTags),
      scopeType: data.scopeType,
      scopeIds: JSON.stringify(data.scopeIds),
      scopeTitles: JSON.stringify(data.scopeTitles ?? []),
      minQty: data.minQty,
      message: data.message ?? "未达最低起订量",
      enabled: data.enabled ?? true,
    },
  });
}

export async function deleteMoqRule(shop: string, id: string) {
  return prisma.moqRule.deleteMany({ where: { id, shop } });
}

export async function toggleMoqRule(
  shop: string,
  id: string,
  enabled: boolean,
) {
  return prisma.moqRule.updateMany({
    where: { id, shop },
    data: { enabled },
  });
}

export async function recordPricingEvent(
  shop: string,
  eventType: string,
  ruleId?: string,
) {
  return prisma.pricingEvent.create({
    data: { shop, eventType, ruleId },
  });
}

export async function getPricingStats(shop: string) {
  const [
    tierTableViews,
    moqWarnings,
    moqBlocked,
    b2bOrders,
    activePriceRules,
    activeMoqRules,
    settings,
  ] = await Promise.all([
    prisma.pricingEvent.count({
      where: { shop, eventType: "tier_table_view" },
    }),
    prisma.pricingEvent.count({
      where: { shop, eventType: "moq_warning" },
    }),
    prisma.pricingEvent.count({
      where: { shop, eventType: "moq_blocked" },
    }),
    prisma.pricingEvent.count({
      where: { shop, eventType: "b2b_order" },
    }),
    prisma.priceRule.count({ where: { shop, enabled: true } }),
    prisma.moqRule.count({ where: { shop, enabled: true } }),
    getOrCreateShopSettings(shop),
  ]);

  return {
    tierTableViews,
    moqWarnings,
    moqBlocked,
    b2bOrders,
    activePriceRules,
    activeMoqRules,
    enabled: settings.enabled,
  };
}

export async function buildB2bPricingConfig(
  shop: string,
): Promise<B2bPricingConfig> {
  const [settings, priceRules, moqRules] = await Promise.all([
    getOrCreateShopSettings(shop),
    getPriceRules(shop),
    getMoqRules(shop),
  ]);

  const tagSet = new Set<string>();
  for (const rule of priceRules) {
    parseJsonArray(rule.customerTags).forEach((tag) => tagSet.add(tag));
  }
  for (const rule of moqRules) {
    parseJsonArray(rule.customerTags).forEach((tag) => tagSet.add(tag));
  }

  return {
    enabled: settings.enabled,
    guestMessage: settings.guestMessage,
    showTierTable: settings.showTierTable,
    tableHeaderBg: settings.tableHeaderBg,
    tableAccent: settings.tableAccent,
    allCustomerTags: [...tagSet],
    priceRules: priceRules.map((rule) => ({
      id: rule.id,
      enabled: rule.enabled,
      name: rule.name,
      customerTags: parseJsonArray(rule.customerTags),
      scopeType: rule.scopeType as ScopeType,
      scopeIds: parseJsonArray(rule.scopeIds),
      scopeTitles: parseJsonArray(rule.scopeTitles),
      discountMode: rule.discountMode as DiscountMode,
      priority: rule.priority,
      tiers: rule.tiers.map((tier) => ({
        minQty: tier.minQty,
        value: tier.value,
      })),
    })),
    moqRules: moqRules.map((rule) => ({
      id: rule.id,
      enabled: rule.enabled,
      name: rule.name,
      customerTags: parseJsonArray(rule.customerTags),
      scopeType: rule.scopeType as ScopeType,
      scopeIds: parseJsonArray(rule.scopeIds),
      scopeTitles: parseJsonArray(rule.scopeTitles),
      minQty: rule.minQty,
      message: rule.message,
    })),
  };
}

export async function buildStorefrontConfig(shop: string) {
  const config = await buildB2bPricingConfig(shop);
  return {
    enabled: config.enabled,
    guestMessage: config.guestMessage,
    showTierTable: config.showTierTable,
    tableHeaderBg: config.tableHeaderBg,
    tableAccent: config.tableAccent,
    priceRules: config.priceRules
      .filter((rule) => rule.enabled)
      .map((rule) => ({
        customerTags: rule.customerTags,
        scopeType: rule.scopeType,
        scopeIds: rule.scopeIds,
        discountMode: rule.discountMode,
        priority: rule.priority,
        tiers: rule.tiers,
      })),
    moqRules: config.moqRules
      .filter((rule) => rule.enabled)
      .map((rule) => ({
        customerTags: rule.customerTags,
        scopeType: rule.scopeType,
        scopeIds: rule.scopeIds,
        minQty: rule.minQty,
        message: rule.message,
      })),
  };
}

export async function syncConfigToMetafield(
  admin: AdminApiContext,
  shop: string,
) {
  const config = await buildB2bPricingConfig(shop);

  const shopResponse = await admin.graphql(
    `#graphql
      query WholesalePulseShopId {
        shop {
          id
        }
      }
    `,
  );
  const shopJson = await shopResponse.json();
  const shopId = shopJson.data?.shop?.id;

  if (!shopId) {
    throw new Error("Unable to resolve shop id for metafield sync");
  }

  const response = await admin.graphql(
    `#graphql
      mutation WholesalePulseSyncConfig($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: METAFIELD_NAMESPACE,
            key: METAFIELD_KEY,
            type: "json",
            value: JSON.stringify(config),
          },
        ],
      },
    },
  );

  const json = await response.json();
  const userErrors = json.data?.metafieldsSet?.userErrors ?? [];
  if (userErrors.length) {
    throw new Error(userErrors.map((e: { message: string }) => e.message).join(", "));
  }

  return config;
}

export async function syncAll(
  admin: AdminApiContext,
  shop: string,
) {
  const config = await syncConfigToMetafield(admin, shop);
  const [discount, validation] = await Promise.all([
    ensureB2bDiscount(admin),
    ensureB2bValidation(admin),
  ]);
  return { config, discount, validation };
}

export async function purgeShopData(shop: string) {
  await prisma.pricingEvent.deleteMany({ where: { shop } });
  await prisma.moqRule.deleteMany({ where: { shop } });
  const rules = await prisma.priceRule.findMany({
    where: { shop },
    select: { id: true },
  });
  for (const rule of rules) {
    await prisma.priceTier.deleteMany({ where: { ruleId: rule.id } });
  }
  await prisma.priceRule.deleteMany({ where: { shop } });
  await prisma.shopSettings.deleteMany({ where: { shop } });
}

export async function fetchCustomerTagSuggestions(
  admin: AdminApiContext,
): Promise<string[]> {
  const response = await admin.graphql(
    `#graphql
      query WholesalePulseCustomerTags {
        customers(first: 50) {
          nodes {
            tags
          }
        }
      }
    `,
  );
  const json = await response.json();
  const nodes = json.data?.customers?.nodes ?? [];
  const tags = new Set<string>();
  for (const node of nodes) {
    for (const tag of node.tags ?? []) {
      tags.add(String(tag).toLowerCase());
    }
  }
  return [...tags].sort();
}
