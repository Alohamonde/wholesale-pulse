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
  Checkbox,
  Banner,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useCallback, useEffect, useState } from "react";
import { authenticate } from "../shopify.server";
import {
  getOrCreateShopSettings,
  syncAll,
  updateShopSettings,
} from "../models/metafield-sync.server";
import { ensureB2bDiscount } from "../models/b2b-discount.server";
import { ensureB2bValidation } from "../models/b2b-validation.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getOrCreateShopSettings(session.shop);
  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent"));

  if (intent === "save") {
    await updateShopSettings(session.shop, {
      enabled: formData.get("enabled") === "true",
      guestMessage: String(formData.get("guestMessage") ?? "登录查看批发价"),
      showTierTable: formData.get("showTierTable") === "true",
      tableHeaderBg: String(formData.get("tableHeaderBg") ?? "#111827"),
      tableAccent: String(formData.get("tableAccent") ?? "#16a34a"),
    });
    await syncAll(admin, session.shop);
    return json({ ok: true, message: "设置已保存并同步到店面" });
  }

  if (intent === "repair") {
    const [discount, validation] = await Promise.all([
      ensureB2bDiscount(admin),
      ensureB2bValidation(admin),
    ]);
    return json({
      ok: discount.ok && validation.ok,
      message:
        discount.ok && validation.ok
          ? "已修复批发折扣与 MOQ 校验"
          : "修复失败，请查看错误后重试",
    });
  }

  return json({ ok: false }, { status: 400 });
};

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [enabled, setEnabled] = useState(settings.enabled);
  const [guestMessage, setGuestMessage] = useState(settings.guestMessage);
  const [showTierTable, setShowTierTable] = useState(settings.showTierTable);
  const [tableHeaderBg, setTableHeaderBg] = useState(settings.tableHeaderBg);
  const [tableAccent, setTableAccent] = useState(settings.tableAccent);

  const saveSettings = useCallback(() => {
    const payload = new FormData();
    payload.append("intent", "save");
    payload.append("enabled", String(enabled));
    payload.append("guestMessage", guestMessage);
    payload.append("showTierTable", String(showTierTable));
    payload.append("tableHeaderBg", tableHeaderBg);
    payload.append("tableAccent", tableAccent);
    fetcher.submit(payload, { method: "POST" });
  }, [
    enabled,
    fetcher,
    guestMessage,
    showTierTable,
    tableAccent,
    tableHeaderBg,
  ]);

  const repairExtensions = useCallback(() => {
    const payload = new FormData();
    payload.append("intent", "repair");
    fetcher.submit(payload, { method: "POST" });
  }, [fetcher]);

  useEffect(() => {
    if (fetcher.data?.message) {
      shopify.toast.show(fetcher.data.message);
    }
  }, [fetcher.data, shopify]);

  return (
    <Page title="设置" subtitle="全局开关、店面文案与扩展修复">
      <TitleBar title="设置" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                全局设置
              </Text>
              <FormLayout>
                <Checkbox
                  label="启用 Wholesale Pulse"
                  checked={enabled}
                  onChange={setEnabled}
                />
                <Checkbox
                  label="在商品页展示阶梯价表"
                  checked={showTierTable}
                  onChange={setShowTierTable}
                />
                <TextField
                  label="游客提示文案"
                  value={guestMessage}
                  onChange={setGuestMessage}
                  autoComplete="off"
                />
                <TextField
                  label="阶梯表表头背景色"
                  value={tableHeaderBg}
                  onChange={setTableHeaderBg}
                  autoComplete="off"
                />
                <TextField
                  label="阶梯表强调色"
                  value={tableAccent}
                  onChange={setTableAccent}
                  autoComplete="off"
                />
                <Button
                  variant="primary"
                  onClick={saveSettings}
                  loading={fetcher.state !== "idle"}
                >
                  保存设置
                </Button>
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                扩展维护
              </Text>
              <Banner tone="info">
                <p>
                  若批发折扣或 MOQ 校验未生效，可点击修复按钮重新创建 Shopify
                  Function 绑定。
                </p>
              </Banner>
              <Button onClick={repairExtensions}>修复折扣与 MOQ 校验</Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                店面启用步骤
              </Text>
              <Text as="p">
                1. 主题编辑器 → 商品页模板 → 添加「Wholesale tier table」区块
              </Text>
              <Text as="p">
                2. 主题编辑器 → App embeds → 启用「Wholesale cart MOQ hint」
              </Text>
              <Text as="p">
                3. 在 Shopify 后台为客户添加 wholesale 等标签并让其登录下单测试
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
