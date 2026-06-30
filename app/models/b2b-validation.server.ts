const FUNCTION_HANDLE = "b2b-moq";
const VALIDATION_TITLE = "Wholesale Pulse MOQ";

const LIST_VALIDATIONS = `#graphql
  query B2bValidationList {
    validations(first: 50) {
      nodes {
        id
        title
        enabled
        blockOnFailure
        shopifyFunction {
          appKey
          id
        }
      }
    }
  }
`;

const CREATE_VALIDATION = `#graphql
  mutation B2bValidationCreate($validation: ValidationCreateInput!) {
    validationCreate(validation: $validation) {
      validation {
        id
        title
        enabled
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_VALIDATION = `#graphql
  mutation B2bValidationUpdate($id: ID!, $validation: ValidationUpdateInput!) {
    validationUpdate(id: $id, validation: $validation) {
      validation {
        id
        title
        enabled
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

function isOurValidation(validation: {
  title?: string;
  shopifyFunction?: { appKey?: string };
}) {
  if (!validation?.shopifyFunction) return false;
  const key = appKey();
  if (key && validation.shopifyFunction.appKey !== key) return false;
  return (validation.title || "").includes("Wholesale Pulse");
}

export async function getB2bValidationStatus(
  admin: Parameters<typeof safeGraphql>[0],
) {
  const result = await safeGraphql(admin, LIST_VALIDATIONS);
  if (!result.ok) {
    return { exists: false, enabled: false, id: null, errors: result.errors };
  }

  const nodes = result.data?.validations?.nodes ?? [];
  const match = nodes.find((node: { title?: string; shopifyFunction?: { appKey?: string } }) =>
    isOurValidation(node),
  );

  if (!match) {
    return { exists: false, enabled: false, id: null };
  }

  return {
    exists: true,
    enabled: Boolean(match.enabled),
    id: match.id as string,
    title: match.title as string,
  };
}

async function repairValidation(
  admin: Parameters<typeof safeGraphql>[0],
  id: string,
) {
  const result = await safeGraphql(admin, UPDATE_VALIDATION, {
    id,
    validation: {
      title: VALIDATION_TITLE,
      enable: true,
      blockOnFailure: true,
    },
  });

  if (!result.ok) return { ok: false as const, errors: result.errors };
  const userErrors = result.data?.validationUpdate?.userErrors ?? [];
  if (userErrors.length) return { ok: false as const, errors: userErrors };
  return { ok: true as const };
}

export async function ensureB2bValidation(
  admin: Parameters<typeof safeGraphql>[0],
) {
  const current = await getB2bValidationStatus(admin);
  if (current.errors?.length) {
    return { ok: false, created: false, errors: current.errors };
  }

  if (current.exists) {
    if (current.enabled) {
      return { ok: true, created: false, enabled: true };
    }

    const repaired = await repairValidation(admin, current.id!);
    if (!repaired.ok) {
      return { ok: false, created: false, errors: repaired.errors };
    }

    return { ok: true, created: false, repaired: true, enabled: true };
  }

  const createResult = await safeGraphql(admin, CREATE_VALIDATION, {
    validation: {
      title: VALIDATION_TITLE,
      functionHandle: FUNCTION_HANDLE,
      enable: true,
      blockOnFailure: true,
    },
  });

  if (!createResult.ok) {
    return { ok: false, created: false, errors: createResult.errors };
  }

  const userErrors = createResult.data?.validationCreate?.userErrors ?? [];
  if (userErrors.length) {
    return { ok: false, created: false, errors: userErrors };
  }

  return { ok: true, created: true, enabled: true };
}
