const DEFAULTS = {
  pageSize: 24,
  timeoutMs: 8000,
};

export const normalizeFilterValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const CTA_BY_CONTENT_TYPE = new Map([
  ["blog-post", "Read the Blog Post"],
  ["podcast", "Listen to the Podcast"],
  ["webinar", "Watch the Webinar"],
  ["demo", "View the Demo"],
  ["success-story", "Read the Success Story"],
  ["case-study", "Read the Case Study"],
  ["press-release", "Read the Press Release"],
  ["infographic", "View the Infographic"],
  ["ebook", "View the eBook"],
  ["white-paper", "Read the White Paper"],
]);

export const ctaForContentType = (contentType) =>
  CTA_BY_CONTENT_TYPE.get(normalizeFilterValue(contentType)) || "View Resource";

const trackResourceEvent = (view, action, details = {}) => {
  if (!view) return;
  const payload = {
    event: `resource_hub_${action}`,
    resource_hub_action: action,
    ...details,
  };
  try {
    view.dispatchEvent(
      new view.CustomEvent("elire:resource-hub", { detail: payload })
    );
    if (Array.isArray(view.dataLayer)) view.dataLayer.push(payload);
  } catch {
    // Analytics must never interrupt browsing or filtering.
  }
};

export function enhanceFilterTabs(doc = document) {
  const tabs = [...doc.querySelectorAll('[role="tab"][aria-controls]')];
  const MutationObserverImpl = doc.defaultView?.MutationObserver;
  if (!tabs.length) return { sync: () => {} };

  const sync = () => {
    for (const tab of tabs) {
      const selected = tab.getAttribute("aria-selected") === "true";
      tab.setAttribute("aria-expanded", String(selected));
      const panel = doc.getElementById(tab.getAttribute("aria-controls"));
      const label = tab.querySelector(".tab-content > :first-child");
      if (!label) continue;
      const baseLabel =
        tab.dataset.resourceBaseLabel || label.textContent.trim();
      tab.dataset.resourceBaseLabel = baseLabel;
      const count = panel?.querySelectorAll('input[type="checkbox"]:checked').length || 0;
      label.textContent = count ? `${baseLabel} (${count})` : baseLabel;
    }
  };

  sync();
  doc.addEventListener("change", (event) => {
    if (event.target.matches?.('input[type="checkbox"]')) sync();
  });
  if (MutationObserverImpl) {
    const observer = new MutationObserverImpl(sync);
    tabs.forEach((tab) =>
      observer.observe(tab, {
        attributes: true,
        attributeFilter: ["aria-selected"],
      })
    );
  }
  return { sync };
}

export const validateIndex = (index) =>
  index?.schemaVersion === 2 &&
  Number.isInteger(index.count) &&
  Array.isArray(index.items) &&
  index.count === index.items.length &&
  index.items.every(
    (item) =>
      item.id && item.title && item.url && item.canonicalDate && item.contentType
  );

export function matchesFilters(item, selectedGroups) {
  if (!selectedGroups.size) return true;
  const values = new Set(
    [
      ...(item.topics || []),
      ...(item.industries || []),
      ...(item.contentTypes || []),
    ].map(normalizeFilterValue)
  );
  return [...selectedGroups.values()].every((selected) =>
    selected.some((value) => values.has(value))
  );
}

const fetchJson = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Resource request failed: ${response.status}`);
    const index = await response.json();
    if (!validateIndex(index)) throw new Error("Resource response has an invalid schema.");
    return index;
  } finally {
    clearTimeout(timeout);
  }
};

const cloneTemplate = (template) => {
  if (!template) return null;
  const clone =
    template instanceof HTMLTemplateElement
      ? template.content.firstElementChild?.cloneNode(true)
      : template.cloneNode(true);
  if (!clone) return null;
  clone.removeAttribute("data-resource-template");
  clone.removeAttribute("hidden");
  clone.hidden = false;
  return clone;
};

const allIncludingSelf = (root, selector) => [
  ...(root.matches?.(selector) ? [root] : []),
  ...root.querySelectorAll(selector),
];

const setText = (root, field, value) => {
  allIncludingSelf(root, `[data-resource-field="${field}"]`).forEach((element) => {
    element.textContent = value || "";
  });
};

const setLink = (root, url) => {
  allIncludingSelf(root, '[data-resource-field="url"]').forEach((element) => {
    if (element instanceof HTMLAnchorElement) element.href = url;
  });
};

const formatDate = (isoDate) =>
  new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoDate));

const populateImage = (card, item, position) => {
  const image = card.querySelector('[data-resource-field="image"]');
  const container = card.querySelector(
    '[data-resource-field="image-container"]'
  );
  if (!(image instanceof HTMLImageElement)) return;
  if (!item.image?.src) {
    image.hidden = true;
    image.removeAttribute("src");
    if (container) container.hidden = true;
    return;
  }
  image.hidden = false;
  if (container) container.hidden = false;
  image.src = item.image.src;
  image.alt = item.image.alt || item.title;
  image.decoding = "async";
  image.loading = position < 3 ? "eager" : "lazy";
  if (position < 3) image.fetchPriority = "high";
  if (item.image.srcset) image.srcset = item.image.srcset;
  if (item.image.sizes) image.sizes = item.image.sizes;
};

const populateList = (card, listName, values, templateSelector) => {
  const list = card.querySelector(`[data-resource-list="${listName}"]`);
  if (!list) return;
  const template = list.querySelector(templateSelector);
  const fragment = document.createDocumentFragment();
  for (const value of values || []) {
    const entry = cloneTemplate(template);
    if (!entry) continue;
    setText(entry, "label", value);
    fragment.append(entry);
  }
  const hasEntries = fragment.childNodes.length > 0;
  list.replaceChildren(fragment);
  list.hidden = !hasEntries;
};

const populatePills = (card, item) => {
  const list = card.querySelector('[data-resource-list="pills"]');
  if (!list) return false;
  const pills = Array.isArray(item.pills)
    ? item.pills
    : [
        ...(item.contentTypes || []).map((label) => ({
          label,
          group: "content-type",
        })),
        ...(item.topics || []).map((label) => ({ label, group: "topic" })),
        ...(item.industries || []).map((label) => ({
          label,
          group: "industry",
        })),
      ];
  const templates = new Map(
    [...list.querySelectorAll('[data-resource-template="pill"]')].map(
      (template) => [template.dataset.resourcePillGroup, template]
    )
  );
  const fragment = document.createDocumentFragment();
  for (const pill of pills.slice(0, 4)) {
    const entry = cloneTemplate(templates.get(pill.group));
    if (!entry) continue;
    setText(entry, "label", pill.label);
    fragment.append(entry);
  }
  list.replaceChildren(fragment);
  list.hidden = !list.childElementCount;
  return true;
};

const populateCard = (template, item, position) => {
  const card = cloneTemplate(template);
  if (!card) throw new Error("The Webflow card template could not be cloned.");
  card.dataset.resourceId = item.id;
  setLink(card, item.url);
  setText(card, "title", item.title);
  setText(card, "date", formatDate(item.canonicalDate));
  setText(card, "summary", item.summary);
  setText(card, "cta", ctaForContentType(item.contentType));
  populateImage(card, item, position);
  populateList(
    card,
    "authors",
    item.authors,
    '[data-resource-template="author"]'
  );
  const authorSeparator = card.querySelector(
    '[data-resource-field="author-separator"]'
  );
  if (authorSeparator) authorSeparator.hidden = !item.authors?.length;
  if (!populatePills(card, item)) {
    populateList(
      card,
      "topics",
      item.topics,
      '[data-resource-template="pill"][data-resource-pill-group="topic"]'
    );
    populateList(
      card,
      "industries",
      item.industries,
      '[data-resource-template="pill"][data-resource-pill-group="industry"]'
    );
    populateList(
      card,
      "content-types",
      item.contentTypes,
      '[data-resource-template="pill"][data-resource-pill-group="content-type"]'
    );
  }
  const title = card.querySelector('[data-resource-field="title"]');
  const link = card.querySelector('a[data-resource-field="url"]');
  if (title && link) {
    title.id = `resource-card-title-${String(item.id).replace(
      /[^a-zA-Z0-9_-]/g,
      "-"
    )}`;
    link.setAttribute("aria-labelledby", title.id);
  }
  return card;
};

const matchesQuery = (item, query) => {
  if (!query) return true;
  const searchable = [
    item.title,
    item.summary,
    ...(item.authors || []),
    ...(item.topics || []),
    ...(item.industries || []),
    ...(item.contentTypes || []),
  ]
    .join(" ")
    .toLocaleLowerCase();
  return searchable.includes(query);
};

const filterInputs = (root) => {
  const selector =
    '[data-resource-filter-group] input[type="checkbox"][data-resource-filter-value], [fs-list-element="filters"] input[type="checkbox"][fs-list-value]';
  const local = [...root.querySelectorAll(selector)];
  return local.length ? local : [...document.querySelectorAll(selector)];
};

const filterGroup = (input) =>
  input.closest("[data-resource-filter-group]")?.dataset.resourceFilterGroup ||
  input.closest("[data-w-tab]")?.getAttribute("data-w-tab") ||
  "filters";

const filterValue = (input) =>
  normalizeFilterValue(
    input.dataset.resourceFilterValue || input.getAttribute("fs-list-value") || input.value
  );

const filterLabel = (input) =>
  input.dataset.resourceFilterLabel ||
  input.getAttribute("fs-list-value") ||
  input.closest("label")?.textContent?.trim() ||
  input.value;

export function createResourceLibrary(root, options = {}) {
  const settings = { ...DEFAULTS, ...options };
  const results = root.querySelector("[data-resource-results]");
  const cardTemplate = root.querySelector('[data-resource-template="card"]');
  const chipTemplate = root.querySelector('[data-resource-template="chip"]');
  const chips = root.querySelector("[data-resource-active-filters]");
  const count = root.querySelector("[data-resource-count]");
  const announcement = root.querySelector("[data-resource-announcement]");
  const loadMore = root.querySelector("[data-resource-load-more]");
  const clear = root.querySelector("[data-resource-clear]");
  const search = root.querySelector("[data-resource-search]");
  const retry = root.querySelector("[data-resource-retry]");
  const loading = root.querySelector('[data-resource-state="loading"]');
  const empty = root.querySelector('[data-resource-state="empty"]');
  const error = root.querySelector('[data-resource-state="error"]');
  const fallback = root.querySelector('[data-resource-state="fallback"]');
  if (!results || !cardTemplate) {
    throw new Error("The Webflow resource results and card template are required.");
  }

  let allItems = [];
  let filteredItems = [];
  let visibleLimit = settings.pageSize;
  let query = "";
  let searchTrackingTimeout;
  const inputs = filterInputs(root);
  const view = root.ownerDocument.defaultView;
  const syncUrl = options.syncUrl !== false && view?.history && view?.location;

  if (syncUrl) {
    const params = new URLSearchParams(view.location.search);
    query = (params.get("q") || "").trim().toLocaleLowerCase();
    if (search) search.value = params.get("q") || "";
    for (const input of inputs) {
      const group = normalizeFilterValue(filterGroup(input));
      input.checked = params.getAll(group).includes(filterValue(input));
    }
  }

  const updateUrl = () => {
    if (!syncUrl) return;
    const url = new URL(view.location.href);
    ["q", "topic", "industry", "content-type", "filters"].forEach((key) =>
      url.searchParams.delete(key)
    );
    const visibleQuery = search?.value.trim() || "";
    if (visibleQuery) url.searchParams.set("q", visibleQuery);
    for (const input of inputs) {
      if (!input.checked) continue;
      url.searchParams.append(
        normalizeFilterValue(filterGroup(input)),
        filterValue(input)
      );
    }
    view.history.replaceState({}, "", url);
  };

  const setInputActiveStates = () => {
    for (const input of inputs) {
      const label = input.closest("label");
      const activeClass =
        input.getAttribute("fs-list-activeclass") ||
        label?.getAttribute("fs-list-activeclass") ||
        "is-active";
      label?.classList.toggle(activeClass, input.checked);
    }
  };

  const renderFinsweetChips = () => {
    const template = document.querySelector('[fs-list-element="tag"]');
    if (!template) return false;
    template.parentElement
      ?.querySelectorAll("[data-resource-cloned-filter-tag]")
      .forEach((tag) => tag.remove());
    const selected = inputs.filter((input) => input.checked);
    if (!selected.length) {
      template.hidden = true;
      return true;
    }
    selected.forEach((input, index) => {
      const chip = index === 0 ? template : template.cloneNode(true);
      if (index > 0) {
        chip.setAttribute("data-resource-cloned-filter-tag", "");
        template.parentElement?.append(chip);
      }
      chip.hidden = false;
      chip.style.display = "";
      chip.dataset.resourceFilterRemove = filterValue(input);
      chip.dataset.resourceFilterGroup = filterGroup(input);
      chip.setAttribute("role", "button");
      chip.setAttribute("tabindex", "0");
      chip.setAttribute("aria-label", `Remove ${filterLabel(input)} filter`);
      const field = chip.querySelector('[fs-list-element="tag-field"]');
      if (field) field.hidden = true;
      const value = chip.querySelector('[fs-list-element="tag-value"]');
      if (value) value.textContent = filterLabel(input);
    });
    return true;
  };

  const showState = (name) => {
    if (loading) loading.hidden = name !== "loading";
    if (empty) empty.hidden = name !== "empty";
    if (error) error.hidden = name !== "error";
    if (fallback) fallback.hidden = name !== "fallback";
  };

  const selectedGroups = () => {
    const groups = new Map();
    for (const input of inputs) {
      if (!input.checked) continue;
      const group = filterGroup(input);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(filterValue(input));
    }
    return groups;
  };

  const renderChips = () => {
    setInputActiveStates();
    if (!chipTemplate && renderFinsweetChips()) return;
    if (!chips || !chipTemplate) return;
    const fragment = document.createDocumentFragment();
    for (const input of inputs.filter((candidate) => candidate.checked)) {
      const chip = cloneTemplate(chipTemplate);
      if (!chip) continue;
      chip.dataset.resourceFilterRemove = filterValue(input);
      chip.dataset.resourceFilterGroup = filterGroup(input);
      chip.setAttribute("aria-label", `Remove ${filterLabel(input)} filter`);
      setText(chip, "label", filterLabel(input));
      fragment.append(chip);
    }
    chips.replaceChildren(fragment);
    chips.hidden = !chips.childElementCount;
  };

  const selectedInputCount = () =>
    inputs.reduce((total, input) => total + Number(input.checked), 0);

  const render = ({ previousShown = null } = {}) => {
    const fragment = document.createDocumentFragment();
    filteredItems.slice(0, visibleLimit).forEach((item, position) => {
      fragment.append(populateCard(cardTemplate, item, position));
    });
    results.replaceChildren(fragment);
    results.hidden = false;
    const shown = Math.min(visibleLimit, filteredItems.length);
    if (count) {
      count.textContent = `Showing ${shown} of ${filteredItems.length} resource${
        filteredItems.length === 1 ? "" : "s"
      }`;
    }
    if (loadMore) loadMore.hidden = visibleLimit >= filteredItems.length;
    if (clear) {
      const hasActiveControls = selectedInputCount() > 0 || Boolean(query);
      clear.hidden = !hasActiveControls;
      clear.disabled = !hasActiveControls;
    }
    if (empty) {
      const visibleQuery = search?.value.trim();
      empty.textContent = visibleQuery
        ? `No resources match “${visibleQuery}”. Clear search or filters and try again.`
        : "No resources match your selected filters.";
    }
    renderChips();
    showState(filteredItems.length ? root.dataset.resourceSource : "empty");
    if (announcement && previousShown !== null && shown > previousShown) {
      const loaded = shown - previousShown;
      announcement.textContent = `Loaded ${loaded} more resource${
        loaded === 1 ? "" : "s"
      }. Showing ${shown} of ${filteredItems.length}.`;
    }
  };

  const applyFilters = () => {
    const groups = selectedGroups();
    filteredItems = allItems.filter(
      (item) => matchesFilters(item, groups) && matchesQuery(item, query)
    );
    visibleLimit = settings.pageSize;
    updateUrl();
    render();
  };

  const trackZeroResults = (source) => {
    if (filteredItems.length) return;
    trackResourceEvent(view, "zero_results", {
      source,
      query: search?.value.trim() || "",
      selected_filter_count: selectedInputCount(),
    });
  };

  const load = async () => {
    showState("loading");
    results.hidden = true;
    if (clear) clear.disabled = true;
    const endpoint = options.endpoint || root.dataset.resourceEndpoint;
    const fallbackUrl = options.fallbackUrl || root.dataset.resourceFallback;
    try {
      const index = await fetchJson(endpoint, settings.timeoutMs);
      allItems = index.items;
      root.dataset.resourceSource = "kv";
    } catch (primaryError) {
      if (!fallbackUrl) throw primaryError;
      const index = await fetchJson(fallbackUrl, settings.timeoutMs);
      allItems = index.items;
      root.dataset.resourceSource = "fallback";
      trackResourceEvent(view, "fallback_used", {
        resource_count: allItems.length,
      });
    }
    const groups = selectedGroups();
    filteredItems = allItems.filter(
      (item) => matchesFilters(item, groups) && matchesQuery(item, query)
    );
    render();
    trackResourceEvent(view, "loaded", {
      source: root.dataset.resourceSource,
      resource_count: allItems.length,
      result_count: filteredItems.length,
    });
    trackZeroResults("initial_state");
  };

  document.addEventListener("change", (event) => {
    if (!inputs.includes(event.target)) return;
    applyFilters();
    trackResourceEvent(view, "filter_change", {
      filter_group: normalizeFilterValue(filterGroup(event.target)),
      filter_value: filterValue(event.target),
      checked: event.target.checked,
      selected_filter_count: selectedInputCount(),
      result_count: filteredItems.length,
    });
    trackZeroResults("filter");
  });
  const removeFilterFromChip = (event) => {
    const chip = event.target.closest("[data-resource-filter-remove]");
    if (!chip) return;
    event.preventDefault();
    event.stopPropagation();
    const input = inputs.find(
      (candidate) =>
        filterGroup(candidate) === chip.dataset.resourceFilterGroup &&
        filterValue(candidate) === chip.dataset.resourceFilterRemove
    );
    if (input) {
      input.checked = false;
      applyFilters();
      trackResourceEvent(view, "filter_change", {
        filter_group: normalizeFilterValue(filterGroup(input)),
        filter_value: filterValue(input),
        checked: false,
        selected_filter_count: selectedInputCount(),
        result_count: filteredItems.length,
        source: "active_filter_chip",
      });
      input.focus();
    }
  };
  root.addEventListener("click", removeFilterFromChip);
  document.addEventListener("click", removeFilterFromChip);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (!event.target.closest?.("[data-resource-filter-remove]")) return;
    removeFilterFromChip(event);
  });
  loadMore?.addEventListener("click", () => {
    const previousShown = Math.min(visibleLimit, filteredItems.length);
    visibleLimit += settings.pageSize;
    render({ previousShown });
    trackResourceEvent(view, "load_more", {
      previous_shown: previousShown,
      shown: Math.min(visibleLimit, filteredItems.length),
      result_count: filteredItems.length,
    });
  });
  clear?.addEventListener("click", () => {
    const clearedFilterCount = selectedInputCount();
    const clearedQuery = search?.value.trim() || "";
    inputs.forEach((input) => {
      input.checked = false;
    });
    query = "";
    if (search) search.value = "";
    applyFilters();
    trackResourceEvent(view, "clear", {
      cleared_filter_count: clearedFilterCount,
      had_search: Boolean(clearedQuery),
      result_count: filteredItems.length,
    });
  });
  search?.addEventListener("input", () => {
    query = search.value.trim().toLocaleLowerCase();
    applyFilters();
    view?.clearTimeout(searchTrackingTimeout);
    searchTrackingTimeout = view?.setTimeout(() => {
      if (!query) return;
      trackResourceEvent(view, "search", {
        query: search.value.trim(),
        result_count: filteredItems.length,
        selected_filter_count: selectedInputCount(),
      });
      trackZeroResults("search");
    }, 350);
  });
  root.addEventListener("click", (event) => {
    const link = event.target.closest?.(
      '[data-resource-id] a[data-resource-field="url"]'
    );
    if (!link) return;
    const card = link.closest("[data-resource-id]");
    const item = allItems.find(
      (candidate) => String(candidate.id) === card?.dataset.resourceId
    );
    if (!item) return;
    trackResourceEvent(view, "card_click", {
      resource_id: item.id,
      resource_title: item.title,
      content_type: item.contentType,
      position: [...results.querySelectorAll("[data-resource-id]")].indexOf(card) + 1,
    });
  });
  retry?.addEventListener("click", () => {
    load().catch((error) => {
      console.error("The Elire resource library could not load.", error);
      showState("error");
      results.hidden = true;
      if (count) count.textContent = "Resources unavailable";
    });
  });

  return { load, applyFilters, getItems: () => [...allItems] };
}

export async function initializeResourceLibraries() {
  enhanceFilterTabs(document);
  const roots = [...document.querySelectorAll("[data-resource-library]")];
  await Promise.all(
    roots.map(async (root) => {
      try {
        const library = createResourceLibrary(root);
        await library.load();
      } catch (error) {
        console.error("The Elire resource library could not load.", error);
        root.querySelectorAll("[data-resource-state]").forEach((state) => {
          state.hidden = state.dataset.resourceState !== "error";
        });
        const count = root.querySelector("[data-resource-count]");
        if (count) count.textContent = "Resources unavailable";
      }
    })
  );
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeResourceLibraries, {
      once: true,
    });
  } else {
    initializeResourceLibraries();
  }
}
