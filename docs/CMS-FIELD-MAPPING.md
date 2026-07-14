# Audited Webflow CMS Mapping

Audited against the live Elire Consulting site on July 14, 2026.

- Webflow site ID: `685d5960cbcc2c4cd8d6dced`
- Primary CMS locale ID: `685d5aa71c91525cc586df16`
- Current normalized live total: 719 resources
- Canonical sorting: newest first by the mapped CMS date field
- Shared relationships: `authors`, `categories`, or `categories-2`
- Taxonomy: Blog Sub Categories resolve through `main-category` to Topic, Industry, or Content Type

| Collection | CMS slug | Count | URL prefix | Date | Summary | Card image |
| --- | --- | ---: | --- | --- | --- | --- |
| Blog Posts | `blog` | 375 | `/blog` | `date` | `excerpts` | `thumbnails` |
| Webinars | `webinars` | 121 | `/webinars` | `date` | `excerpts` | `thumbnail-image` |
| Success Stories | `success-stories` | 131 | `/success-stories` | `date-published` | `excerpts` | `featured-image` |
| Demos | `demos` | 52 | `/demos` | `date` | `excerpt` | `featured-image` |
| Case Studies | `case-study` | 9 | `/case-study` | `date` | `excerpt` | `thumbnails`, then `featured-image` |
| Press Releases | `press-release` | 8 | `/press-release` | `date` | `excerpts` | `thumbnails`, then `images` |
| Infographics | `infographics` | 8 | `/infographics` | `date` | `excerpts` | `thumbnails`, then `background-image` |
| EBooks | `ebooks` | 7 | `/ebooks` | `date` | `excerpt` | `thumbnail`, then `featured-image` |
| White Papers | `white-paper` | 4 | `/white-paper` | `date` | `excerpt` | `thumbnails`, then `featured-image` |
| Podcasts | `podcast` | 4 | `/podcast` | `date-published` | `excerpt` | `thumbnail-blog`, then `thumbnail-from-spotify` |

The normalizer falls back to a collection's meta text or alternate image fields only when the primary mapped field is empty. Four older Webinar records currently have no CMS card image; the renderer handles those without blocking the card text, filters, or page load. Ten older resources currently have no linked author. No value is fabricated for either case.

The index contains 36 Topic options, 8 Industry options, and 10 Content Types. The Content Type always comes from the source collection descriptor, even when an older item is missing its Content Type subcategory relationship.
