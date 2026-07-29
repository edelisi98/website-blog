import { runWithinBudget } from "./request-budget.js";

const WEBFLOW_VARIANT_WIDTHS = [500, 800, 1080, 1600, 2000, 2600, 3200];
const IMAGE_REQUEST_TIMEOUT_MS = 1500;

export const RESOURCE_CARD_SIZES =
  "(max-width: 767px) calc(100vw - 2.5rem), (max-width: 991px) calc(50vw - 2rem), calc(33.333vw - 2rem)";

const isWebflowRaster = (src) => {
  try {
    const url = new URL(src);
    return (
      url.hostname.endsWith("website-files.com") &&
      /\.(?:png|jpe?g)$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
};

const webflowVariantUrl = (src, width) =>
  src.replace(/(\.(?:png|jpe?g))(\?.*)?$/i, `-p-${width}$1$2`);

export const readRasterDimensions = (bytes) => {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  if (
    data.length >= 24 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8) {
    const sofMarkers = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
      0xce, 0xcf,
    ]);
    let offset = 2;
    while (offset + 8 < data.length) {
      while (offset < data.length && data[offset] !== 0xff) offset += 1;
      while (offset < data.length && data[offset] === 0xff) offset += 1;
      if (offset >= data.length) break;
      const marker = data[offset];
      offset += 1;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        continue;
      }
      if (marker === 0xd9 || marker === 0xda || offset + 1 >= data.length) break;
      const length = (data[offset] << 8) + data[offset + 1];
      if (length < 2 || offset + length > data.length) break;
      if (sofMarkers.has(marker) && length >= 7) {
        return {
          height: (data[offset + 3] << 8) + data[offset + 4],
          width: (data[offset + 5] << 8) + data[offset + 6],
        };
      }
      offset += length;
    }
  }

  return null;
};

const fetchDimensions = async (
  src,
  fetchImpl,
  { deadline, requestTimeoutMs }
) => {
  return runWithinBudget(
    async (signal) => {
      const response = await fetchImpl(src, {
        signal,
        headers: { Range: "bytes=0-65535" },
      });
      if (!response.ok) return null;
      return readRasterDimensions(await response.arrayBuffer());
    },
    {
      deadline,
      timeoutMs: requestTimeoutMs,
      label: `Image metadata request ${src}`,
    }
  );
};

const applyDimensions = (images, src, dimensions) => {
  const variants = WEBFLOW_VARIANT_WIDTHS.filter(
    (width) => width < dimensions.width
  ).map((width) => `${webflowVariantUrl(src, width)} ${width}w`);
  const srcset = [...variants, `${src} ${dimensions.width}w`].join(", ");
  for (const image of images) {
    image.width = dimensions.width;
    image.height = dimensions.height;
    image.srcset = srcset;
    image.sizes = RESOURCE_CARD_SIZES;
  }
  return images.length;
};

export async function enrichResponsiveImages(
  items,
  {
    fetchImpl = fetch,
    concurrency = 6,
    deadline = Infinity,
    requestTimeoutMs = IMAGE_REQUEST_TIMEOUT_MS,
    cachedItems = [],
  } = {}
) {
  const bySource = new Map();
  for (const item of items) {
    const src = item.image?.src;
    if (!src || !isWebflowRaster(src)) continue;
    if (!bySource.has(src)) bySource.set(src, []);
    bySource.get(src).push(item.image);
  }

  const cachedDimensions = new Map();
  for (const item of cachedItems || []) {
    const image = item.image;
    if (image?.src && image.width > 0 && image.height > 0) {
      cachedDimensions.set(image.src, {
        width: Number(image.width),
        height: Number(image.height),
      });
    }
  }

  const sources = [];
  let reused = 0;
  for (const [src, images] of bySource) {
    const dimensions = cachedDimensions.get(src);
    if (dimensions) reused += applyDimensions(images, src, dimensions);
    else sources.push(src);
  }
  let nextIndex = 0;
  const failures = [];
  let enriched = 0;

  async function worker() {
    while (nextIndex < sources.length) {
      const index = nextIndex;
      nextIndex += 1;
      const src = sources[index];
      try {
        const dimensions = await fetchDimensions(src, fetchImpl, {
          deadline,
          requestTimeoutMs,
        });
        if (!dimensions?.width || !dimensions?.height) {
          failures.push(src);
          continue;
        }
        enriched += applyDimensions(bySource.get(src), src, dimensions);
      } catch {
        failures.push(src);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, sources.length) }, () => worker())
  );
  return { enriched, reused, failures };
}
