# Tab Vault

Save, search, and restore your browser sessions. Tab Vault auto-saves your open tabs, recovers windows you closed by accident, and keeps your tab groups intact. Everything is stored locally in your browser.

Built as a Manifest V3 Chrome extension with no dependencies and no build step.

## Features

- **Save sessions**: save all windows or just the current one, with an optional name.
- **Auto-save**: snapshots your open windows on a timer (default every 5 minutes). It skips the save if nothing has changed, and keeps only the most recent ones.
- **Closed window recovery**: when you close a window with 2 or more tabs, it's saved so you can bring it back.
- **Tab groups preserved**: group names and colours are saved and recreated on restore. Pinned tabs stay pinned.
- **Flexible restore**: restore a whole session, or pick individual tabs. Open in new windows or in your current window.
- **Lazy loading**: restored tabs can be loaded lazily (discarded until you click them), so restoring 100 tabs doesn't hammer your memory or network.
- **Search**: find sessions by name, tag, note, tab title, or URL. Press `/` in the manager to jump to search.
- **Organise**: pin, rename, tag, and add notes to sessions. Merge sessions, remove duplicate tabs, or delete individual tabs from a saved session.
- **Password lock**: encrypt a session's tabs with a password (AES-256-GCM, key derived with PBKDF2).
- **Stash a tab**: right-click any page and choose **Stash this tab** to save it to a running "Stash" session and close it.
- **Close duplicates**: one click closes duplicate tabs across all windows (ignoring `#fragments`, keeping pinned and active tabs).
- **Import / export**: back up all sessions to JSON, or export a single session. Copy any session as Markdown links.
- **Environment warnings**: sessions remember which browser and OS they were saved in, and warn you before restoring somewhere different, since sites may log you out. Public IP tracking is optional and off by default.
- **Themes**: auto, light, or dark.

## Installation

Tab Vault isn't on the Chrome Web Store, so load it as an unpacked extension:

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome (or any Chromium browser such as Edge, Brave, or Opera).
3. Turn on **Developer mode** in the top right.
4. Click **Load unpacked** and select the `tabvault` folder (the one containing `manifest.json`).
5. Pin the Tab Vault icon to your toolbar for quick access.

## Usage

### Popup

Click the toolbar icon to:

- **Save all windows** or **Save this window** (optionally type a name first)
- **Close duplicate tabs**
- **Open manager**
- Click any of your five most recent sessions to restore it

### Manager

Open the full manager from the popup. Browse sessions in the sidebar, filter by `all`, `manual`, `auto`, `closed`, or `pinned`, and select one to view, edit, or restore it.

### Keyboard shortcut and context menu

| Action | How |
| --- | --- |
| Save all windows | `Alt+Shift+S` (change it at `chrome://extensions/shortcuts`) |
| Stash current tab (save and close) | Right-click the page or the toolbar icon, then **Stash this tab** |
| Focus search in the manager | `/` |

## Settings

Open the manager and click **Settings**.

| Setting | Default | Description |
| --- | --- | --- |
| Auto-save every (minutes) | 5 | How often to check for changes and snapshot |
| Auto-saves to keep | 10 | Older auto-saves are pruned (pinned ones are kept) |
| Closed windows to keep | 20 | Older closed-window saves are pruned (pinned ones are kept) |
| Save windows when closed | On | Enables closed window recovery |
| Restore lazily by default | On | Discards restored tabs until you open them |
| Store public IP address | Off | Records your public IP with each session (see Privacy) |
| Warn if browser, system or IP differs | On | Confirms before restoring a session saved elsewhere |
| Theme | auto | auto, light, or dark |

## Privacy

- **Your data stays on your machine.** Sessions are kept in `chrome.storage.local`. Nothing is uploaded, and there is no account, analytics, or telemetry.
- **The one network request** is optional. If you turn on **Store public IP address**, Tab Vault looks up your public IP through [api64.ipify.org](https://www.ipify.org/), a third-party service, and saves it with each session so it can warn you if you restore from a different network. It is off by default.
- **Pages Tab Vault ignores**: `chrome://newtab`, `about:blank`, `chrome-extension:` and `devtools:` URLs are never saved.

### About password locks

Locking a session encrypts its **tab titles and URLs**. The session name, tags, notes, tab count, and window count are **not** encrypted. Locked sessions can't be searched by tab content. A password can't be recovered if you forget it. Unlocked contents are held in memory only and re-hidden after 5 minutes.

Auto-saves and closed-window saves are not encrypted unless you lock them yourself.

## Permissions

| Permission | Why it's needed |
| --- | --- |
| `tabs` | Read tab URLs and titles; create, close, and discard tabs |
| `tabGroups` | Save and recreate tab groups |
| `storage`, `unlimitedStorage` | Store sessions locally without hitting the default quota |
| `alarms` | Schedule auto-saves |
| `contextMenus` | The "Stash this tab" menu item |
| `https://api64.ipify.org/*` | Optional public IP lookup (only used if you enable it) |

## Project structure

```
tabvault/
├── manifest.json     # Extension manifest (MV3)
├── background.js     # Service worker: auto-save, closed window cache, restore, shortcuts, context menu
├── lib.js            # Shared helpers: storage, session capture, encryption, environment detection
├── popup.html / .js  # Toolbar popup
├── manager.html / .js# Full session manager UI
├── style.css         # Shared styles
└── icons/            # Extension icons
```

## Data format

Exports are JSON arrays of sessions. A session looks roughly like this:

```json
{
  "id": "lx3k9abcd",
  "name": "Research",
  "created": 1767225600000,
  "type": "manual",
  "pinned": false,
  "tags": ["work"],
  "note": "",
  "windows": [
    {
      "tabs": [
        { "url": "https://example.com", "title": "Example", "pinned": false, "fav": "", "group": -1 }
      ],
      "groups": {}
    }
  ],
  "env": { "browser": "Chrome", "version": "130", "os": "macOS", "ip": null }
}
```

`type` is one of `manual`, `auto`, or `closed`. Locked sessions replace `windows` with an `enc` object (`salt`, `iv`, `ct`).

## Limitations

- Chromium browsers only (uses `chrome.tabGroups`).
- Only normal windows are saved, not popups or app windows.
- Tab scroll position, form data, and back/forward history aren't saved, just the URL, title, pin state, and group.
- Closed window recovery relies on a cache that lives in session storage, so a window closed at the same moment the browser quits may not be captured.

## License

Add a license of your choice (for example [MIT](https://choosealicense.com/licenses/mit/)).
