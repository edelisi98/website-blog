import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getRuntimeEnv() {
  let cloudflareEnv = {};
  try {
    const context = await getCloudflareContext({ async: true });
    cloudflareEnv = context?.env || {};
  } catch {
    // Local Next.js builds do not have Cloudflare bindings.
  }
  return {
    ...cloudflareEnv,
    WEBFLOW_API_TOKEN:
      cloudflareEnv.WEBFLOW_API_TOKEN || process.env.WEBFLOW_API_TOKEN,
    WEBFLOW_SITE_ID:
      cloudflareEnv.WEBFLOW_SITE_ID || process.env.WEBFLOW_SITE_ID,
    WEBFLOW_WEBHOOK_SECRET:
      cloudflareEnv.WEBFLOW_WEBHOOK_SECRET || process.env.WEBFLOW_WEBHOOK_SECRET,
    WEBFLOW_WEBHOOK_SECRETS:
      cloudflareEnv.WEBFLOW_WEBHOOK_SECRETS ||
      process.env.WEBFLOW_WEBHOOK_SECRETS,
    REBUILD_SECRET: cloudflareEnv.REBUILD_SECRET || process.env.REBUILD_SECRET,
  };
}
