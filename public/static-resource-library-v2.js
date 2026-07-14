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
  if (!(image instanceof HTMLImageElement)) return;
  if (!item.image?.src) {
    image.hidden = true;
    image.removeAttribute("src");
    return;
  }
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
  populateImage(card, item, position);
  populateList(
    card,
    "authors",
    item.authors,
    '[data-resource-template="author"]'
  );
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
  return card;
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
  const loadMore = root.querySelector("[data-resource-load-more]");
  const clear = root.querySelector("[data-resource-clear]");
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
  const inputs = filterInputs(root);

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

  const render = () => {
    const fragment = document.createDocumentFragment();
    filteredItems.slice(0, visibleLimit).forEach((item, position) => {
      fragment.append(populateCard(cardTemplate, item, position));
    });
    results.replaceChildren(fragment);
    if (count) {
      count.textContent = `${filteredItems.length} resource${
        filteredItems.length === 1 ? "" : "s"
      }`;
    }
    if (loadMore) loadMore.hidden = visibleLimit >= filteredItems.length;
    renderChips();
    showState(filteredItems.length ? root.dataset.resourceSource : "empty");
  };

  const applyFilters = () => {
    const groups = selectedGroups();
    filteredItems = allItems.filter((item) => matchesFilters(item, groups));
    visibleLimit = settings.pageSize;
    render();
  };

  const load = async () => {
    showState("loading");
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
    }
    filteredItems = [...allItems];
    render();
  };

  document.addEventListener("change", (event) => {
    if (inputs.includes(event.target)) applyFilters();
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
    visibleLimit += settings.pageSize;
    render();
  });
  clear?.addEventListener("click", () => {
    inputs.forEach((input) => {
      input.checked = false;
    });
    applyFilters();
  });

  return { load, applyFilters, getItems: () => [...allItems] };
}

export async function initializeResourceLibraries() {
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
