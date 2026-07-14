export const DEFAULT_SITE_ID = "685d5960cbcc2c4cd8d6dced";

export const RESOURCE_COLLECTIONS = [
  {
    slugs: ["blog"],
    contentType: "Blog Post",
    routePrefix: "/blog",
    dateFields: ["date"],
    summaryFields: ["excerpts"],
    imageFields: ["thumbnails"],
  },
  {
    slugs: ["webinars", "webinar"],
    contentType: "Webinar",
    routePrefix: "/webinars",
    dateFields: ["date"],
    summaryFields: ["excerpts"],
    imageFields: ["thumbnail-image"],
  },
  {
    slugs: ["success-stories", "success-story"],
    contentType: "Success Story",
    routePrefix: "/success-stories",
    dateFields: ["date-published"],
    summaryFields: ["excerpts"],
    imageFields: ["featured-image"],
  },
  {
    slugs: ["demos", "demo"],
    contentType: "Demo",
    routePrefix: "/demos",
    dateFields: ["date"],
    summaryFields: ["excerpt"],
    imageFields: ["featured-image"],
  },
  {
    slugs: ["case-studies", "case-study"],
    contentType: "Case Study",
    routePrefix: "/case-study",
    dateFields: ["date"],
    summaryFields: ["excerpt"],
    imageFields: ["thumbnails", "featured-image"],
  },
  {
    slugs: ["press-releases", "press-release"],
    contentType: "Press Release",
    routePrefix: "/press-release",
    dateFields: ["date"],
    summaryFields: ["excerpts"],
    imageFields: ["thumbnails", "images"],
  },
  {
    slugs: ["infographics", "infographic"],
    contentType: "Infographic",
    routePrefix: "/infographics",
    dateFields: ["date"],
    summaryFields: ["excerpts"],
    imageFields: ["thumbnails", "background-image"],
  },
  {
    slugs: ["ebooks", "e-books", "ebook"],
    contentType: "eBook",
    routePrefix: "/ebooks",
    dateFields: ["date"],
    summaryFields: ["excerpt"],
    imageFields: ["thumbnail", "featured-image"],
  },
  {
    slugs: ["white-papers", "white-paper"],
    contentType: "White Paper",
    routePrefix: "/white-paper",
    dateFields: ["date"],
    summaryFields: ["excerpt"],
    imageFields: ["thumbnails", "featured-image"],
  },
  {
    slugs: ["podcasts", "podcast"],
    contentType: "Podcast",
    routePrefix: "/podcast",
    dateFields: ["date-published"],
    summaryFields: ["excerpt"],
    imageFields: ["thumbnail-blog", "thumbnail-from-spotify"],
  },
];

export const SUMMARY_FIELDS = [
  "excerpts",
  "summary",
  "short-description",
  "excerpt",
  "description",
  "brief-description",
  "meta-description",
  "meta",
];

export const IMAGE_FIELDS = [
  "thumbnails",
  "thumbnail-image",
  "thumbnail-blog",
  "thumbnail-from-spotify",
  "featured-image",
  "main-image",
  "image",
  "thumbnail",
  "images",
  "background-image",
  "open-graph-image",
];

export const EXPLICIT_URL_FIELDS = ["url", "link", "resource-url"];

export const RESOURCE_REFERENCE_FIELDS = new Set([
  "authors",
  "categories",
  "categories-2",
]);

export const AUTHOR_ALIASES = new Map([
  ["adelyn-fredrickson", "elire-marketing"],
]);

export const SCHEMA_VERSION = 2;

export const normalizeSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
