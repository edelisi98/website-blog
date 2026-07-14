const API_ROOT = "https://api.webflow.com/v2";
const DEFAULT_LIMIT = 100;
const MAX_RETRIES = 4;

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

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

export async function webflowRequest(path, { token, fetchImpl = fetch } = {}) {
  if (!token) throw new WebflowApiError("WEBFLOW_API_TOKEN is not configured.");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetchImpl(`${API_ROOT}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (response.ok) return response.json();

    const body = await response.text();
    const shouldRetry = response.status === 429 || response.status >= 500;
    if (!shouldRetry || attempt === MAX_RETRIES) {
      throw new WebflowApiError(
        `Webflow API request failed with status ${response.status}.`,
        { status: response.status, path, body }
      );
    }
    await wait(retryDelay(response, attempt));
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
