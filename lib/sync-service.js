import { DEFAULT_SITE_ID } from "./resource-config.js";
import { buildResourceIndex, loadWebflowSnapshot } from "./resource-index.js";
import { writeStoredIndex } from "./index-store.js";

export async function rebuildResourceIndex(env, { fetchImpl = fetch } = {}) {
  const token = env.WEBFLOW_API_TOKEN;
  const siteId = env.WEBFLOW_SITE_ID || DEFAULT_SITE_ID;
  if (!token) throw new Error("WEBFLOW_API_TOKEN is not configured.");
  if (!env.RESOURCE_INDEX_KV) throw new Error("RESOURCE_INDEX_KV is not configured.");

  const snapshot = await loadWebflowSnapshot({ siteId, token, fetchImpl });
  const build = await buildResourceIndex(snapshot);
  const metadata = await writeStoredIndex(env.RESOURCE_INDEX_KV, build);
  return { metadata, index: build.index };
}
