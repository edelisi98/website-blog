import { getRuntimeEnv } from "../../../lib/runtime-env.js";
import { rebuildResourceIndex } from "../../../lib/sync-service.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const authorized = (request, secret) => {
  const authorization = request.headers.get("authorization") || "";
  return Boolean(secret) && authorization === `Bearer ${secret}`;
};

export async function POST(request) {
  const env = await getRuntimeEnv();
  if (!authorized(request, env.REBUILD_SECRET)) {
    return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await rebuildResourceIndex(env);
    return Response.json({ ok: true, index: result.metadata });
  } catch (error) {
    console.error("Resource index rebuild failed.", error);
    return Response.json(
      { ok: false, message: "Resource index rebuild failed." },
      { status: 500 }
    );
  }
}
