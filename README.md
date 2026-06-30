# Wholesale Pulse

B2B 智能定价 Shopify App：**客户标签阶梯批发价**、**MOQ 结账拦截**、**商品页阶梯价表**。基于 Remix + 双 Shopify Functions + Theme App Extension，与 Omni Store Toolkit、Checkout Pulse、Cart Milestone、Gift Auto 形成差异化矩阵。

![Shopify](https://img.shields.io/badge/Shopify-App-7AB55C?logo=shopify&logoColor=white)
![Remix](https://img.shields.io/badge/Remix-000?logo=remix&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)

## 功能

| 模块 | 说明 |
|------|------|
| **标签阶梯定价** | Discount Function 为已登录批发客户按 SKU 数量应用行级折扣 |
| **MOQ 拦截** | Validation Function 在 checkout 阻断未达最低起订量的订单 |
| **阶梯价表** | Theme Extension 在商品页展示批发阶梯价，游客看到登录提示 |
| **购物车预警** | Theme Embed 监听购物车变化，提前提示 MOQ 不足 |
| **B2B 归因** | `orders/paid` Webhook + 店面事件追踪 KPI |

## 与现有项目的差异化

| 项目 | 场景 | 核心技术 |
|------|------|----------|
| Omni Store Toolkit | 购前店面 | 弹窗、关联销售 |
| Gift Auto | 购中赠品 | 买 X 送 Y、赠品行归零 |
| Cart Milestone | 购物车凑单 | 满额订单折扣 |
| Checkout Pulse | 购后追加销售 | Checkout UI Extension |
| **Wholesale Pulse** | **B2B 批发定价** | **标签匹配 + 行级折扣 + MOQ Validation** |

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

## License

MIT
