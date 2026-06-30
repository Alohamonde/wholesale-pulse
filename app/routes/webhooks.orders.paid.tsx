import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { recordPricingEvent } from "../models/metafield-sync.server";
import { SUPPORTED_CUSTOMER_TAGS } from "../constants";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  const payload = await request.json();

  console.log(`Received ${topic} webhook for ${shop}`);

  const customerTags: string[] = (payload?.customer?.tags ?? []).map(
    (tag: string) => String(tag).toLowerCase(),
  );
  const hasB2bTag = customerTags.some((tag) =>
    SUPPORTED_CUSTOMER_TAGS.includes(tag as (typeof SUPPORTED_CUSTOMER_TAGS)[number]),
  );

  const discountCodes: string[] = (payload?.discount_codes ?? []).map(
    (entry: { code?: string }) => entry.code ?? "",
  );
  const hasWholesaleDiscount = discountCodes.some((code) =>
    code.toLowerCase().includes("wholesale"),
  );

  const lineDiscounts = (payload?.line_items ?? []).some(
    (item: { discount_allocations?: unknown[] }) =>
      (item.discount_allocations?.length ?? 0) > 0,
  );

  if (hasB2bTag || hasWholesaleDiscount || lineDiscounts) {
    await recordPricingEvent(shop, "b2b_order");
  }

  return new Response();
};
