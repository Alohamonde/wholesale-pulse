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
import { SUPPORTED_CUSTOMER_TAGS, type ScopeType } from "../constants";
import { normalizeTags } from "../constants.server";
import {
  createMoqRule,
  deleteMoqRule,
  fetchCustomerTagSuggestions,
  getMoqRules,
  syncAll,
  toggleMoqRule,
} from "../models/metafield-sync.server";
import {
  searchProducts,
  type SearchProduct,
} from "../models/products.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [rules, tagSuggestions] = await Promise.all([
    getMoqRules(session.shop),
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

    const unsupported = customerTags.filter(
      (tag) => !SUPPORTED_CUSTOMER_TAGS.includes(tag as (typeof SUPPORTED_CUSTOMER_TAGS)[number]),
    );
    if (unsupported.length) {
      return json(
        {
          ok: false,
          message: `暂不支持标签：${unsupported.join(", ")}`,
        },
        { status: 400 },
      );
    }

    await createMoqRule(session.shop, {
      name: String(formData.get("name") ?? "MOQ 规则"),
      customerTags,
      scopeType,
      scopeIds,
      scopeTitles,
      minQty: Number(formData.get("minQty") ?? 1),
      message: String(formData.get("message") ?? "未达最低起订量"),
    });
    await syncAll(admin, session.shop);
    return json({ ok: true, message: "MOQ 规则已创建" });
  }

  if (intent === "delete") {
    await deleteMoqRule(session.shop, String(formData.get("id")));
    await syncAll(admin, session.shop);
    return json({ ok: true, message: "规则已删除" });
  }

  if (intent === "toggle") {
    await toggleMoqRule(
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
  { label: "全部商品", value: "all" },
];

export default function MoqPage() {
  const { rules, tagSuggestions } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const searchFetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [name, setName] = useState("批发 MOQ");
  const [customerTags, setCustomerTags] = useState("wholesale");
  const [scopeType, setScopeType] = useState<ScopeType>("product");
  const [minQty, setMinQty] = useState("6");
  const [message, setMessage] = useState("批发客户最少购买 6 件");
  const [productQuery, setProductQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<SearchProduct | null>(
    null,
  );

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
    payload.append("minQty", minQty);
    payload.append("message", message);
    fetcher.submit(payload, { method: "POST" });
  }, [
    customerTags,
    fetcher,
    message,
    minQty,
    name,
    scopeType,
    selectedProduct,
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
    <Page title="MOQ 规则" subtitle="为批发客户设置最低起订量并在结账时拦截">
      <TitleBar title="MOQ 规则" />
      <Layout>
        <Layout.Section>
          <Banner tone="info">
            <p>
              结账拦截由 Validation Function 执行；购物车预警由 Theme Embed 提供。
              支持标签：{SUPPORTED_CUSTOMER_TAGS.join(", ")}。
              {tagSuggestions.length
                ? ` 店铺标签：${tagSuggestions.slice(0, 8).join(", ")}`
                : ""}
            </p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                新建 MOQ 规则
              </Text>
              <FormLayout>
                <TextField
                  label="规则名称"
                  value={name}
                  onChange={setName}
                  autoComplete="off"
                />
                <TextField
                  label="客户标签"
                  value={customerTags}
                  onChange={setCustomerTags}
                  autoComplete="off"
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
                <TextField
                  label="最低起订量"
                  type="number"
                  value={minQty}
                  onChange={setMinQty}
                  autoComplete="off"
                />
                <TextField
                  label="拦截提示文案"
                  value={message}
                  onChange={setMessage}
                  autoComplete="off"
                />
                <Button
                  variant="primary"
                  onClick={createRule}
                  loading={fetcher.state !== "idle"}
                >
                  创建 MOQ 规则
                </Button>
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                已配置 MOQ
              </Text>
              {rules.length === 0 ? (
                <Banner tone="info">
                  <p>尚未配置 MOQ。建议为 wholesale 客户设置单商品最少 6 件。</p>
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
                            <Badge>MOQ {rule.minQty}</Badge>
                            {!rule.enabled ? (
                              <Badge tone="critical">已停用</Badge>
                            ) : null}
                          </InlineStack>
                          <Text as="p" tone="subdued">
                            标签 {rule.customerTags} · {rule.message}
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
