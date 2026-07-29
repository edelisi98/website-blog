import test from "node:test";
import assert from "node:assert/strict";
import {
  RESOURCE_CARD_SIZES,
  enrichResponsiveImages,
  readRasterDimensions,
} from "../lib/image-variants.js";

const pngHeader = (width, height) => {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
};

test("reads PNG dimensions from a ranged response", () => {
  assert.deepEqual(readRasterDimensions(pngHeader(1200, 675)), {
    width: 1200,
    height: 675,
  });
});

test("enriches Webflow image records with verified responsive candidates", async () => {
  const src =
    "https://cdn.prod.website-files.com/site/image%20name.png";
  const items = [
    { image: { src, alt: "One", srcset: null, sizes: null } },
    { image: { src, alt: "Two", srcset: null, sizes: null } },
  ];
  let calls = 0;
  const fetchImpl = async (_url, options) => {
    calls += 1;
    assert.equal(options.headers.Range, "bytes=0-65535");
    return new Response(pngHeader(1200, 675), { status: 206 });
  };

  const result = await enrichResponsiveImages(items, { fetchImpl });

  assert.equal(calls, 1);
  assert.deepEqual(result, { enriched: 2, reused: 0, failures: [] });
  assert.match(items[0].image.srcset, /image%20name-p-500\.png 500w/);
  assert.match(items[0].image.srcset, /image%20name-p-1080\.png 1080w/);
  assert.match(items[0].image.srcset, /image%20name\.png 1200w$/);
  assert.equal(items[0].image.sizes, RESOURCE_CARD_SIZES);
  assert.equal(items[0].image.width, 1200);
  assert.equal(items[0].image.height, 675);
  assert.equal(items[1].image.srcset, items[0].image.srcset);
});

test("reuses stored dimensions without fetching unchanged images", async () => {
  const src = "https://cdn.prod.website-files.com/site/cached-image.jpg";
  const items = [{ image: { src, alt: "Current" } }];
  const cachedItems = [
    { image: { src, width: 1600, height: 900, alt: "Previous" } },
  ];

  const result = await enrichResponsiveImages(items, {
    cachedItems,
    fetchImpl: async () => {
      throw new Error("Unchanged images should not be fetched.");
    },
  });

  assert.deepEqual(result, { enriched: 0, reused: 1, failures: [] });
  assert.equal(items[0].image.width, 1600);
  assert.equal(items[0].image.height, 900);
  assert.match(items[0].image.srcset, /cached-image-p-1080\.jpg 1080w/);
  assert.match(items[0].image.srcset, /cached-image\.jpg 1600w$/);
});

test("abandons a stalled image request within its time budget", async () => {
  const src = "https://cdn.prod.website-files.com/site/stalled-image.png";
  const items = [{ image: { src, alt: "Stalled" } }];
  const started = Date.now();

  const result = await enrichResponsiveImages(items, {
    requestTimeoutMs: 20,
    fetchImpl: async () => ({
      ok: true,
      arrayBuffer: async () => new Promise(() => {}),
    }),
  });

  assert.ok(Date.now() - started < 250);
  assert.deepEqual(result, { enriched: 0, reused: 0, failures: [src] });
  assert.equal(items[0].image.width, undefined);
});
