-- Drop milestone tables from template
DROP TABLE IF EXISTS "MilestoneEvent";
DROP TABLE IF EXISTS "MilestoneRule";

-- Recreate ShopSettings for wholesale pulse
DROP TABLE IF EXISTS "ShopSettings";

CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "guestMessage" TEXT NOT NULL DEFAULT '登录查看批发价',
    "showTierTable" BOOLEAN NOT NULL DEFAULT true,
    "tableHeaderBg" TEXT NOT NULL DEFAULT '#111827',
    "tableAccent" TEXT NOT NULL DEFAULT '#16a34a',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "ShopSettings_shop_key" ON "ShopSettings"("shop");

CREATE TABLE "PriceRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "customerTags" TEXT NOT NULL DEFAULT '[]',
    "scopeType" TEXT NOT NULL DEFAULT 'product',
    "scopeIds" TEXT NOT NULL DEFAULT '[]',
    "scopeTitles" TEXT NOT NULL DEFAULT '[]',
    "discountMode" TEXT NOT NULL DEFAULT 'percent',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "PriceRule_shop_idx" ON "PriceRule"("shop");

CREATE TABLE "PriceTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "minQty" INTEGER NOT NULL,
    "value" REAL NOT NULL,
    CONSTRAINT "PriceTier_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PriceRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PriceTier_ruleId_idx" ON "PriceTier"("ruleId");

CREATE TABLE "MoqRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL DEFAULT 'MOQ Rule',
    "customerTags" TEXT NOT NULL DEFAULT '[]',
    "scopeType" TEXT NOT NULL DEFAULT 'product',
    "scopeIds" TEXT NOT NULL DEFAULT '[]',
    "scopeTitles" TEXT NOT NULL DEFAULT '[]',
    "minQty" INTEGER NOT NULL,
    "message" TEXT NOT NULL DEFAULT '未达最低起订量',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "MoqRule_shop_idx" ON "MoqRule"("shop");

CREATE TABLE "PricingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "ruleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "PricingEvent_shop_eventType_idx" ON "PricingEvent"("shop", "eventType");
