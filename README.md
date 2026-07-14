# Elire Resource Library

This repository contains the read-only resource index service and lightweight browser renderer for the Elire Webflow Resource Hub.

Webflow remains the source of truth for CMS content and visual styling. The service reads ten live Webflow collections on the server, normalizes them into one newest-first index, stores the active index in Webflow Cloud KV, and exposes a public read-only JSON endpoint. The browser initially clones 24 cards from the hidden Webflow template and supports the existing filters, selected chips, result count, Clear Filters, and Load More behavior.

## Local verification

```sh
npm install
npm test
npx opennextjs-cloudflare build
npx opennextjs-cloudflare preview
```

The production-style local endpoints are:

```txt
http://localhost:8787/resource-api-v2/api/health
http://localhost:8787/resource-api-v2/api/resources
```

Without secrets, `/api/resources` intentionally serves the pinned fallback index.

## Webflow Cloud configuration

The isolated test app mounts at `/resource-api-v2` and uses the `RESOURCE_INDEX_KV` binding declared in `wrangler.json`. The older `/resource-api` GitHub-connected app remains untouched during testing.

Configure these runtime variables in Webflow Cloud:

- `WEBFLOW_API_TOKEN` — secret; CMS read access only is sufficient for index generation.
- `WEBFLOW_SITE_ID` — `685d5960cbcc2c4cd8d6dced`.
- `WEBFLOW_WEBHOOK_SECRET` — secret returned when the CMS webhook is created.
- `REBUILD_SECRET` — secret used to protect manual rebuild requests.

Never place these values in Webflow page code, the public renderer, or committed files.

## Index maintenance

`POST /resource-api-v2/api/rebuild` refreshes the KV index when the request includes the configured rebuild secret. `POST /resource-api-v2/api/webhooks` validates Webflow's signed webhook and schedules the same rebuild.

The pinned fallback can be refreshed from current live CMS content with:

```sh
npm run fallback:live
```

The isolated Webflow page currently points to the dated Webflow Asset CDN copy of this fallback JSON. Upload a new dated asset and update the page's `data-resource-fallback` URL only after the refreshed index passes validation.

See `docs/CMS-FIELD-MAPPING.md` for the audited collection map and `docs/WEBFLOW-RUNTIME-TEMPLATE-CONTRACT.md` for the markup hooks.
