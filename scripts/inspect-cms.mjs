import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DEFAULT_SITE_ID } from "../lib/resource-config.js";
import { loadWebflowSnapshot } from "../lib/resource-index.js";

const token = process.env.WEBFLOW_API_TOKEN;
if (!token) throw new Error("Set WEBFLOW_API_TOKEN before inspecting the CMS.");
const snapshot = await loadWebflowSnapshot({
  siteId: process.env.WEBFLOW_SITE_ID || DEFAULT_SITE_ID,
  token,
});
const report = snapshot.collections.map((collection) => ({
  id: collection.id,
  name: collection.displayName,
  slug: collection.slug,
  itemCount: snapshot.itemsByCollectionId.get(collection.id)?.length || 0,
  fields: (collection.fields || []).map((field) => ({
    displayName: field.displayName,
    slug: field.slug,
    type: field.type,
    referenceCollectionId:
      field.metadata?.collectionId || field.validations?.collectionId || null,
  })),
}));
await writeFile(resolve("cms-schema-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${report.length} collection schemas to cms-schema-report.json`);
