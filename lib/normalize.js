import {
  AUTHOR_ALIASES,
  EXPLICIT_URL_FIELDS,
  IMAGE_FIELDS,
  RESOURCE_REFERENCE_FIELDS,
  SCHEMA_VERSION,
  SUMMARY_FIELDS,
  normalizeSlug,
} from "./resource-config.js";

const firstValue = (fieldData, candidates) => {
  for (const field of candidates) {
    const value = fieldData?.[field];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
};

const asText = (value) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const asReferenceIds = (value) => {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  return typeof value === "string" ? [value] : [];
};

const referencedCollectionId = (field) =>
  field?.metadata?.collectionId || field?.validations?.collectionId || null;

const uniqueLabels = (values) => [
  ...new Map(
    values
      .filter(Boolean)
      .map((value) => [normalizeSlug(value), String(value).trim()])
      .filter(([slug]) => slug)
  ).values(),
];

const imageFromValue = (value, fallbackAlt) => {
  if (typeof value === "string") {
    return { src: value, alt: fallbackAlt, srcset: null, sizes: null };
  }
  if (!value || typeof value !== "object") return null;

  const src = value.url || value.src || value.file?.url || "";
  if (!src) return null;
  const variants = Array.isArray(value.variants) ? value.variants : [];
  const srcset = variants
    .map((variant) => {
      const url = variant.url || variant.src;
      const width = Number(variant.width);
      return url && width ? `${url} ${width}w` : null;
    })
    .filter(Boolean)
    .join(", ");

  return {
    src,
    alt: asText(value.alt) || fallbackAlt,
    srcset: srcset || null,
    sizes: null,
  };
};

const classifyReference = (
  fieldSlug,
  collectionSlug,
  referenceItem,
  referenceById
) => {
  const combined = `${fieldSlug} ${collectionSlug}`;
  if (combined.includes("author")) return "authors";
  if (combined.includes("industr")) return "industries";

  if (collectionSlug.includes("blog-sub-categor")) {
    const parentId = firstValue(referenceItem?.fieldData, [
      "main-category",
      "category",
    ]);
    const parent = referenceById.get(parentId);
    const parentLabel = normalizeSlug(
      firstValue(parent?.fieldData, ["content-name", "name"])
    );
    if (parentLabel.includes("industr")) return "industries";
    if (parentLabel.includes("content-type")) return "contentTypes";
    return "topics";
  }

  const group = normalizeSlug(
    firstValue(referenceItem?.fieldData, [
      "group",
      "filter-group",
      "category-type",
      "type",
    ])
  );
  if (group.includes("industr")) return "industries";
  if (group.includes("author")) return "authors";
  return "topics";
};

const buildUrl = (fieldData, routePrefix) => {
  const explicit = asText(firstValue(fieldData, EXPLICIT_URL_FIELDS));
  if (explicit) return explicit;
  const slug = asText(fieldData?.slug);
  return slug ? `${routePrefix}/${slug}` : "";
};

const canonicalDate = (item, fieldData, dateFields) => {
  const fieldValue = firstValue(fieldData, dateFields);
  const value = fieldValue || item.lastPublished;
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.valueOf())) return null;
  return {
    iso: date.toISOString(),
    source: fieldValue ? dateFields.find((field) => fieldData[field] === fieldValue) : "lastPublished",
  };
};

export function normalizeResourceItem({
  item,
  collection,
  descriptor,
  referenceById,
  collectionById,
}) {
  const fieldData = item.fieldData || {};
  const title = asText(fieldData.name);
  const url = buildUrl(fieldData, descriptor.routePrefix);
  const date = canonicalDate(item, fieldData, descriptor.dateFields);
  const errors = [];
  if (!item.id) errors.push("missing id");
  if (!title) errors.push("missing title");
  if (!url) errors.push("missing URL");
  if (!date) errors.push("missing valid canonical date");
  if (errors.length) {
    return { error: `${collection.slug}:${item.id || "unknown"} ${errors.join(", ")}` };
  }

  const authors = [];
  const topics = [];
  const industries = [];
  const pills = [];
  for (const field of collection.fields || []) {
    if (!RESOURCE_REFERENCE_FIELDS.has(field.slug)) continue;
    const targetCollectionId = referencedCollectionId(field);
    if (!targetCollectionId) continue;
    const targetCollection = collectionById.get(targetCollectionId);
    for (const referenceId of asReferenceIds(fieldData[field.slug])) {
      const referenceItem = referenceById.get(referenceId);
      if (!referenceItem) continue;
      const label = asText(referenceItem.fieldData?.name);
      if (!label) continue;
      const group = classifyReference(
        field.slug,
        targetCollection?.slug || "",
        referenceItem,
        referenceById
      );
      if (group === "authors") {
        const aliasedSlug = AUTHOR_ALIASES.get(referenceItem.fieldData?.slug);
        if (aliasedSlug) {
          const alias = [...referenceById.values()].find(
            (candidate) => candidate.fieldData?.slug === aliasedSlug
          );
          authors.push(asText(alias?.fieldData?.name) || label);
        } else {
          authors.push(label);
        }
      } else if (group === "industries") {
        industries.push(label);
        pills.push({ label, group: "industry" });
      } else if (group === "topics") {
        topics.push(label);
        pills.push({ label, group: "topic" });
      } else if (group === "contentTypes") {
        pills.push({ label, group: "content-type" });
      }
    }
  }

  if (!pills.some((pill) => pill.group === "content-type")) {
    pills.unshift({ label: descriptor.contentType, group: "content-type" });
  }

  const image = imageFromValue(
    firstValue(fieldData, [
      ...(descriptor.imageFields || []),
      ...IMAGE_FIELDS,
    ]),
    title
  );
  return {
    id: item.id,
    sourceCollection: collection.slug,
    contentType: descriptor.contentType,
    title,
    url,
    canonicalDate: date.iso,
    dateSource: date.source,
    summary: asText(
      firstValue(fieldData, [
        ...(descriptor.summaryFields || []),
        ...SUMMARY_FIELDS,
      ])
    ),
    image,
    authors: uniqueLabels(authors),
    topics: uniqueLabels(topics),
    industries: uniqueLabels(industries),
    contentTypes: [descriptor.contentType],
    pills: pills.slice(0, 4),
  };
}

export function validateResourceIndex(index) {
  const errors = [];
  const ids = new Set();
  const urls = new Set();
  if (index.schemaVersion !== SCHEMA_VERSION) errors.push("unsupported schema version");
  if (!Array.isArray(index.items)) errors.push("items must be an array");

  for (const [position, item] of (index.items || []).entries()) {
    for (const key of ["id", "sourceCollection", "contentType", "title", "url", "canonicalDate"]) {
      if (!item[key]) errors.push(`item ${position} is missing ${key}`);
    }
    if (ids.has(item.id)) errors.push(`duplicate id: ${item.id}`);
    if (urls.has(item.url)) errors.push(`duplicate URL: ${item.url}`);
    ids.add(item.id);
    urls.add(item.url);
  }

  if (index.count !== index.items?.length) errors.push("count does not match item length");
  return { ok: errors.length === 0, errors };
}

export function legacyIndexToV2(legacy) {
  const categoryMap = legacy.categories || {};
  const authorMap = legacy.authors || {};
  const items = (legacy.items || []).map((item, position) => {
    const topics = [];
    const industries = [];
    for (const slug of item.c || []) {
      const category = categoryMap[slug] || {};
      if (category.g === "industry") industries.push(category.n || slug);
      else if (category.g === "topic") topics.push(category.n || slug);
    }
    return {
      id: `legacy-${normalizeSlug(item.u)}-${position}`,
      sourceCollection: normalizeSlug(item.k),
      contentType: item.k,
      title: item.t,
      url: item.u,
      canonicalDate: new Date(Number(item.ts) * 1000).toISOString(),
      dateSource: "legacy-static-index",
      summary: item.e || "",
      image: item.i
        ? { src: item.i, alt: item.t, srcset: null, sizes: null }
        : null,
      authors: uniqueLabels((item.a || []).map((slug) => authorMap[slug] || slug)),
      topics: uniqueLabels(topics),
      industries: uniqueLabels(industries),
      contentTypes: [item.k],
      pills: [
        ...topics.map((label) => ({ label, group: "topic" })),
        ...industries.map((label) => ({ label, group: "industry" })),
        { label: item.k, group: "content-type" },
      ].slice(0, 4),
    };
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    generated: legacy.generated,
    count: items.length,
    sources: legacy.sources || {},
    items,
  };
}
