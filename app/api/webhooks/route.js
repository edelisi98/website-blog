import { after } from "next/server";
import { DEFAULT_SITE_ID } from "../../../lib/resource-config.js";
import { getRuntimeEnv } from "../../../lib/runtime-env.js";
import { rebuildResourceIndex } from "../../../lib/sync-service.js";
import { verifyWebflowWebhook } from "../../../lib/webhook-signature.js";

export const dynamic = "force-dynamic";

const CMS_TRIGGERS = new Set([
  "collection_item_created",
  "collection_item_changed",
  "collection_item_deleted",
  "collection_item_published",
  "collection_item_unpublished",
]);

export async function POST(request) {
  const env = await getRuntimeEnv();
  const body = await request.text();
  const timestamp = request.headers.get("x-webflow-timestamp");
  const signature = request.headers.get("x-webflow-signature");
  const isValid = await verifyWebflowWebhook({
    body,
    timestamp,
    signature,
    secret: env.WEBFLOW_WEBHOOK_SECRET,
    secrets: env.WEBFLOW_WEBHOOK_SECRETS,
  });
  if (!isValid) {
    return Response.json({ ok: false, message: "Invalid signature." }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON." }, { status: 400 });
  }
  const siteId = event.payload?.siteId || event.siteId;
  if (siteId && siteId !== (env.WEBFLOW_SITE_ID || DEFAULT_SITE_ID)) {
    return Response.json({ ok: false, message: "Unexpected site." }, { status: 400 });
  }
  if (!CMS_TRIGGERS.has(event.triggerType)) {
    return Response.json({ ok: true, ignored: true });
  }

  after(async () => {
    try {
      await rebuildResourceIndex(env);
    } catch (error) {
      console.error("Webhook-triggered resource rebuild failed.", error);
    }
  });
  return Response.json({ ok: true, accepted: true });
}
