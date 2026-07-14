import test from "node:test";
import assert from "node:assert/strict";
import {
  legacyIndexToV2,
  normalizeResourceItem,
  validateResourceIndex,
} from "../lib/normalize.js";

test("normalizes CMS references into authors, topics, and industries", () => {
  const collection = {
    id: "resources",
    slug: "blog",
    fields: [
      { slug: "authors", validations: { collectionId: "authors" } },
      { slug: "categories", validations: { collectionId: "subcategories" } },
    ],
  };
  const referenceById = new Map([
    ["author-1", { fieldData: { name: "Elire Marketing", slug: "elire-marketing" } }],
    ["topic-parent", { fieldData: { name: "Topic", slug: "topic" } }],
    ["industry-parent", { fieldData: { name: "Industry", slug: "industry" } }],
    [
      "topic-1",
      {
        fieldData: {
          name: "PeopleSoft",
          slug: "peoplesoft",
          "main-category": "topic-parent",
        },
      },
    ],
    [
      "industry-1",
      {
        fieldData: {
          name: "Healthcare",
          slug: "healthcare",
          "main-category": "industry-parent",
        },
      },
    ],
  ]);
  const result = normalizeResourceItem({
    item: {
      id: "post-1",
      lastPublished: "2026-07-10T12:00:00.000Z",
      fieldData: {
        name: "A resource",
        slug: "a-resource",
        "publish-date": "2026-07-09",
        summary: "Summary",
        image: { url: "https://example.com/image.jpg", alt: "Alt" },
        authors: ["author-1"],
        categories: ["topic-1", "industry-1"],
      },
    },
    collection,
    descriptor: {
      contentType: "Blog Post",
      routePrefix: "/blog",
      dateFields: ["publish-date"],
    },
    referenceById,
    collectionById: new Map([
      ["authors", { slug: "authors" }],
      ["subcategories", { slug: "blog-sub-categories" }],
    ]),
  });

  assert.equal(result.url, "/blog/a-resource");
  assert.equal(result.canonicalDate, "2026-07-09T00:00:00.000Z");
  assert.deepEqual(result.authors, ["Elire Marketing"]);
  assert.deepEqual(result.topics, ["PeopleSoft"]);
  assert.deepEqual(result.industries, ["Healthcare"]);
  assert.deepEqual(result.contentTypes, ["Blog Post"]);
});

test("detects duplicate IDs and URLs", () => {
  const item = {
    id: "same",
    sourceCollection: "blog-posts",
    contentType: "Blog Post",
    title: "Title",
    url: "/same",
    canonicalDate: "2026-07-10T00:00:00.000Z",
  };
  const validation = validateResourceIndex({
    schemaVersion: 2,
    count: 2,
    items: [item, item],
  });
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join(" "), /duplicate id/);
  assert.match(validation.errors.join(" "), /duplicate URL/);
});

test("converts the pinned legacy index without changing content order", () => {
  const converted = legacyIndexToV2({
    generated: "2026-06-17T00:00:00.000Z",
    categories: {
      peoplesoft: { n: "PeopleSoft", g: "topic" },
      healthcare: { n: "Healthcare", g: "industry" },
    },
    authors: { marketing: "Elire Marketing" },
    items: [
      {
        t: "Title",
        u: "/blog/title",
        ts: 1781154000,
        k: "Blog Post",
        c: ["peoplesoft", "healthcare"],
        a: ["marketing"],
      },
    ],
  });
  assert.equal(converted.count, 1);
  assert.equal(converted.items[0].title, "Title");
  assert.deepEqual(converted.items[0].topics, ["PeopleSoft"]);
  assert.deepEqual(converted.items[0].industries, ["Healthcare"]);
});
