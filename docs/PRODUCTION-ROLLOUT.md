# Production rollout and rollback

This checklist promotes the verified Resource Hub without changing its Webflow styling. Webflow remains the CMS and visual-design source of truth.

## Verified staging baseline

- Page: `https://elire-consulting-01bc63.webflow.io/blog-home-overhaul-dev`
- Resource API mount: `/resource-api-v2`
- Normal source: Webflow Cloud KV
- Fallback source: live CMS response
- Expected index at verification: 719 resources, newest item dated July 10, 2026
- Initial render: 24 cards
- Healthcare filter: 12 resources
- First Load More action: 48 visible cards
- Tested widths: 1280 px, 991 px, and 390 px with no horizontal overflow

## Preflight

1. Confirm `/api/health` reports the Webflow token, KV binding, webhook secret, and rebuild secret as configured.
2. Confirm `/api/resources` reports `x-elire-resource-source: kv` and returns the expected item count.
3. Confirm `/api/resources?source=fallback` reports `x-elire-resource-source: fallback` and its normalized items match the KV response.
4. Confirm all three Webflow webhook registrations are enabled: published, unpublished, and deleted.
5. Confirm the `Reconcile resource index` GitHub Actions workflow has a recent successful run.
6. Confirm the staging page still passes filtering, filter removal, Load More, and responsive checks.

## Production promotion

1. Add the `/resource-api-v2` Webflow Cloud mount to each intended production domain.
2. Publish the mount configuration and verify the production health and resource endpoints before changing the public Resource Hub page.
3. Duplicate or preserve the current `/blog-home` page as the rollback page.
4. Apply the verified runtime embed and hidden Webflow card template to `/blog-home`. Do not modify linked classes, global CSS, components, or visual settings.
5. Publish only the intended production domains.
6. Repeat the staging checks against `https://www.elire.com/blog-home` immediately after publishing.

## Rollback

If the resource endpoint or renderer fails after promotion:

1. Restore the preserved pre-promotion `/blog-home` page or its previous embed.
2. Republish the intended production domain.
3. Leave the `/resource-api-v2` app and webhook registrations active while the issue is investigated; they do not alter CMS content.
4. If only KV freshness is affected, keep the page live on its fallback response and run the protected rebuild workflow.

## Post-launch monitoring

- Check the health endpoint and newest resource after each production publish during the first week.
- Review failed `Reconcile resource index` workflow runs.
- Verify that a CMS publish, unpublish, or delete event updates the index timestamp and preserves newest-first ordering.
- Keep the fallback index and rollback page available until the production page has been stable for at least one normal publishing cycle.
