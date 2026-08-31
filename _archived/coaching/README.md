# Archived: Coaching page

**Date archived:** 2026-08-31

This page was **taken down intentionally** and can be restored later.

## What's here / original paths
| Archived path | Original path (repo root) |
|---|---|
| `_archived/coaching/coaching.html` | `coaching.html` (served at `/coaching`) |
| `_archived/coaching/coaching-hero.jpg` | `coaching-hero.jpg` (referenced by `coaching.html`) |

## Notes
- Only the page and its **dedicated** hero image were moved. Shared assets it
  relied on were intentionally left in place: `styles.css`, `redesign.css`
  (which still contain the coaching-specific rules `.philosophy`, `.wyg-grid`,
  `.page-hero-inner--split`, plus `.content-section` used by other pages),
  `shared.js`, fonts, and analytics. So restoring is just moving these two
  files back.
- The site nav link was **commented out** (not deleted) in `shared.js`, tagged
  `<!-- ARCHIVED: coaching page taken down 2026-08-31 -->`.
- `/_archived/` is excluded from deployment via `.vercelignore`, so this copy
  is preserved in the repo but not served on the live site.
- Left untouched: the historical Aug 30, 2026 newsletter body in
  `newsletters.json` still links to `/coaching` (that link will 404 while the
  page is down). This was left as-is to avoid rewriting a published issue.

## To restore
```bash
# from the repo root
git mv _archived/coaching/coaching.html coaching.html
git mv _archived/coaching/coaching-hero.jpg coaching-hero.jpg
# then uncomment the nav link in shared.js (search: "ARCHIVED: coaching")
# and remove the _archived line from .vercelignore (or delete .vercelignore
# if it only contains that entry)
```
