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

- `5f23a9f`: replaced the original shared root color variables and menu/search/card/guide light backgrounds directly in `assets/site.css`; no new CSS selectors or overrides.\n\n- `e065d22`: changed the original shared article answer/summary/warning panels and article footer to charcoal.\n- `21ae8e2`: replaced six original white mobile navigation backgrounds and five obsolete green navigation text rules directly in `assets/site.css`.\n\n## Remaining — NOT DONE
- Check shared stylesheet variables and component backgrounds; edit original rules in place rather than adding overrides.
- Convert Michigan article master and other templates from white-first to charcoal-first while preserving their final computed appearance.
- Move dark theme rules into canonical stylesheets by template, then remove the JavaScript stylesheet injection only when no template depends on it.
- Verify homepage, Newsy index/articles, state hubs and guides, calculators, USCIS tests, directories and mobile/desktop behavior.
- Verify there is no flash on first load and no regression in logo, footer, links or chat launcher.

## Important
These first commits only correct some white-first surfaces. **They do not yet complete the consolidation or remove the JS-injected theme.** Continue from this checkpoint, do not claim the job is finished.

## LOCKED WORKFLOW — 2026-10-14
1. Homepage and hubs first (including landing pages and directories).
2. Topic-by-topic article cleanup, complete and verify each topic before the next.
3. Calculators hub and tools.
4. Citizenship tests and result screens.
5. State hubs and state articles LAST.
Do not edit future sections ahead of schedule. Preserve current approved layout, logo, favicon, Hanka mascot, banners, and mobile behavior. Audit old logos/banners/assets and their live references before deleting anything; remove only confirmed unused legacy assets. Replace legacy white styling within each scheduled section without adding CSS override layers. Verify before advancing.

## Homepage pass — started 2026-10-14
- Homepage `index.html` has 61 inline `<style>` blocks, including obsolete light and green rules, plus a later approved charcoal layer. Do not blindly delete blocks: inspect dependencies and consolidate into original rules.
- `f70d602`: converted the ORIGINAL first homepage palette and header rules to charcoal so first paint does not start with the old white/cream palette. This is a first step, NOT completed homepage verification.
- Current homepage references `/hanka-favicon-usa.png`, `/assets/a_clean_high_resolution_vector_cartoon_style_logo.png` (active header logo despite old filename), `/assets/hanka-hero.webp` and mobile variant (approved hero), and older `assets/zapytaj-hanki-hero.jpg` in CSS. Do NOT delete active logo/hero assets based on filename.
- Still to do: consolidate remaining 61 style blocks, remove obsolete home-only white/green declarations safely, verify responsive appearance, header/footer/social icons, and ensure no regressions. Do not move to hubs until homepage completed.

- `a176013`: homepage original language control, search, card, and pill rules now use canonical dark variables rather than hardcoded white/gray.
- `7987a44`: replaced an obsolete green `:root` palette in the homepage inline CSS with the approved charcoal values. Kept all later styles and layout untouched; homepage consolidation and visual verification remain pending.

- `908f5a0`: replaced six old white first-block homepage surfaces (including body, guides, states, menu, mobile dropdown) in original selectors.
- `cd7a5eb`: replaced six more original white/green homepage rules (legacy body/header, topic rail, answer card, hero note and bubble) in place. No additional stylesheet, no new selectors. Homepage still has 61 inline style blocks; do not mark complete before cascade consolidation and visual testing.

- `dc316a9`: normalized three additional obsolete light/green homepage `:root` palette declarations to approved charcoal values in place, preserving other named accent variables.
- `13fd58e`: removed unnecessary `!important` flags from the late canonical homepage root colors. No new CSS rules added. User visually approved homepage appearance before this pass; these latest commits still require visual recheck.

- `04e14fa`: updated original homepage language selector, pill hover, and card backgrounds to existing dark tokens.
- `37735d3`: updated original homepage icon and input surfaces from hardcoded white to existing dark tokens. No new overrides. Homepage still pending consolidation of redundant style blocks and visual verification of latest commits.
