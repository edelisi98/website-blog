import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  createMobileFilterSheet,
  createResourceLibrary,
  enhanceFilterTabs,
  matchesFilters,
} from "../public/static-resource-library-v2.js";

const makeItem = (index) => ({
  id: `item-${index}`,
  sourceCollection: "blog-posts",
  contentType: "Blog Post",
  title: `Resource ${index}`,
  url: `/blog/resource-${index}`,
  canonicalDate: new Date(Date.UTC(2026, 6, 14 - (index % 10))).toISOString(),
  summary: `Summary ${index}`,
  image: { src: `https://example.com/${index}.jpg`, alt: `Image ${index}` },
  authors: ["Elire Marketing"],
  topics: [index % 2 ? "PeopleSoft" : "Oracle Cloud ERP"],
  industries: [index % 3 ? "Healthcare" : "Public Sector"],
  contentTypes: ["Blog Post"],
  pills: [
    { label: "Blog Post", group: "content-type" },
    {
      label: index % 2 ? "PeopleSoft" : "Oracle Cloud ERP",
      group: "topic",
    },
  ],
});

const markup = `
  <main data-resource-library data-resource-endpoint="/api" data-resource-fallback="/fallback">
    <input type="search" data-resource-search>
    <div data-resource-filter-group="topic">
      <label><input type="checkbox" data-resource-filter-value="PeopleSoft">PeopleSoft</label>
      <label><input type="checkbox" data-resource-filter-value="Oracle Cloud ERP">Oracle Cloud ERP</label>
    </div>
    <div data-resource-filter-group="industry">
      <label><input type="checkbox" data-resource-filter-value="Healthcare">Healthcare</label>
    </div>
    <button hidden disabled data-resource-clear>Clear</button>
    <span data-resource-count></span>
    <span data-resource-announcement></span>
    <div data-resource-active-filters></div>
    <button hidden data-resource-template="chip"><span data-resource-field="label"></span></button>
    <p data-resource-state="loading">Loading</p>
    <p hidden data-resource-state="empty">Empty</p>
    <p hidden data-resource-state="error">Error</p>
    <p hidden data-resource-state="fallback">Fallback</p>
    <button data-resource-retry>Retry</button>
    <div data-resource-results></div>
    <button data-resource-load-more>Load More</button>
    <article hidden data-resource-template="card">
      <a data-resource-field="url"><span data-resource-field="image-container"><img data-resource-field="image"></span><h2 data-resource-field="title"></h2><span data-resource-field="cta"></span></a>
      <time data-resource-field="date"></time>
      <span data-resource-field="author-separator">•</span>
      <p data-resource-field="summary"></p>
      <div data-resource-list="authors"><span hidden data-resource-template="author"><span data-resource-field="label"></span></span></div>
      <div data-resource-list="topics"><span hidden data-resource-template="pill" data-resource-pill-group="topic"><span data-resource-field="label"></span></span></div>
      <div data-resource-list="industries"><span hidden data-resource-template="pill" data-resource-pill-group="industry"><span data-resource-field="label"></span></span></div>
      <div data-resource-list="content-types"><span hidden data-resource-template="pill" data-resource-pill-group="content-type"><span data-resource-field="label"></span></span></div>
    </article>
  </main>`;

const installDomGlobals = (window) => {
  globalThis.document = window.document;
  globalThis.HTMLTemplateElement = window.HTMLTemplateElement;
  globalThis.HTMLAnchorElement = window.HTMLAnchorElement;
  globalThis.HTMLImageElement = window.HTMLImageElement;
};

test("same-group filters use OR and cross-group filters use AND", () => {
  const selected = new Map([
    ["topic", ["peoplesoft", "oracle-cloud-erp"]],
    ["industry", ["healthcare"]],
  ]);
  assert.equal(matchesFilters(makeItem(1), selected), true);
  assert.equal(matchesFilters(makeItem(3), selected), false);
});

test("exposes filter state and selected counts on Webflow tab controls", () => {
  const dom = new JSDOM(`
    <a role="tab" aria-selected="true" aria-controls="topic-panel">
      <span class="tab-content"><span>Topic</span><span class="expand">+</span></span>
    </a>
    <div id="topic-panel" role="tabpanel">
      <input type="checkbox" checked>
      <input type="checkbox">
    </div>
  `);
  const { document } = dom.window;

  enhanceFilterTabs(document);

  const tab = document.querySelector('[role="tab"]');
  assert.equal(tab.getAttribute("aria-expanded"), "true");
  assert.equal(tab.querySelector(".tab-content > :first-child").textContent, "Topic (1)");
});

test("opens mobile filters in a scrollable sheet and clears selections", async () => {
  const dom = new JSDOM(`
    <div class="blog-home_header-tabs mobile w-tabs">
      <div class="w-tab-menu">
        <a class="blog-header_tabs" data-w-tab="Topic"><span class="tab-content"><span>Topic</span><span>+</span></span></a>
        <a class="blog-header_tabs" data-w-tab="Industry"><span class="tab-content"><span>Industry</span><span>+</span></span></a>
      </div>
      <div class="w-tab-content">
        <div class="w-tab-pane w--tab-active" data-w-tab="Topic"><label><input type="checkbox" checked>PeopleSoft</label></div>
        <div class="w-tab-pane" data-w-tab="Industry"><label><input type="checkbox">Healthcare</label></div>
      </div>
    </div>
    <div data-resource-count>Showing 24 of 224 resources</div>
  `, { pretendToBeVisual: true });
  dom.window.matchMedia = () => ({ matches: true });
  const { document } = dom.window;
  const sheet = createMobileFilterSheet(document);
  const topic = document.querySelector('[data-w-tab="Topic"].blog-header_tabs');
  const mobileStyles = document.querySelector("#resource-mobile-filter-styles").textContent;

  assert.match(mobileStyles, /transform: translate\(-50%, -50%\)/);
  assert.match(mobileStyles, /flex-wrap: wrap/);

  topic.click();
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  assert.equal(
    document.querySelector(".blog-home_header-tabs.mobile").classList.contains("is-mobile-filter-open"),
    true
  );
  assert.equal(document.body.classList.contains("resource-filter-sheet-open"), true);
  assert.equal(document.querySelector("[data-resource-mobile-filter-selected]").textContent, "1 selected");
  assert.equal(document.querySelector(".resource-mobile-filter_done").textContent, "Show 224 results");

  document.querySelector(".resource-mobile-filter_clear").click();
  assert.equal(document.querySelector('input[type="checkbox"]').checked, false);
  sheet.close();
  assert.equal(document.body.classList.contains("resource-filter-sheet-open"), false);
});

test("renders 24 cards, filters, chips, clears, and loads more", async () => {
  const dom = new JSDOM(markup, { url: "https://www.elire.com/blog-home-overhaul-dev" });
  installDomGlobals(dom.window);
  dom.window.dataLayer = [];
  const items = Array.from({ length: 50 }, (_, index) => makeItem(index));
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ schemaVersion: 2, count: items.length, items }));
  const root = document.querySelector("[data-resource-library]");
  const library = createResourceLibrary(root);
  await library.load();

  assert.equal(dom.window.dataLayer[0].event, "resource_hub_loaded");
  assert.equal(dom.window.dataLayer[0].resource_count, 50);

  assert.equal(root.querySelectorAll("[data-resource-id]").length, 24);
  assert.equal(
    root.querySelector("[data-resource-count]").textContent,
    "Showing 24 of 50 resources"
  );
  assert.equal(root.querySelector("[data-resource-clear]").hidden, true);
  assert.equal(root.querySelector('[data-resource-field="date"]').textContent, "July 14, 2026");
  root.querySelector("[data-resource-load-more]").click();
  assert.equal(root.querySelectorAll("[data-resource-id]").length, 48);
  assert.equal(
    root.querySelector("[data-resource-announcement]").textContent,
    "Loaded 24 more resources. Showing 48 of 50."
  );
  assert.equal(
    dom.window.dataLayer.at(-1).event,
    "resource_hub_load_more"
  );

  const peopleSoft = root.querySelector('[data-resource-filter-value="PeopleSoft"]');
  peopleSoft.checked = true;
  peopleSoft.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.equal(
    root.querySelector("[data-resource-count]").textContent,
    "Showing 24 of 25 resources"
  );
  assert.equal(root.querySelector("[data-resource-clear]").hidden, false);
  assert.equal(root.querySelectorAll("[data-resource-filter-remove]").length, 1);
  assert.equal(
    dom.window.dataLayer.at(-1).event,
    "resource_hub_filter_change"
  );

  root.querySelector("[data-resource-clear]").click();
  assert.equal(
    root.querySelector("[data-resource-count]").textContent,
    "Showing 24 of 50 resources"
  );
  assert.equal(root.querySelector("[data-resource-clear]").hidden, true);
  assert.equal(root.querySelectorAll("[data-resource-id]").length, 24);
  assert.equal(dom.window.dataLayer.at(-1).event, "resource_hub_clear");

  const search = root.querySelector("[data-resource-search]");
  search.value = "Resource 49";
  search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  assert.equal(root.querySelectorAll("[data-resource-id]").length, 1);
  assert.equal(
    root.querySelector("[data-resource-count]").textContent,
    "Showing 1 of 1 resource"
  );
  await new Promise((resolve) => dom.window.setTimeout(resolve, 400));
  assert.equal(dom.window.dataLayer.at(-1).event, "resource_hub_search");

  const cardLink = root.querySelector(
    '[data-resource-id] a[data-resource-field="url"]'
  );
  cardLink.addEventListener("click", (event) => event.preventDefault());
  cardLink.dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true, cancelable: true })
  );
  assert.equal(dom.window.dataLayer.at(-1).event, "resource_hub_card_click");
});

test("uses contextual CTAs and hides incomplete card metadata cleanly", async () => {
  const dom = new JSDOM(markup, {
    url: "https://www.elire.com/blog-home-overhaul-dev",
  });
  installDomGlobals(dom.window);
  const podcast = {
    ...makeItem(1),
    contentType: "Podcast",
    contentTypes: ["Podcast"],
    image: null,
    authors: [],
  };
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ schemaVersion: 2, count: 1, items: [podcast] }));
  const root = document.querySelector("[data-resource-library]");
  const library = createResourceLibrary(root);
  await library.load();

  const card = root.querySelector("[data-resource-id]");
  assert.equal(card.querySelector('[data-resource-field="cta"]').textContent, "Listen to the Podcast");
  assert.equal(card.querySelector('[data-resource-field="image-container"]').hidden, true);
  assert.equal(card.querySelector('[data-resource-field="author-separator"]').hidden, true);
  assert.equal(card.querySelector('[data-resource-field="title"]').tagName, "H2");
  assert.equal(
    card.querySelector('a[data-resource-field="url"]').getAttribute("aria-labelledby"),
    card.querySelector('[data-resource-field="title"]').id
  );
});

test("restores and shares search and filter state through the URL", async () => {
  const dom = new JSDOM(markup, {
    url: "https://www.elire.com/blog-home?q=Resource+1&topic=peoplesoft",
  });
  installDomGlobals(dom.window);
  const items = [makeItem(1), makeItem(2), makeItem(11)];
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ schemaVersion: 2, count: items.length, items }));
  const root = document.querySelector("[data-resource-library]");
  const library = createResourceLibrary(root);
  await library.load();

  assert.equal(root.querySelector("[data-resource-search]").value, "Resource 1");
  assert.equal(
    root.querySelector('[data-resource-filter-value="PeopleSoft"]').checked,
    true
  );
  assert.equal(root.querySelectorAll("[data-resource-id]").length, 2);

  root.querySelector("[data-resource-clear]").click();
  assert.equal(dom.window.location.search, "");
  assert.equal(root.querySelector("[data-resource-search]").value, "");
  assert.equal(root.querySelectorAll("[data-resource-id]").length, 3);
});

test("uses the pinned fallback when the API fails", async () => {
  const dom = new JSDOM(markup, { url: "https://www.elire.com/blog-home-overhaul-dev" });
  installDomGlobals(dom.window);
  const items = [makeItem(1)];
  globalThis.fetch = async (url) => {
    if (url === "/api") throw new Error("API unavailable");
    return new Response(JSON.stringify({ schemaVersion: 2, count: 1, items }));
  };
  const root = document.querySelector("[data-resource-library]");
  const library = createResourceLibrary(root);
  await library.load();
  assert.equal(root.dataset.resourceSource, "fallback");
  assert.equal(root.querySelector('[data-resource-state="fallback"]').hidden, false);
  assert.equal(root.querySelectorAll("[data-resource-id]").length, 1);
});

test("supports the existing external Finsweet filters and Webflow chip template", async () => {
  const legacyMarkup = `
    <div>
      <div data-w-tab="Topic">
        <form fs-list-element="filters">
          <label fs-list-activeclass="is-active">
            <input type="checkbox" fs-list-value="PeopleSoft">
            <span>PeopleSoft</span>
          </label>
        </form>
      </div>
      <div data-w-tab="Topic">
        <form fs-list-element="filters">
          <label fs-list-activeclass="is-active">
            <input type="checkbox" fs-list-value="PeopleSoft">
            <span>PeopleSoft</span>
          </label>
        </form>
      </div>
      <div fs-list-element="tag" hidden>
        <span fs-list-element="tag-field">Topic</span>
        <span fs-list-element="tag-value">Value</span>
        <button fs-list-element="tag-remove" type="button">Remove</button>
      </div>
      <main data-resource-library data-resource-endpoint="/api">
        <button hidden disabled data-resource-clear>Clear</button>
        <span data-resource-count></span>
        <div data-resource-results></div>
        <button data-resource-load-more>Load More</button>
        <article hidden data-resource-template="card">
          <a data-resource-field="url"><img data-resource-field="image"><span data-resource-field="title"></span></a>
          <span data-resource-field="date"></span>
          <span data-resource-field="summary"></span>
          <div data-resource-list="authors"><span hidden data-resource-template="author"><span data-resource-field="label"></span></span></div>
          <div data-resource-list="pills">
            <span hidden data-resource-template="pill" data-resource-pill-group="content-type"><span data-resource-field="label"></span></span>
            <span hidden data-resource-template="pill" data-resource-pill-group="topic"><span data-resource-field="label"></span></span>
            <span hidden data-resource-template="pill" data-resource-pill-group="industry"><span data-resource-field="label"></span></span>
          </div>
        </article>
      </main>
    </div>`;
  const dom = new JSDOM(legacyMarkup, {
    url: "https://www.elire.com/blog-home?topic=peoplesoft",
  });
  installDomGlobals(dom.window);
  const items = [makeItem(1), makeItem(2)];
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ schemaVersion: 2, count: items.length, items }));
  const root = document.querySelector("[data-resource-library]");
  const library = createResourceLibrary(root);
  await library.load();

  const duplicateInputs = [...document.querySelectorAll('[fs-list-value="PeopleSoft"]')];
  assert.equal(duplicateInputs.every((input) => input.checked), true);
  assert.equal(
    root.querySelector("[data-resource-count]").textContent,
    "Showing 1 of 1 resource"
  );
  assert.equal(
    duplicateInputs.every((input) => input.closest("label").classList.contains("is-active")),
    true
  );
  const chip = document.querySelector('[fs-list-element="tag"]');
  assert.equal(chip.hidden, false);
  assert.equal(document.querySelectorAll('[data-resource-filter-remove]').length, 1);
  assert.equal(
    chip.querySelector('[fs-list-element="tag-value"]').textContent,
    "PeopleSoft"
  );

  chip.querySelector('[fs-list-element="tag-remove"]').click();
  assert.equal(duplicateInputs.every((input) => !input.checked), true);
  assert.equal(dom.window.location.search, "");
  assert.equal(
    root.querySelector("[data-resource-count]").textContent,
    "Showing 2 of 2 resources"
  );
});
