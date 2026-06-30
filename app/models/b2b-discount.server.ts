const FUNCTION_HANDLE = "b2b-pricing";
const DISCOUNT_TITLE = "Wholesale Pulse B2B Pricing";

const LIST_DISCOUNTS = `#graphql
  query B2bDiscountList {
    automaticDiscountNodes(first: 50) {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticApp {
            title
            status
            startsAt
            endsAt
            appDiscountType {
              appKey
              functionId
            }
          }
        }
      }
    }
  }
`;

const CREATE_DISCOUNT = `#graphql
  mutation B2bDiscountCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
    discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
      automaticAppDiscount {
        discountId
        title
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_DISCOUNT = `#graphql
  mutation B2bDiscountUpdate($id: ID!, $automaticAppDiscount: DiscountAutomaticAppInput!) {
    discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $automaticAppDiscount) {
      automaticAppDiscount {
        discountId
        title
        status
        endsAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

function appKey() {
  return process.env.SHOPIFY_API_KEY || "";
}

async function safeGraphql(
  admin: {
    graphql: (
      query: string,
      options?: { variables?: Record<string, unknown> },
    ) => Promise<Response>;
  },
  query: string,
  variables?: Record<string, unknown>,
) {
  try {
    const res = await admin.graphql(query, variables ? { variables } : undefined);
    const payload = await res.json();
    if (payload.errors?.length) {
      return {
        ok: false as const,
        errors: payload.errors.map((e: { message: string }) => ({ message: e.message })),
      };
    }
    return { ok: true as const, data: payload.data };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "GraphQL request failed";
    return { ok: false as const, errors: [{ message }] };
  }
}

function isOurDiscount(discount: {
  title?: string;
  appDiscountType?: { appKey?: string };
}) {
  if (!discount?.appDiscountType) return false;
  const key = appKey();
  if (key && discount.appDiscountType.appKey !== key) return false;
  return (discount.title || "").includes("Wholesale Pulse");
}

export async function getB2bDiscountStatus(
  admin: Parameters<typeof safeGraphql>[0],
) {
  const result = await safeGraphql(admin, LIST_DISCOUNTS);
  if (!result.ok) {
    return { exists: false, status: null, id: null, errors: result.errors };
  }

  const nodes = result.data?.automaticDiscountNodes?.nodes ?? [];
  const match = nodes.find((node: { automaticDiscount: unknown }) =>
    isOurDiscount(
      node.automaticDiscount as {
        title?: string;
        appDiscountType?: { appKey?: string };
      },
    ),
  );

  if (!match) {
    return { exists: false, status: null, id: null };
  }

  const discount = match.automaticDiscount as {
    status?: string;
    title?: string;
    endsAt?: string | null;
  };

  return {
    exists: true,
    status: discount?.status ?? null,
    id: match.id as string,
    title: discount?.title ?? DISCOUNT_TITLE,
    endsAt: discount?.endsAt ?? null,
  };
}

async function repairDiscount(
  admin: Parameters<typeof safeGraphql>[0],
  id: string,
) {
  const result = await safeGraphql(admin, UPDATE_DISCOUNT, {
    id,
    automaticAppDiscount: {
      title: DISCOUNT_TITLE,
      functionHandle: FUNCTION_HANDLE,
      startsAt: new Date().toISOString(),
      endsAt: null,
      discountClasses: ["PRODUCT"],
      combinesWith: {
        orderDiscounts: true,
        productDiscounts: false,
        shippingDiscounts: true,
      },
    },
  });

  if (!result.ok) return { ok: false as const, errors: result.errors };
  const userErrors = result.data?.discountAutomaticAppUpdate?.userErrors ?? [];
  if (userErrors.length) return { ok: false as const, errors: userErrors };
  return { ok: true as const };
}

export async function ensureB2bDiscount(
  admin: Parameters<typeof safeGraphql>[0],
) {
  const current = await getB2bDiscountStatus(admin);
  if (current.errors?.length) {
    return { ok: false, created: false, errors: current.errors };
  }

  if (current.exists) {
    if (current.status === "ACTIVE" && !current.endsAt) {
      return { ok: true, created: false, status: current.status };
    }

    const repaired = await repairDiscount(admin, current.id!);
    if (!repaired.ok) {
      return { ok: false, created: false, errors: repaired.errors };
    }

    const after = await getB2bDiscountStatus(admin);
    return { ok: true, created: false, repaired: true, status: after.status };
  }

  const createResult = await safeGraphql(admin, CREATE_DISCOUNT, {
    automaticAppDiscount: {
      title: DISCOUNT_TITLE,
      functionHandle: FUNCTION_HANDLE,
      startsAt: new Date().toISOString(),
      discountClasses: ["PRODUCT"],
      combinesWith: {
        orderDiscounts: true,
        productDiscounts: false,
        shippingDiscounts: true,
      },
    },
  });

  if (!createResult.ok) {
    return { ok: false, created: false, errors: createResult.errors };
  }

  const userErrors =
    createResult.data?.discountAutomaticAppCreate?.userErrors ?? [];
  if (userErrors.length) {
    return { ok: false, created: false, errors: userErrors };
  }

  const created =
    createResult.data?.discountAutomaticAppCreate?.automaticAppDiscount;
  return { ok: true, created: true, status: created?.status ?? "ACTIVE" };
}
