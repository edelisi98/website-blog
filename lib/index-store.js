export const ACTIVE_INDEX_KEY = "resource-index:v2:active";
export const INDEX_METADATA_KEY = "resource-index:v2:metadata";
export const INDEX_VERSION_PREFIX = "resource-index:v2:";

export async function readStoredIndex(kv) {
  if (!kv) return null;
  const activeKey = await kv.get(ACTIVE_INDEX_KEY);
  if (!activeKey) return null;
  return kv.get(activeKey, "json");
}

export async function writeStoredIndex(kv, build) {
  if (!kv) throw new Error("RESOURCE_INDEX_KV is not configured.");
  const versionKey = `${INDEX_VERSION_PREFIX}${build.checksum}`;
  const metadata = {
    schemaVersion: build.index.schemaVersion,
    generated: build.index.generated,
    count: build.index.count,
    checksum: build.checksum,
    versionKey,
  };

  await kv.put(versionKey, build.serialized);
  await kv.put(INDEX_METADATA_KEY, JSON.stringify(metadata));
  await kv.put(ACTIVE_INDEX_KEY, versionKey);
  return metadata;
}

export async function readIndexMetadata(kv) {
  if (!kv) return null;
  return kv.get(INDEX_METADATA_KEY, "json");
}
