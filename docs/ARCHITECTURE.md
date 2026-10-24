# How SteadySelect works

SteadySelect is a Manifest V3 extension made with plain JavaScript, HTML and CSS. There is no bundler or runtime dependency.

1. The popup or Chrome command invokes the service worker.
2. Temporary active-tab access allows injection of the local core and content scripts.
3. The core discovers supported, labeled controls, including controls in accessible open shadow roots. It uses element geometry, visibility and hit testing to identify nearby candidates.
4. The content script draws the outline and provides the toolbar, nearby card and searchable list in an isolated UI root.
5. Opening assistance freezes the selection. Before activation, the extension checks target identity, label, context, state, destination and geometry again, including after focus. A changed target is invalidated.
6. Confirmation invokes the original control once. Cancellation does not activate it. No pointer coordinates leave the page.

## Files

| File | Responsibility |
| --- | --- |
| `manifest.json` | Permissions, popup, worker and commands. |
| `worker.js` | Enable/toggle/injection commands and opening the practice tab. |
| `core.js` | Control discovery, labels, geometry and validation helpers. |
| `content.js` | Outline, selection state, toolbar, dialogs, input and deliberate activation. |
| `popup.html/css/js` | Enable flow, preferences and shortcut settings. |
| `practice.html/css/js` | Three-step guided practice using the real assistance engine. |

The special practice bridge is available only on the extension's own practice URL. That page limits selectable controls to two harmless examples. Practice preferences are local to the practice tab and do not overwrite saved comfort preferences.

## State and permissions

Chrome local storage holds preferences and toolbar layout. Page labels, pointer positions and pending selections remain in memory. Navigation or reload requires the user to enable the extension again. The production package has no host_permissions, content-script auto-injection, network API or external script.

## Design tradeoffs

Explicit confirmation adds a step but lets a person inspect the target before acting. The nearby card does not chase the pointer. On-screen filtering reduces list length, while Whole page reveals an offscreen action before arming it. Large mouse alternatives and optional letter shortcuts avoid requiring a single input method.

Discovery deliberately excludes arbitrary clickable elements without supported semantics. This limits compatibility, but helps avoid offering ambiguous actions. Pre-activation checks cannot prove that a third-party website's arbitrary event-handler behavior has remained unchanged.
