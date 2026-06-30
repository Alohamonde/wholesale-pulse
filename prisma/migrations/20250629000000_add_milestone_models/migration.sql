-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "freeShippingThreshold" REAL NOT NULL DEFAULT 50,
    "barBgColor" TEXT NOT NULL DEFAULT '#e5e7eb',
    "barFillColor" TEXT NOT NULL DEFAULT '#16a34a',
    "barTextColor" TEXT NOT NULL DEFAULT '#111827',
    "suggestionCollectionId" TEXT NOT NULL DEFAULT '',
    "suggestionCollectionTitle" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MilestoneRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "thresholdAmount" REAL NOT NULL,
    "rewardType" TEXT NOT NULL DEFAULT 'order_discount',
    "rewardLabel" TEXT NOT NULL DEFAULT '满额享折扣',
    "discountPercent" REAL NOT NULL DEFAULT 5,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MilestoneEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "ruleId" TEXT,
    "eventType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopSettings_shop_key" ON "ShopSettings"("shop");

-- CreateIndex
CREATE INDEX "MilestoneRule_shop_idx" ON "MilestoneRule"("shop");

-- CreateIndex
CREATE INDEX "MilestoneEvent_shop_eventType_idx" ON "MilestoneEvent"("shop", "eventType");
