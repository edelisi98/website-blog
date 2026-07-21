# Webflow Runtime Template Contract

The renderer never creates card, chip, pill, grid, button, or state markup. It clones Webflow elements and only fills the behavior hooks below. Existing Webflow classes remain unchanged and own every visual decision.

## Root and data sources

Add `data-resource-library` to the resource library wrapper, plus:

- `data-resource-endpoint="/resource-api-v2/api/resources"`
- `data-resource-fallback="PINNED_FALLBACK_JSON_URL"`

## Required Webflow elements

| Element | Behavior hook |
| --- | --- |
| Results grid | `data-resource-results` |
| Card template | `data-resource-template="card"` and `hidden` |
| Active chip container | `data-resource-active-filters` |
| Active chip template | `data-resource-template="chip"` and `hidden` |
| Keyword search input | `data-resource-search` |
| Result count | `data-resource-count` |
| Live announcement | `data-resource-announcement` |
| Load More button | `data-resource-load-more` |
| Clear Filters button | `data-resource-clear` |
| Retry button | `data-resource-retry` |
| Loading state | `data-resource-state="loading"` |
| Empty state | `data-resource-state="empty"` and `hidden` |
| Error state | `data-resource-state="error"` and `hidden` |
| Fallback notice | `data-resource-state="fallback"` and `hidden` |

## Card fields

The hidden Webflow card template may contain:

- `data-resource-field="url"` on every link that should open the resource.
- `data-resource-field="image"` on the card image.
- `data-resource-field="image-container"` on the image wrapper so the full panel can be hidden when an item has no image.
- `data-resource-field="title"`.
- `data-resource-field="date"`.
- `data-resource-field="summary"`.
- `data-resource-field="cta"` for the content-type-specific action label.
- `data-resource-field="author-separator"` on punctuation that should be hidden when no authors are available.

Use a semantic `h2` or `h3` for the title field. The renderer assigns it a unique ID and points the card link's `aria-labelledby` to that title.

The resource index supplies `srcset`, `sizes`, and original `width`/`height` for normal Webflow PNG/JPEG assets. Keep a 16:9 card-image aspect ratio in Webflow and retain intrinsic dimensions on the template image so the browser can reserve space before the image loads.

## Repeating card fields

Use these list containers:

- `data-resource-list="authors"`
- `data-resource-list="topics"`
- `data-resource-list="industries"`
- `data-resource-list="content-types"`

Each list contains one hidden Webflow child template. Author templates use `data-resource-template="author"`. Pill templates use `data-resource-template="pill"` plus one of:

- `data-resource-pill-group="topic"`
- `data-resource-pill-group="industry"`
- `data-resource-pill-group="content-type"`

Each repeating template contains `data-resource-field="label"` on the text element. Separate pill templates let Webflow own the existing topic, industry, and content-type colors without JavaScript styles.

## Filter controls

Preferred neutral hooks:

- A wrapper per group with `data-resource-filter-group="topic"`, `industry`, or `content-type`.
- Each checkbox receives `data-resource-filter-value="PeopleSoft"`.
- Optional `data-resource-filter-label` controls the active-chip label.

The renderer temporarily supports the existing `fs-list-*` checkbox attributes during migration.

## Shareable filter state

The renderer reads and updates these query parameters without reloading the page:

- `q` for keyword search.
- `topic` for one or more topic values.
- `industry` for one or more industry values.
- `content-type` for one or more content-type values.

Repeated parameters represent same-group OR selections. Different groups combine with AND logic. Unrelated query parameters are preserved.

## Analytics events

Every behavior event is dispatched on `window` as `elire:resource-hub`. If `window.dataLayer` already exists, the same payload is also pushed there for Google Tag Manager. Supported event names are:

- `resource_hub_loaded`
- `resource_hub_fallback_used`
- `resource_hub_search`
- `resource_hub_zero_results`
- `resource_hub_filter_change`
- `resource_hub_clear`
- `resource_hub_load_more`
- `resource_hub_card_click`

Event payloads include only the relevant resource, search, filter, result-count, and position fields. Analytics failure is deliberately isolated so it can never block browsing or filtering.

## Styling safety rule

Do not add visual CSS to the renderer. Hidden-state behavior uses the native `hidden` attribute. All classes, breakpoints, typography, spacing, colors, borders, truncation, hover states, and focus states stay in Webflow.
