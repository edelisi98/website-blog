import { DEFAULT_SITE_ID } from "./resource-config.js";
import { buildResourceIndex, loadWebflowSnapshot } from "./resource-index.js";
import { readStoredIndex, writeStoredIndex } from "./index-store.js";
import { deadlineAfter } from "./request-budget.js";

const REBUILD_BUDGET_MS = 15000;
const IMAGE_ENRICHMENT_BUDGET_MS = 7000;

export async function rebuildResourceIndex(env, { fetchImpl = fetch } = {}) {
  const token = env.WEBFLOW_API_TOKEN;
  const siteId = env.WEBFLOW_SITE_ID || DEFAULT_SITE_ID;
  if (!token) throw new Error("WEBFLOW_API_TOKEN is not configured.");
  if (!env.RESOURCE_INDEX_KV) throw new Error("RESOURCE_INDEX_KV is not configured.");

  const rebuildDeadline = deadlineAfter(REBUILD_BUDGET_MS);
  const existingIndexPromise = readStoredIndex(env.RESOURCE_INDEX_KV).catch(
    (error) => {
      console.warn("Existing resource index could not be read.", error);
      return null;
    }
  );
  const snapshot = await loadWebflowSnapshot({
    siteId,
    token,
    fetchImpl,
    deadline: rebuildDeadline,
  });
  const existingIndex = await existingIndexPromise;
  const build = await buildResourceIndex(snapshot, new Date(), {
    imageFetchImpl: fetchImpl,
    imageDeadline: Math.min(
      rebuildDeadline,
      deadlineAfter(IMAGE_ENRICHMENT_BUDGET_MS)
    ),
    cachedItems: existingIndex?.items || [],
  });
  const metadata = await writeStoredIndex(env.RESOURCE_INDEX_KV, build);
  return {
    metadata,
    index: build.index,
    imageEnrichment: {
      enriched: build.imageEnrichment.enriched,
      reused: build.imageEnrichment.reused,
      failed: build.imageEnrichment.failures.length,
    },
  };
}
