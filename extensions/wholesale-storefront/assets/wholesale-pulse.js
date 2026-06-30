(function () {
  const PROXY_BASE = "/apps/wholesale-pulse";
  const SUPPORTED_TAGS = [
    "wholesale",
    "b2b",
    "b2b-vip",
    "reseller",
    "distributor",
    "trade",
    "vip",
    "bulk",
  ];

  let configCache = null;
  let configPromise = null;
  let cartTimer = null;

  function normalizeTags(tags) {
    return (tags || []).map((tag) => String(tag).toLowerCase());
  }

  function customerMatches(ruleTags, customerTags) {
    const required = normalizeTags(ruleTags);
    if (!required.length) return true;
    return required.some((tag) => customerTags.includes(tag));
  }

  function fetchConfig() {
    if (configCache) return Promise.resolve(configCache);
    if (configPromise) return configPromise;

    configPromise = fetch(`${PROXY_BASE}/config`, {
      credentials: "same-origin",
    })
      .then((res) => res.json())
      .then((data) => {
        configCache = data;
        return data;
      })
      .catch(() => ({}))
      .finally(() => {
        configPromise = null;
      });

    return configPromise;
  }

  function track(eventType, ruleId) {
    const body = new FormData();
    body.append("eventType", eventType);
    if (ruleId) body.append("ruleId", ruleId);
    fetch(`${PROXY_BASE}/track`, {
      method: "POST",
      body,
      credentials: "same-origin",
    }).catch(() => {});
  }

  function scopeMatches(rule, context) {
    const scopeType = rule.scopeType || "all";
    const scopeIds = rule.scopeIds || [];

    if (scopeType === "all") return true;
    if (scopeType === "variant") return scopeIds.includes(context.variantId);
    if (scopeType === "product") return scopeIds.includes(context.productId);
    if (scopeType === "collection") {
      return (context.collectionIds || []).some((id) => scopeIds.includes(id));
    }
    return false;
  }

  function pickPriceRule(rules, context, customerTags) {
    return (rules || [])
      .filter((rule) => customerMatches(rule.customerTags, customerTags))
      .filter((rule) => scopeMatches(rule, context))
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))[0];
  }

  function formatTierLabel(tier, discountMode) {
    if (discountMode === "fixed_price") {
      return `$${tier.value} / 件`;
    }
    return `${tier.value}% OFF`;
  }

  function renderTierTable(root) {
    const customerTags = normalizeTags(
      JSON.parse(root.dataset.customerTags || "[]"),
    );
    const productId = root.dataset.productId;
    const variantId = root.dataset.variantId || "";
    const collectionIds = JSON.parse(root.dataset.collectionIds || "[]");
    const heading = root.dataset.heading || "批发阶梯价";
    const isLoggedIn = root.dataset.loggedIn === "true";

    fetchConfig().then((config) => {
      if (!config.enabled || !config.showTierTable) return;

      const context = { productId, variantId, collectionIds };
      const rule = pickPriceRule(config.priceRules, context, customerTags);

      root.innerHTML = "";
      root.style.setProperty("--wholesale-header-bg", config.tableHeaderBg || "#111827");
      root.style.setProperty("--wholesale-accent", config.tableAccent || "#16a34a");

      if (!isLoggedIn) {
        const guest = document.createElement("div");
        guest.className = "wholesale-tier-table__guest";
        guest.innerHTML = `${config.guestMessage || "登录查看批发价"} · <a href="/account/login">登录</a>`;
        root.appendChild(guest);
        return;
      }

      if (!rule || !(rule.tiers || []).length) return;

      track("tier_table_view", rule.id);

      const wrapper = document.createElement("div");
      wrapper.className = "wholesale-tier-table";

      const title = document.createElement("div");
      title.className = "wholesale-tier-table__heading";
      title.textContent = heading;
      title.style.background = config.tableHeaderBg || "#111827";
      wrapper.appendChild(title);

      const table = document.createElement("table");
      table.innerHTML = `
        <thead>
          <tr>
            <th>起订数量</th>
            <th>批发优惠</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;

      const tbody = table.querySelector("tbody");
      rule.tiers
        .slice()
        .sort((a, b) => Number(a.minQty) - Number(b.minQty))
        .forEach((tier) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${tier.minQty}+ 件</td>
            <td style="color:${config.tableAccent || "#16a34a"};font-weight:600">
              ${formatTierLabel(tier, rule.discountMode)}
            </td>
          `;
          tbody.appendChild(row);
        });

      wrapper.appendChild(table);
      root.appendChild(wrapper);
    });
  }

  async function fetchCart() {
    const res = await fetch("/cart.js", { credentials: "same-origin" });
    if (!res.ok) return null;
    return res.json();
  }

  function checkMoqHints() {
    const roots = document.querySelectorAll("[data-wholesale-cart-hint]");
    if (!roots.length) return;

    roots.forEach(async (root) => {
      const customerTags = normalizeTags(
        JSON.parse(root.dataset.customerTags || "[]"),
      );
      if (!customerTags.length) return;

      const config = await fetchConfig();
      if (!config.enabled) return;

      const cart = await fetchCart();
      if (!cart) return;

      const warnings = [];
      const aggregates = {
        total: 0,
        byVariant: {},
        byProduct: {},
      };

      for (const item of cart.items || []) {
        aggregates.total += item.quantity;
        const variantKey = `gid://shopify/ProductVariant/${item.variant_id}`;
        const productKey = `gid://shopify/Product/${item.product_id}`;
        aggregates.byVariant[variantKey] =
          (aggregates.byVariant[variantKey] || 0) + item.quantity;
        aggregates.byProduct[productKey] =
          (aggregates.byProduct[productKey] || 0) + item.quantity;
      }

      for (const rule of config.moqRules || []) {
        if (!customerMatches(rule.customerTags, customerTags)) continue;
        const minQty = Number(rule.minQty || 0);
        if (minQty <= 0) continue;

        let qty = aggregates.total;
        if (rule.scopeType === "variant" && rule.scopeIds?.length) {
          qty = Math.max(
            ...rule.scopeIds.map((id) => aggregates.byVariant[id] || 0),
            0,
          );
        } else if (rule.scopeType === "product" && rule.scopeIds?.length) {
          qty = Math.max(
            ...rule.scopeIds.map((id) => aggregates.byProduct[id] || 0),
            0,
          );
        }

        if (qty > 0 && qty < minQty) {
          warnings.push(rule.message || `最少购买 ${minQty} 件`);
        }
      }

      if (!warnings.length) {
        root.classList.remove("is-visible", "is-error");
        root.textContent = "";
        return;
      }

      root.textContent = warnings.join(" · ");
      root.classList.add("is-visible", "is-error");
      track("moq_warning");
    });
  }

  function scheduleCartCheck() {
    clearTimeout(cartTimer);
    cartTimer = setTimeout(checkMoqHints, 500);
  }

  function patchFetch() {
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
      const result = originalFetch.apply(this, args);
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      if (url && /\/cart\//.test(url)) {
        result.finally(scheduleCartCheck);
      }
      return result;
    };
  }

  function init() {
    document
      .querySelectorAll("[data-wholesale-tier-table]")
      .forEach(renderTierTable);

    document.querySelectorAll("[data-wholesale-cart-hint]").forEach((root) => {
      root.classList.add("wholesale-cart-hint");
    });

    patchFetch();
    scheduleCartCheck();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
