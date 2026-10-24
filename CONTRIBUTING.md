# Working on SteadySelect

Read the [README](README.md), [architecture](docs/ARCHITECTURE.md) and [testing guide](docs/TESTING.md) first. There is no build step for the extension; Node and Playwright are development-only dependencies.

Keep the core promises intact: preview does not activate, confirmation activates the chosen original control once, Escape cancels, typing keeps working, stale targets are invalidated, and page data stays local.

For a bug report, include the browser/extension version, a public test URL or minimal example, steps, expected behavior and actual behavior. Avoid submitting private page content, credentials or personal medical information.

Run `npm run check` and `npm test` after a behavior change. For compatibility changes, run the relevant live-site checks and document their exact scope. Update documentation when user-visible behavior changes. Do not commit signing keys, packaged CRX files, generated harnesses, secrets or unrelated project files.

A license has not yet been selected. Discuss redistribution or substantial external contributions with the owner before relying on broader reuse rights.
