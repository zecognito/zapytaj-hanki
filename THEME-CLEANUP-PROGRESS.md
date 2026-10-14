# Charcoal theme consolidation — live progress

## Locked requirements
- Production branch: `main` only. No new branches.
- Preserve the currently approved charcoal/pink appearance, logos, Michigan guide layout, Newsy, homepage, footer and mobile functionality.
- NO new CSS overrides, NO added `!important` patches, NO redesign.
- Edit existing rules in place. Do not remove CSS unless dependent templates are checked.
- Avoid frequent status interruptions; continue by template group and verify.

## Known root causes
- `assets/site.css` historically sets white initial canvas/header/hero/footer.
- `assets/michigan-article-master.css` also begins with white background rules.
- `assets/site.js` injects `assets/hanka-charcoal-theme.css?v=20261012-v2` after parsing, causing possible flash of white.
- `newsy/style.css` is already charcoal-first. Other templates may be standalone.

## Completed (2026-10-14)
- `f2170ab`: changed the existing `html` and `body` background rules in `assets/site.css` to #151719 (no new selectors).
- `9e0690d`: changed the existing header, hero and canonical footer background rules in `assets/site.css` to charcoal (no new selectors).

- `5f23a9f`: replaced the original shared root color variables and menu/search/card/guide light backgrounds directly in `assets/site.css`; no new CSS selectors or overrides.\n\n## Remaining — NOT DONE
- Check shared stylesheet variables and component backgrounds; edit original rules in place rather than adding overrides.
- Convert Michigan article master and other templates from white-first to charcoal-first while preserving their final computed appearance.
- Move dark theme rules into canonical stylesheets by template, then remove the JavaScript stylesheet injection only when no template depends on it.
- Verify homepage, Newsy index/articles, state hubs and guides, calculators, USCIS tests, directories and mobile/desktop behavior.
- Verify there is no flash on first load and no regression in logo, footer, links or chat launcher.

## Important
These first commits only correct some white-first surfaces. **They do not yet complete the consolidation or remove the JS-injected theme.** Continue from this checkpoint, do not claim the job is finished.
