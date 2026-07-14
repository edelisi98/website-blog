import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  createResourceLibrary,
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
    <div data-resource-filter-group="topic">
      <label><input type="checkbox" data-resource-filter-value="PeopleSoft">PeopleSoft</label>
      <label><input type="checkbox" data-resource-filter-value="Oracle Cloud ERP">Oracle Cloud ERP</label>
    </div>
    <div data-resource-filter-group="industry">
      <label><input type="checkbox" data-resource-filter-value="Healthcare">Healthcare</label>
    </div>
    <button data-resource-clear>Clear</button>
    <span data-resource-count></span>
    <div data-resource-active-filters></div>
    <button hidden data-resource-template="chip"><span data-resource-field="label"></span></button>
    <p data-resource-state="loading">Loading</p>
    <p hidden data-resource-state="empty">Empty</p>
    <p hidden data-resource-state="error">Error</p>
    <p hidden data-resource-state="fallback">Fallback</p>
    <div data-resource-results></div>
    <button data-resource-load-more>Load More</button>
    <article hidden data-resource-template="card">
      <a data-resource-field="url"><img data-resource-field="image"><h2 data-resource-field="title"></h2></a>
      <time data-resource-field="date"></time>
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

test("renders 24 cards, filters, chips, clears, and loads more", async () => {
  const dom = new JSDOM(markup, { url: "https://www.elire.com/blog-home-overhaul-dev" });
  installDomGlobals(dom.window);
  const items = Array.from({ length: 50 }, (_, index) => makeItem(index));
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ schemaVersion: 2, count: items.length, items }));
  const root = document.querySelector("[data-resource-library]");
  const library = createResourceLibrary(root);
  await library.load();

  assert.equal(root.querySelectorAll("[data-resource-id]").length, 24);
  assert.equal(root.querySelector("[data-resource-count]").textContent, "50 resources");
  root.querySelector("[data-resource-load-more]").click();
  assert.equal(root.querySelectorAll("[data-resource-id]").length, 48);

  const peopleSoft = root.querySelector('[data-resource-filter-value="PeopleSoft"]');
  peopleSoft.checked = true;
  peopleSoft.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.equal(root.querySelector("[data-resource-count]").textContent, "25 resources");
  assert.equal(root.querySelectorAll("[data-resource-filter-remove]").length, 1);

  root.querySelector("[data-resource-clear]").click();
  assert.equal(root.querySelector("[data-resource-count]").textContent, "50 resources");
  assert.equal(root.querySelectorAll("[data-resource-id]").length, 24);
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
      <form fs-list-element="filters">
        <label fs-list-activeclass="is-active">
          <input type="checkbox" fs-list-value="PeopleSoft">
          <span>PeopleSoft</span>
        </label>
      </form>
      <div fs-list-element="tag" hidden>
        <span fs-list-element="tag-field">Topic</span>
        <span fs-list-element="tag-value">Value</span>
        <button fs-list-element="tag-remove" type="button">Remove</button>
      </div>
      <main data-resource-library data-resource-endpoint="/api">
        <button data-resource-clear>Clear</button>
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
    url: "https://www.elire.com/blog-home-overhaul-dev",
  });
  installDomGlobals(dom.window);
  const items = [makeItem(1), makeItem(2)];
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ schemaVersion: 2, count: items.length, items }));
  const root = document.querySelector("[data-resource-library]");
  const library = createResourceLibrary(root);
  await library.load();

  const input = document.querySelector('[fs-list-value="PeopleSoft"]');
  input.checked = true;
  input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.equal(root.querySelector("[data-resource-count]").textContent, "1 resource");
  assert.equal(input.closest("label").classList.contains("is-active"), true);
  const chip = document.querySelector('[fs-list-element="tag"]');
  assert.equal(chip.hidden, false);
  assert.equal(
    chip.querySelector('[fs-list-element="tag-value"]').textContent,
    "PeopleSoft"
  );

  chip.querySelector('[fs-list-element="tag-remove"]').click();
  assert.equal(input.checked, false);
  assert.equal(root.querySelector("[data-resource-count]").textContent, "2 resources");
});
