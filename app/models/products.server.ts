import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

export type SearchProduct = {
  id: string;
  title: string;
  imageUrl: string;
  variantId: string;
  price: string;
};

export type SearchCollection = {
  id: string;
  title: string;
  handle: string;
  imageUrl: string;
};

export async function searchProducts(admin: AdminApiContext, query: string) {
  const response = await admin.graphql(
    `#graphql
      query WholesalePulseSearchProducts($query: String!) {
        products(first: 10, query: $query) {
          edges {
            node {
              id
              title
              featuredImage {
                url
              }
              variants(first: 1) {
                edges {
                  node {
                    id
                    price
                  }
                }
              }
            }
          }
        }
      }
    `,
    { variables: { query } },
  );

  const json = await response.json();

  return (
    json.data?.products?.edges?.map(
      (edge: {
        node: {
          id: string;
          title: string;
          featuredImage?: { url: string };
          variants: { edges: { node: { id: string; price: string } }[] };
        };
      }) => ({
        id: edge.node.id,
        title: edge.node.title,
        imageUrl: edge.node.featuredImage?.url ?? "",
        variantId: edge.node.variants.edges[0]?.node.id ?? "",
        price: edge.node.variants.edges[0]?.node.price ?? "0.00",
      }),
    ) ?? []
  ) as SearchProduct[];
}

export async function searchCollections(admin: AdminApiContext, query: string) {
  const response = await admin.graphql(
    `#graphql
      query WholesalePulseSearchCollections($query: String!) {
        collections(first: 10, query: $query) {
          edges {
            node {
              id
              title
              handle
              image {
                url
              }
            }
          }
        }
      }
    `,
    { variables: { query } },
  );

  const json = await response.json();

  return (
    json.data?.collections?.edges?.map(
      (edge: {
        node: {
          id: string;
          title: string;
          handle: string;
          image?: { url: string };
        };
      }) => ({
        id: edge.node.id,
        title: edge.node.title,
        handle: edge.node.handle,
        imageUrl: edge.node.image?.url ?? "",
      }),
    ) ?? []
  ) as SearchCollection[];
}
