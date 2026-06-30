import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  BlockStack,
  Text,
  Banner,
  ResourceList,
  ResourceItem,
  InlineStack,
  Select,
  Badge,
  Thumbnail,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useCallback, useEffect, useState } from "react";
import { authenticate } from "../shopify.server";
import {
  SUPPORTED_CUSTOMER_TAGS,
  type DiscountMode,
  type ScopeType,
} from "../constants";
import { normalizeTags } from "../constants.server";
import {
  createPriceRule,
  deletePriceRule,
  fetchCustomerTagSuggestions,
  getPriceRules,
  syncAll,
  togglePriceRule,
} from "../models/metafield-sync.server";
import {
  searchProducts,
  type SearchProduct,
} from "../models/products.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [rules, tagSuggestions] = await Promise.all([
    getPriceRules(session.shop),
    fetchCustomerTagSuggestions(admin),
  ]);
  return json({ rules, tagSuggestions });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent"));

  if (intent === "search_products") {
    const query = String(formData.get("query") ?? "");
    const products = await searchProducts(admin, query);
    return json({ products });
  }

  if (intent === "create") {
    const customerTags = normalizeTags(String(formData.get("customerTags") ?? ""));
    const scopeType = String(formData.get("scopeType")) as ScopeType;
    const scopeIds = JSON.parse(String(formData.get("scopeIds") ?? "[]"));
    const scopeTitles = JSON.parse(String(formData.get("scopeTitles") ?? "[]"));
    const tiers = JSON.parse(String(formData.get("tiers") ?? "[]"));

    const unsupported = customerTags.filter(
      (tag) => !SUPPORTED_CUSTOMER_TAGS.includes(tag as (typeof SUPPORTED_CUSTOMER_TAGS)[number]),
    );
    if (unsupported.length) {
      return json(
        {
          ok: false,
          message: `暂不支持标签：${unsupported.join(", ")}。请使用：${SUPPORTED_CUSTOMER_TAGS.join(", ")}`,
        },
        { status: 400 },
      );
    }

    await createPriceRule(session.shop, {
      name: String(formData.get("name") ?? "批发规则"),
      customerTags,
      scopeType,
      scopeIds,
      scopeTitles,
      discountMode: String(formData.get("discountMode")) as DiscountMode,
      priority: Number(formData.get("priority") ?? 0),
      tiers,
    });
    await syncAll(admin, session.shop);
    return json({ ok: true, message: "定价规则已创建" });
  }

  if (intent === "delete") {
    await deletePriceRule(session.shop, String(formData.get("id")));
    await syncAll(admin, session.shop);
    return json({ ok: true, message: "规则已删除" });
  }

  if (intent === "toggle") {
    await togglePriceRule(
      session.shop,
      String(formData.get("id")),
      formData.get("enabled") === "true",
    );
    await syncAll(admin, session.shop);
    return json({ ok: true, message: "规则状态已更新" });
  }

  return json({ ok: false }, { status: 400 });
};

const scopeOptions = [
  { label: "指定商品", value: "product" },
  { label: "指定系列", value: "collection" },
  { label: "全部商品", value: "all" },
];

const discountModeOptions = [
  { label: "百分比折扣", value: "percent" },
  { label: "固定单价", value: "fixed_price" },
];

export default function RulesPage() {
  const { rules, tagSuggestions } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const searchFetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [name, setName] = useState("批发阶梯价");
  const [customerTags, setCustomerTags] = useState("wholesale");
  const [scopeType, setScopeType] = useState<ScopeType>("product");
  const [discountMode, setDiscountMode] = useState<DiscountMode>("percent");
  const [priority, setPriority] = useState("10");
  const [tierMinQty, setTierMinQty] = useState("10");
  const [tierValue, setTierValue] = useState("15");
  const [tiers, setTiers] = useState<Array<{ minQty: number; value: number }>>([
    { minQty: 10, value: 15 },
    { minQty: 50, value: 25 },
  ]);
  const [productQuery, setProductQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<SearchProduct | null>(
    null,
  );

  const addTier = useCallback(() => {
    setTiers((current) => [
      ...current,
      { minQty: Number(tierMinQty), value: Number(tierValue) },
    ]);
  }, [tierMinQty, tierValue]);

  const createRule = useCallback(() => {
    const payload = new FormData();
    payload.append("intent", "create");
    payload.append("name", name);
    payload.append("customerTags", customerTags);
    payload.append("scopeType", scopeType);
    payload.append(
      "scopeIds",
      JSON.stringify(
        scopeType === "all"
          ? []
          : selectedProduct
            ? [selectedProduct.id]
            : [],
      ),
    );
    payload.append(
      "scopeTitles",
      JSON.stringify(selectedProduct ? [selectedProduct.title] : []),
    );
    payload.append("discountMode", discountMode);
    payload.append("priority", priority);
    payload.append("tiers", JSON.stringify(tiers));
    fetcher.submit(payload, { method: "POST" });
  }, [
    customerTags,
    discountMode,
    fetcher,
    name,
    priority,
    scopeType,
    selectedProduct,
    tiers,
  ]);

  useEffect(() => {
    if (fetcher.data?.message) {
      shopify.toast.show(fetcher.data.message);
    }
  }, [fetcher.data, shopify]);

  const searchResults =
  searchFetcher.data && "products" in searchFetcher.data
    ? searchFetcher.data.products
    : [];

  return (
    <Page title="定价规则" subtitle="按客户标签 + 数量阶梯配置批发价">
      <TitleBar title="定价规则" />
      <Layout>
        <Layout.Section>
          <Banner tone="info">
            <p>
              支持的批发标签：{SUPPORTED_CUSTOMER_TAGS.join(", ")}。
              {tagSuggestions.length
                ? ` 店铺已有标签：${tagSuggestions.slice(0, 8).join(", ")}`
                : ""}
            </p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                新建定价规则
              </Text>
              <FormLayout>
                <TextField
                  label="规则名称"
                  value={name}
                  onChange={setName}
                  autoComplete="off"
                />
                <TextField
                  label="客户标签（逗号分隔）"
                  value={customerTags}
                  onChange={setCustomerTags}
                  autoComplete="off"
                  helpText="客户须已登录且带有至少一个标签"
                />
                <Select
                  label="适用范围"
                  options={scopeOptions}
                  value={scopeType}
                  onChange={(value) => setScopeType(value as ScopeType)}
                />
                {scopeType === "product" ? (
                  <BlockStack gap="200">
                    <TextField
                      label="搜索商品"
                      value={productQuery}
                      onChange={setProductQuery}
                      autoComplete="off"
                      connectedRight={
                        <Button
                          onClick={() => {
                            const payload = new FormData();
                            payload.append("intent", "search_products");
                            payload.append("query", productQuery);
                            searchFetcher.submit(payload, { method: "POST" });
                          }}
                        >
                          搜索
                        </Button>
                      }
                    />
                    {searchResults?.map((product: SearchProduct) => (
                      <Button
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        textAlign="left"
                      >
                        {product.title}
                      </Button>
                    ))}
                    {selectedProduct ? (
                      <InlineStack gap="200" blockAlign="center">
                        <Thumbnail
                          source={selectedProduct.imageUrl || ""}
                          alt={selectedProduct.title}
                        />
                        <Text as="span">{selectedProduct.title}</Text>
                      </InlineStack>
                    ) : null}
                  </BlockStack>
                ) : null}
                <Select
                  label="折扣模式"
                  options={discountModeOptions}
                  value={discountMode}
                  onChange={(value) => setDiscountMode(value as DiscountMode)}
                />
                <TextField
                  label="优先级"
                  type="number"
                  value={priority}
                  onChange={setPriority}
                  autoComplete="off"
                  helpText="数字越大越优先"
                />
                <InlineStack gap="200">
                  <TextField
                    label="阶梯起订量"
                    type="number"
                    value={tierMinQty}
                    onChange={setTierMinQty}
                    autoComplete="off"
                  />
                  <TextField
                    label={discountMode === "percent" ? "折扣 %" : "固定单价 $"}
                    type="number"
                    value={tierValue}
                    onChange={setTierValue}
                    autoComplete="off"
                  />
                  <Button onClick={addTier}>添加阶梯</Button>
                </InlineStack>
                {tiers.length ? (
                  <Text as="p" tone="subdued">
                    当前阶梯：
                    {tiers
                      .map((tier) => `${tier.minQty}+ → ${tier.value}`)
                      .join("；")}
                  </Text>
                ) : null}
                <Button
                  variant="primary"
                  onClick={createRule}
                  loading={fetcher.state !== "idle"}
                >
                  创建规则
                </Button>
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                已配置规则
              </Text>
              {rules.length === 0 ? (
                <Banner tone="info">
                  <p>尚未配置规则。建议为 wholesale 标签客户创建 10 件 85 折规则。</p>
                </Banner>
              ) : (
                <ResourceList
                  items={rules}
                  renderItem={(rule) => (
                    <ResourceItem
                      id={rule.id}
                      onClick={() => {}}
                      accessibilityLabel={rule.name}
                    >
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <InlineStack gap="200">
                            <Text as="span" variant="bodyMd" fontWeight="semibold">
                              {rule.name}
                            </Text>
                            <Badge tone="success">{rule.discountMode}</Badge>
                            {!rule.enabled ? (
                              <Badge tone="critical">已停用</Badge>
                            ) : null}
                          </InlineStack>
                          <Text as="p" tone="subdued">
                            标签 {rule.customerTags} · 优先级 {rule.priority} ·{" "}
                            {rule.tiers.length} 个阶梯
                          </Text>
                        </BlockStack>
                        <InlineStack gap="200">
                          <Button
                            size="slim"
                            onClick={() => {
                              const payload = new FormData();
                              payload.append("intent", "toggle");
                              payload.append("id", rule.id);
                              payload.append(
                                "enabled",
                                String(!rule.enabled),
                              );
                              fetcher.submit(payload, { method: "POST" });
                            }}
                          >
                            {rule.enabled ? "停用" : "启用"}
                          </Button>
                          <Button
                            size="slim"
                            tone="critical"
                            onClick={() => {
                              const payload = new FormData();
                              payload.append("intent", "delete");
                              payload.append("id", rule.id);
                              fetcher.submit(payload, { method: "POST" });
                            }}
                          >
                            删除
                          </Button>
                        </InlineStack>
                      </InlineStack>
                    </ResourceItem>
                  )}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
