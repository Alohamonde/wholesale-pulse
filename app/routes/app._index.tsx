import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  Button,
  Badge,
  InlineGrid,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  getPriceRules,
  getPricingStats,
  syncAll,
} from "../models/metafield-sync.server";
import { getB2bDiscountStatus } from "../models/b2b-discount.server";
import { getB2bValidationStatus } from "../models/b2b-validation.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const [stats, rules, discountBefore, validationBefore] = await Promise.all([
    getPricingStats(shop),
    getPriceRules(shop),
    getB2bDiscountStatus(admin),
    getB2bValidationStatus(admin),
  ]);

  const syncResult = await syncAll(admin, shop);

  return json({
    stats,
    totalRules: rules.length,
    discount: syncResult.discount,
    validation: syncResult.validation,
    discountBefore,
    validationBefore,
  });
};

export default function Index() {
  const { stats, totalRules, discount, validation } =
    useLoaderData<typeof loader>();

  return (
    <Page
      title="Wholesale Pulse"
      subtitle="B2B 智能定价：客户标签阶梯价 + MOQ 结账拦截"
    >
      <TitleBar title="Wholesale Pulse" />
      <BlockStack gap="500">
        {!discount.ok ? (
          <Banner tone="critical">
            <p>
              批发折扣创建失败：
              {discount.errors?.[0]?.message || "请刷新页面重试"}
            </p>
          </Banner>
        ) : discount.created || discount.repaired ? (
          <Banner tone="success">
            <p>已{discount.created ? "创建" : "修复"}自动批发折扣。</p>
          </Banner>
        ) : null}

        {!validation.ok ? (
          <Banner tone="critical">
            <p>
              MOQ 校验创建失败：
              {validation.errors?.[0]?.message || "请刷新页面重试"}
            </p>
          </Banner>
        ) : validation.created || validation.repaired ? (
          <Banner tone="success">
            <p>已{validation.created ? "创建" : "修复"}结账 MOQ 校验。</p>
          </Banner>
        ) : null}

        <Layout>
          <Layout.Section>
            <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    活跃定价规则
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {stats.activePriceRules}
                  </Text>
                  <Text as="p" tone="subdued">
                    共 {totalRules} 条规则
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    B2B 订单
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {stats.b2bOrders}
                  </Text>
                  <Text as="p" tone="subdued">
                    orders/paid 归因
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    阶梯价曝光
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {stats.tierTableViews}
                  </Text>
                  <Text as="p" tone="subdued">
                    商品页阶梯表
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    MOQ 预警
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {stats.moqWarnings}
                  </Text>
                  <Text as="p" tone="subdued">
                    活跃 MOQ 规则 {stats.activeMoqRules}
                  </Text>
                </BlockStack>
              </Card>
            </InlineGrid>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  模块概览
                </Text>
                <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">
                      标签阶梯定价
                    </Text>
                    <Badge tone="success">Discount Function</Badge>
                    <Text as="p">
                      已登录且带批发标签的客户，按 SKU 数量自动享受行级折扣。
                    </Text>
                  </BlockStack>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">
                      MOQ 结账拦截
                    </Text>
                    <Badge tone="info">Validation Function</Badge>
                    <Text as="p">
                      未达最低起订量时，在 checkout 阶段阻断并展示自定义错误。
                    </Text>
                  </BlockStack>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">
                      店面阶梯价表
                    </Text>
                    <Badge>Theme Extension</Badge>
                    <Text as="p">
                      商品页向批发客户展示数量阶梯价，游客看到登录提示。
                    </Text>
                  </BlockStack>
                </InlineGrid>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <Button url="/app/rules" variant="primary">
                    管理定价规则
                  </Button>
                  <Button url="/app/moq">管理 MOQ 规则</Button>
                </InlineGrid>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
