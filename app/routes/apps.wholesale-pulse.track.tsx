import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { recordPricingEvent } from "../models/metafield-sync.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const shop = session?.shop;

  if (!shop) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const eventType = String(formData.get("eventType") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "") || undefined;

  if (
    !["tier_table_view", "moq_warning", "moq_blocked", "b2b_order"].includes(
      eventType,
    )
  ) {
    return json({ error: "Invalid event" }, { status: 400 });
  }

  await recordPricingEvent(shop, eventType, ruleId);
  return json({ ok: true });
};
