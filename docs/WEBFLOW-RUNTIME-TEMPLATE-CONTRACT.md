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
| Result count | `data-resource-count` |
| Load More button | `data-resource-load-more` |
| Clear Filters button | `data-resource-clear` |
| Loading state | `data-resource-state="loading"` |
| Empty state | `data-resource-state="empty"` and `hidden` |
| Error state | `data-resource-state="error"` and `hidden` |
| Fallback notice | `data-resource-state="fallback"` and `hidden` |

## Card fields

The hidden Webflow card template may contain:

- `data-resource-field="url"` on every link that should open the resource.
- `data-resource-field="image"` on the card image.
- `data-resource-field="title"`.
- `data-resource-field="date"`.
- `data-resource-field="summary"`.

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

## Styling safety rule

Do not add visual CSS to the renderer. Hidden-state behavior uses the native `hidden` attribute. All classes, breakpoints, typography, spacing, colors, borders, truncation, hover states, and focus states stay in Webflow.
