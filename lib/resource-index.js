import {
  RESOURCE_COLLECTIONS,
  RESOURCE_REFERENCE_FIELDS,
  SCHEMA_VERSION,
  normalizeSlug,
} from "./resource-config.js";
import {
  getCollection,
  listAllLiveItems,
  listCollections,
  mapWithConcurrency,
} from "./webflow-api.js";
import { normalizeResourceItem, validateResourceIndex } from "./normalize.js";
import { enrichResponsiveImages } from "./image-variants.js";

const textEncoder = new TextEncoder();

const referencedCollectionId = (field) =>
  field?.metadata?.collectionId || field?.validations?.collectionId || null;

const descriptorForCollection = (collection) => {
  const slug = normalizeSlug(collection.slug);
  return RESOURCE_COLLECTIONS.find((descriptor) =>
    descriptor.slugs.some((candidate) => normalizeSlug(candidate) === slug)
  );
};

export async function sha256Hex(value) {
  const hash = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function loadWebflowSnapshot({ siteId, token, fetchImpl = fetch }) {
  const options = { token, fetchImpl };
  const listedCollections = await listCollections(siteId, options);
  const resourceCollections = listedCollections.filter(descriptorForCollection);
  const missing = RESOURCE_COLLECTIONS.filter(
    (descriptor) =>
      !resourceCollections.some((collection) =>
        descriptor.slugs.some(
          (candidate) => normalizeSlug(candidate) === normalizeSlug(collection.slug)
        )
      )
  );
  if (missing.length) {
    throw new Error(
      `Missing required resource collections: ${missing
        .map((descriptor) => descriptor.contentType)
        .join(", ")}`
    );
  }

  const resourceDetails = await mapWithConcurrency(
    resourceCollections,
    4,
    (collection) => getCollection(collection.id, options)
  );
  const collectionById = new Map(
    resourceDetails.map((collection) => [collection.id, collection])
  );
  let collectionsToInspect = [...resourceDetails];
  let inspectingResourceCollections = true;
  while (collectionsToInspect.length) {
    const referencedIds = new Set();
    for (const collection of collectionsToInspect) {
      for (const field of collection.fields || []) {
        if (
          inspectingResourceCollections &&
          !RESOURCE_REFERENCE_FIELDS.has(field.slug)
        ) {
          continue;
        }
        const referenceId = referencedCollectionId(field);
        if (referenceId && !collectionById.has(referenceId)) {
          referencedIds.add(referenceId);
        }
      }
    }
    if (!referencedIds.size) break;
    collectionsToInspect = await mapWithConcurrency(
      [...referencedIds],
      4,
      (id) => getCollection(id, options)
    );
    for (const collection of collectionsToInspect) {
      collectionById.set(collection.id, collection);
    }
    inspectingResourceCollections = false;
  }

  const collectionDetails = [...collectionById.values()];
  const relevantIds = collectionDetails.map((collection) => collection.id);
  const itemPages = await mapWithConcurrency(relevantIds, 3, (id) =>
    listAllLiveItems(id, options)
  );

  return {
    collections: collectionDetails,
    itemsByCollectionId: new Map(
      relevantIds.map((collectionId, index) => [collectionId, itemPages[index]])
    ),
  };
}

export async function buildResourceIndex(
  snapshot,
  generated = new Date(),
  { imageFetchImpl = null } = {}
) {
  const collectionById = new Map(
    snapshot.collections.map((collection) => [collection.id, collection])
  );
  const referenceById = new Map();
  for (const items of snapshot.itemsByCollectionId.values()) {
    for (const item of items) referenceById.set(item.id, item);
  }

  const items = [];
  const normalizationErrors = [];
  const sources = {};
  for (const collection of snapshot.collections) {
    const descriptor = descriptorForCollection(collection);
    if (!descriptor) continue;
    const collectionItems = snapshot.itemsByCollectionId.get(collection.id) || [];
    for (const item of collectionItems) {
      if (item.isDraft || item.isArchived || !item.lastPublished) continue;
      const normalized = normalizeResourceItem({
        item,
        collection,
        descriptor,
        referenceById,
        collectionById,
      });
      if (normalized.error) normalizationErrors.push(normalized.error);
      else items.push(normalized);
    }
  }

  if (normalizationErrors.length) {
    throw new Error(
      `Resource normalization failed:\n${normalizationErrors.slice(0, 25).join("\n")}`
    );
  }

  items.sort((left, right) => {
    const byDate = right.canonicalDate.localeCompare(left.canonicalDate);
    return byDate || left.id.localeCompare(right.id);
  });
  if (imageFetchImpl) {
    await enrichResponsiveImages(items, { fetchImpl: imageFetchImpl });
  }
  for (const item of items) {
    sources[item.contentType] = (sources[item.contentType] || 0) + 1;
  }

  const index = {
    schemaVersion: SCHEMA_VERSION,
    generated: generated.toISOString(),
    count: items.length,
    sources,
    items,
  };
  const validation = validateResourceIndex(index);
  if (!validation.ok) {
    throw new Error(`Resource index validation failed:\n${validation.errors.join("\n")}`);
  }

  const serialized = JSON.stringify(index);
  return {
    index,
    serialized,
    checksum: await sha256Hex(serialized),
  };
}
