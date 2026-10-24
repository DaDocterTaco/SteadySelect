# Privacy and permissions

SteadySelect 0.1.5 runs locally in Chrome. It has no account, backend, analytics, remote scripts, runtime AI service or API key.

| Permission | Why it is needed |
| --- | --- |
| activeTab | Temporary access to the current page after you invoke the extension. |
| scripting | Inject the local assistance code into the selected webpage. |
| storage | Save comfort preferences, shortcut choices and toolbar layout on this device. |

Page labels, element positions, pointer coordinates and pending selections remain in page memory. The extension does not send them to a server. It does not persist page contents or browsing history. No ongoing host permissions are requested.

Using an assisted control can perform the same website action as clicking the original control. Review the label before confirming. The original website's privacy practices still apply to that website.

The optional hosted test webpage is served by GitHub Pages and follows GitHub's hosting practices. It has no added analytics or external application service. The built-in practice tab is packaged locally with the extension.
