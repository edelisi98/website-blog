import fallbackIndex from "../../../data/resource-index.fallback.json";
import { getRuntimeEnv } from "../../../lib/runtime-env.js";
import { readStoredIndex } from "../../../lib/index-store.js";
import { validateResourceIndex } from "../../../lib/normalize.js";

export const dynamic = "force-dynamic";

const responseHeaders = (source) => ({
  "content-type": "application/json; charset=utf-8",
  "x-elire-resource-source": source,
  "x-content-type-options": "nosniff",
  "access-control-allow-origin": "https://www.elire.com",
});

export async function GET(request) {
  const url = new URL(request.url);
  const forcedFallback = url.searchParams.get("source") === "fallback";
  let index = null;
  let source = "fallback";

  if (!forcedFallback) {
    const env = await getRuntimeEnv();
    index = await readStoredIndex(env.RESOURCE_INDEX_KV);
    if (index) source = "kv";
  }
  if (!index) index = fallbackIndex;

  const validation = validateResourceIndex(index);
  if (!validation.ok) {
    return Response.json(
      { ok: false, message: "No valid resource index is available." },
      { status: 503, headers: responseHeaders("invalid") }
    );
  }

  return new Response(JSON.stringify(index), {
    status: 200,
    headers: responseHeaders(source),
  });
}
