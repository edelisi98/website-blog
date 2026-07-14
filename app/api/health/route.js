import { getRuntimeEnv } from "../../../lib/runtime-env.js";
import { readIndexMetadata } from "../../../lib/index-store.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = await getRuntimeEnv();
  const metadata = await readIndexMetadata(env.RESOURCE_INDEX_KV);
  return Response.json({
    ok: true,
    service: "elire-resource-api",
    generated: new Date().toISOString(),
    configuration: {
      hasWebflowToken: Boolean(env.WEBFLOW_API_TOKEN),
      hasKvBinding: Boolean(env.RESOURCE_INDEX_KV),
      hasWebhookSecret: Boolean(env.WEBFLOW_WEBHOOK_SECRET),
      hasRebuildSecret: Boolean(env.REBUILD_SECRET),
    },
    index: metadata,
  });
}
