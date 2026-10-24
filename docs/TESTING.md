# Testing and evidence

## Recorded version 0.1.5 results

On October 24, 2026, the final production source passed **74 checks**:

| Suite | Passed | Coverage |
| --- | ---: | --- |
| [Local integration](testing/extension-check-results.json) | 53 | Selection, cancellation, typing, stale targets, one activation, controls, open components, settings, toolbar layout, practice by mouse and remapped keyboard. |
| [Ordinary websites](testing/normal-sites-check-results.json) | 14 | Wikipedia, GitHub microsoft/vscode and MDN; menus, settings, search, lists and preserved typing. |
| [W3C custom buttons](testing/custom-public-check-results.json) | 7 | Mute, Print Page, search, deliberate activation, held Enter and cancellation. |

The original test environment used isolated Chromium build 1248. Test copies received limited host permissions for the fixture and the named sites. Those permissions are absent from the production extension. The W3C suite replaced window.print with a counter to avoid printing.

[Installed Chrome record](testing/installed-chrome-015-check-results.json): the toolbar's collapse, expand, move, K/L interactions and practice launch were checked on MDN. The builder confirmed Practice complete and Finish & close in the installed extension; that completion is user-reported. The same practice flow, cancellation, restart and keyboard variants were exercised automatically in isolated Chromium.

Recorded report sourceSha256 values identify the extension source that was tested. Published extension files are byte-identical to that source. Test-runner setup has been made portable; personal machine paths are not required.

The portable repository's local suite was then rerun successfully on October 24 with the pinned npm Playwright 1.62.1 dependency and its downloaded Chromium 151.0.7922.34 browser: all 53 local checks passed. This verifies the setup documented below; it does not add to the original 74-check count.

## Reproduce locally

```sh
npm ci
npx playwright install chromium
npm run check
npm test
```

Use Node.js 20 or later. On Linux, Playwright may need system browser libraries; use `npx playwright install --with-deps chromium` where appropriate. The tests use Playwright's Chromium channel, not your signed-in Chrome profile. An optional `STEADY_BROWSER_EXECUTABLE` environment variable selects a compatible local Chromium binary.

Run public-site suites separately:

```sh
npm run test:sites
npm run test:custom
```

These require network access and can fail when live sites change or are unavailable. Run suites sequentially: they generate temporary test extension folders. Root-level reports, screenshots and generated harnesses are ignored by Git. Do not load or distribute `tests/.generated-harness` as the production extension.

## Five-minute manual acceptance check

1. Load `extension/` in Chrome and use **Try it safely**. Finish all three steps.
2. Enable on an ordinary webpage and move near a harmless control. Confirm the outline predicts the enlarged selection.
3. Open **Enlarge nearby** and press Escape. Nothing on the original page should activate.
4. Open **Find a button**, search a harmless navigation action and deliberately activate it.
5. Try large text/buttons. Collapse and move the toolbar; expand it again.
6. Enable optional K/L. Confirm they still type normally in a text field.
7. Refresh the page and enable again. Comfort preferences and toolbar layout should persist.

## Limits of the evidence

No intended-user accessibility study has been performed. Passing functional checks does not demonstrate improved task speed, fewer errors, clinical benefit, universal site compatibility or WCAG conformance. Some websites dismiss menus on focus changes or reject programmatic activation; a cancelled stale selection is expected behavior.
