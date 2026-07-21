import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DEFAULT_SITE_ID } from "../lib/resource-config.js";
import {
  buildResourceIndex,
  loadWebflowSnapshot,
} from "../lib/resource-index.js";

const token = process.env.WEBFLOW_API_TOKEN;
if (!token) {
  throw new Error("Set WEBFLOW_API_TOKEN before building the live fallback.");
}

const snapshot = await loadWebflowSnapshot({
  siteId: process.env.WEBFLOW_SITE_ID || DEFAULT_SITE_ID,
  token,
});
const build = await buildResourceIndex(snapshot, new Date(), {
  imageFetchImpl: fetch,
});
const outputPath = resolve("data/resource-index.fallback.json");
await writeFile(outputPath, `${JSON.stringify(build.index, null, 2)}\n`);
console.log(
  `Wrote ${build.index.count} live resources to ${outputPath} (${build.checksum.slice(0, 12)}).`
);
