# Production rollout and rollback

This checklist promotes the verified Resource Hub without changing its Webflow styling. Webflow remains the CMS and visual-design source of truth.

## Verified staging baseline

- Page: `https://elire-consulting-01bc63.webflow.io/blog-home-overhaul-dev`
- Resource API mount: `/resource-api-v2`
- Normal source: Webflow Cloud KV
- Fallback source: live CMS response
- Expected index at verification: 722 resources, newest item dated July 17, 2026
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
3. Preserve the existing Webflow `Blog Home` page object and its `/blog-home` slug. Do not swap the old and staging page slugs: existing Webflow links may target the original page object and follow it to a legacy slug.
4. Duplicate the current `/blog-home` page as an unpublished/noindexed rollback page before replacing its main content.
5. Apply the verified Resource Hub sections, runtime embed, and hidden Webflow card template to the existing `/blog-home` page. Do not change linked classes, global CSS, shared components, or visual settings.
6. Set the production SEO title and Open Graph title to `Elire Blog & Resource Hub | Oracle, PeopleSoft, Treasury`.
7. Preserve the current meta description: `Expert insights on Oracle Cloud, PeopleSoft, Kyriba, EPM, ERP, HCM, treasury management, and digital transformation from Elire's consulting team.`
8. Keep sitemap indexing on, include the page in site search, and set the canonical URL to `https://www.elire.com/blog-home`.
9. Add `CollectionPage` JSON-LD using the public `/blog-home` URL and the same description.
10. Keep the staging `/blog-home-overhaul-dev` page noindexed and excluded from site search. After the production page is stable, unpublish it and redirect that staging path to `/blog-home` if the URL has been shared externally.
11. Verify that the global Resources navigation, footer Resources link, service-page “See more” links, search results, and content-type breadcrumbs all resolve to `/blog-home` or a supported filtered `/blog-home?...` URL.
12. Publish only the intended production domains.
13. Repeat the staging checks against `https://www.elire.com/blog-home` immediately after publishing.

## SEO continuity rules

- Keep `https://www.elire.com/blog-home` as the public URL. No redirect is needed for the primary Resource Hub because the URL does not change.
- Keep all existing CMS detail URLs for blogs, webinars, demos, success stories, eBooks, white papers, podcasts, press releases, infographics, and case studies unchanged.
- Do not point production navigation at `/blog-home-overhaul-dev`.
- Update content-type breadcrumbs only after the production renderer is live and verify the supported query parameters before linking them.
- Confirm the published page has exactly one indexable canonical, one useful H1, a 200 response, and no `noindex` directive.
- Request a re-index of `/blog-home` in Google Search Console after the production regression checks pass; submit the existing sitemap again only if Search Console does not recrawl promptly.

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
