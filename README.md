# Wholesale Pulse

B2B 智能定价 Shopify App：**客户标签阶梯批发价**、**MOQ 结账拦截**、**商品页阶梯价表**。

独立产品：专注批发与起订量。基于 Remix + 双 Shopify Functions + Theme App Extension。

![Shopify](https://img.shields.io/badge/Shopify-App-7AB55C?logo=shopify&logoColor=white)
![Remix](https://img.shields.io/badge/Remix-000?logo=remix&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)

## 产品边界

| 覆盖 | 不覆盖 |
|------|--------|
| 标签阶梯行级价、MOQ Validation、批发价表与购物车预警 | B2C 购前弹窗、买赠、会员积分、预售、内容/售后中台 |

与 [Conversion Pulse](https://github.com/Alohamonde/conversion-pulse)、[Loyalty Pulse](https://github.com/Alohamonde/loyalty-pulse)、[Preorder Pulse](https://github.com/Alohamonde/preorder-pulse)、[Commerce Ops](https://github.com/Alohamonde/commerce-ops) **互不隶属**；可同店可选搭配，无安装依赖。

## 功能

| 模块 | 说明 |
|------|------|
| **标签阶梯定价** | Discount Function 为已登录批发客户按 SKU 数量应用行级折扣 |
| **MOQ 拦截** | Validation Function 在 checkout 阻断未达最低起订量的订单 |
| **阶梯价表** | Theme Extension 在商品页展示批发阶梯价，游客看到登录提示 |
| **购物车预警** | Theme Embed 监听购物车变化，提前提示 MOQ 不足 |
| **B2B 归因** | `orders/paid` Webhook + 店面事件追踪 KPI |

## 技术栈

- Remix + React + TypeScript
- Shopify Polaris + App Bridge
- Prisma + SQLite（开发）
- Discount Function `b2b-pricing`（行级批发价）
- Validation Function `b2b-moq`（MOQ 拦截）
- Theme App Extension `wholesale-storefront`
- Shop Metafields（`$app:b2b_pricing`）+ App Proxy

## 快速开始

### 环境要求

- Node.js 20+
- [Shopify Partner](https://partners.shopify.com) 账号
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)

### 安装运行

```bash
git clone https://github.com/Alohamonde/wholesale-pulse.git
cd wholesale-pulse
cp .env.example .env
npm install
npm run setup
npm run dev
```

### 店面启用

1. 主题编辑器 → 商品页 → 添加 **Wholesale tier table** 区块
2. 主题编辑器 → **App embeds** → 启用 **Wholesale cart MOQ hint**
3. 在 Shopify 后台为客户添加 `wholesale` 等标签（支持：`wholesale`, `b2b`, `b2b-vip`, `reseller`, `distributor`, `trade`, `vip`, `bulk`）
4. App 后台创建定价规则与 MOQ 规则

## 项目结构

```text
app/routes/
  app._index.tsx                      # KPI 总览
  app.rules.tsx                       # 定价规则 CRUD
  app.moq.tsx                         # MOQ 规则 CRUD
  app.settings.tsx                    # 全局设置
  apps.wholesale-pulse.config.tsx     # App Proxy 配置
  apps.wholesale-pulse.track.tsx      # 事件上报
  webhooks.orders.paid.tsx            # B2B 订单归因
extensions/
  b2b-pricing/                        # Discount Function
  b2b-moq/                            # Validation Function
  wholesale-storefront/               # Theme App Extension
```

## 可选搭配（无依赖）

- B2C 转化漏斗 → [Conversion Pulse](https://github.com/Alohamonde/conversion-pulse)
- VIP / 积分（标签概念可对齐）→ [Loyalty Pulse](https://github.com/Alohamonde/loyalty-pulse)
- 预售 / 到货 → [Preorder Pulse](https://github.com/Alohamonde/preorder-pulse)
- 规格文案 / 售后 → [Commerce Ops](https://github.com/Alohamonde/commerce-ops)

## License

MIT
