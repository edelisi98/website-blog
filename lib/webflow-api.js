import {
  runWithinBudget,
  waitWithinBudget,
} from "./request-budget.js";

const API_ROOT = "https://api.webflow.com/v2";
const DEFAULT_LIMIT = 100;
const MAX_RETRIES = 4;
const REQUEST_TIMEOUT_MS = 3500;

const retryDelay = (response, attempt) => {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  return Math.min(8000, 500 * 2 ** attempt);
};

export class WebflowApiError extends Error {
  constructor(message, { status, path, body } = {}) {
    super(message);
    this.name = "WebflowApiError";
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

export async function webflowRequest(
  path,
  {
    token,
    fetchImpl = fetch,
    deadline = Infinity,
    requestTimeoutMs = REQUEST_TIMEOUT_MS,
    maxRetries = MAX_RETRIES,
  } = {}
) {
  if (!token) throw new WebflowApiError("WEBFLOW_API_TOKEN is not configured.");

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let response;
    try {
      response = await runWithinBudget(
        async (signal) => {
          const upstream = await fetchImpl(`${API_ROOT}${path}`, {
            signal,
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          });
          return {
            ok: upstream.ok,
            status: upstream.status,
            headers: upstream.headers,
            body: await upstream.text(),
          };
        },
        {
          deadline,
          timeoutMs: requestTimeoutMs,
          label: `Webflow API request ${path}`,
        }
      );
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await waitWithinBudget(
        Math.min(8000, 500 * 2 ** attempt),
        deadline,
        `Webflow API retry for ${path}`
      );
      continue;
    }

    if (response.ok) return JSON.parse(response.body);

    const shouldRetry = response.status === 429 || response.status >= 500;
    if (!shouldRetry || attempt === maxRetries) {
      throw new WebflowApiError(
        `Webflow API request failed with status ${response.status}.`,
        { status: response.status, path, body: response.body }
      );
    }
    await waitWithinBudget(
      retryDelay(response, attempt),
      deadline,
      `Webflow API retry for ${path}`
    );
  }

  throw new WebflowApiError("Webflow API request failed after retries.", { path });
}

export async function listCollections(siteId, options) {
  const data = await webflowRequest(`/sites/${siteId}/collections`, options);
  return data.collections || [];
}

export function getCollection(collectionId, options) {
  return webflowRequest(`/collections/${collectionId}`, options);
}

export async function listAllLiveItems(collectionId, options = {}) {
  const items = [];
  let offset = 0;

  while (true) {
    const query = new URLSearchParams({
      limit: String(DEFAULT_LIMIT),
      offset: String(offset),
    });
    const data = await webflowRequest(
      `/collections/${collectionId}/items/live?${query}`,
      options
    );
    const pageItems = data.items || [];
    items.push(...pageItems);
    const total = Number(data.pagination?.total ?? items.length);
    offset += pageItems.length;
    if (!pageItems.length || offset >= total) break;
  }

  return items;
}

export async function mapWithConcurrency(values, limit, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker())
  );
  return results;
}
