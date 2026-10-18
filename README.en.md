# SafeShot Secure Screenshot Assistant (Zero-Dependency Edition)

[中文版](README.md) · [Privacy Policy / 隐私政策](https://xuhongwang.github.io/safeshot/privacy.html)

A privacy-first browser screenshot extension. Visually select or auto-detect sensitive information on a page, redact it, then capture — **copying to the clipboard first** (automatically falling back to download if the copy fails), so sensitive content never touches the disk.

**Zero dependencies**: no external libraries, no CDN, no network requests. All code runs locally.

---

## ✨ Features

- **Three ways to launch**: toolbar button, context menu, and keyboard shortcut (default `Alt+Shift+S`, customizable on the settings page)
- **Visual redaction overlay**: see the mask effect directly on the page; drag to add masks, click an existing mask to remove it
- **Auto scanning**: detects password fields, API keys, JWTs, phone numbers (with spaces/dashes/international format), emails, internal IPv4/IPv6 addresses, database connection strings, private keys (RSA/EC/DSA/PGP/OpenSSH), and more
- **Password field tracking**: uses MutationObserver to track password inputs, so they remain detectable after toggling visibility
- **Input value scanning**: sensitive data in input fields (complete emails, phone numbers, JWTs, API keys, etc.) is also masked
- **Mask styles**: mosaic (adjustable block size) or solid color (pick your color), composited onto the final screenshot
- **Full-page capture**: supports long pages via scroll-and-stitch screenshot
- **Copy straight to the clipboard**: confirmed = copied, works on both HTTPS and HTTP pages; falls back to downloading a PNG if the copy fails
- **Overlay shortcuts**: `Enter` to confirm, `Esc` to cancel
- **Custom regex rules**: add your own sensitive-information detection rules
- **Domain whitelist**: whitelisted sites skip scanning and capture directly
- **Auto-scan toggle**: when off, you can still capture and mask manually — only automatic detection is skipped
- **Original-resolution export**: screenshots are generated at the page's native resolution, not a preview thumbnail
- **Bilingual UI**: interface, prompts, and error messages in Chinese/English, follows browser language by default, manually configurable in settings

---

## 🚀 Installation (Chrome / Edge)

1. Download and extract this project to a local folder
2. Open the extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. Enable **Developer mode** in the top-right corner
4. Click **Load unpacked** and select the `safeshot` folder
5. The scissors icon appears in the toolbar

---

## 📖 Usage

### Redacted screenshot

1. Open the web page you want to capture
2. Click the SafeShot icon in the toolbar → **📷 Redact & Capture** (or use the context menu / press `Alt+Shift+S`)
3. The mask overlay appears on the page: regions matched by auto-scan are already covered
4. Drag to add extra masks; click a mask to remove it
5. Press `Enter` or click **Capture** → the screenshot is copied to the clipboard; press `Esc` or **Cancel** to discard
6. The result is reported via a page toast; if the clipboard is unavailable, a PNG is downloaded instead

### Settings

Click the extension icon → **⚙️ Settings**:

- **Enable auto scan**: when on, sensitive information is detected and masked before capture; when off, you can still capture and mask manually
- **Domain whitelist**: whitelisted sites skip scanning and copy directly
- **Mask style**: mosaic (block size 4–32px) / solid color (custom color)
- **Custom regex rules**: add regular expressions to detect specific sensitive information
- **Shortcut**: shows the current key binding; click **Change** to jump to Chrome's shortcut settings page (`chrome://extensions/shortcuts`)

### Result feedback

A toast at the bottom of the page reports the outcome:

- `Copied to clipboard` — success
- `Screenshot downloaded [mode=...]` — the clipboard failed and it fell back to a download; the brackets contain diagnostics (the path taken and the reason for the failure)
- On restricted pages (`chrome://` etc.) where an in-page toast cannot be injected, the extension icon shows a red `!` badge; hover to see the reason

---

## 🔒 Privacy

- All detection and redaction compositing happens locally
- No external requests, no data upload
- The original screenshot is held in memory only briefly during processing and released immediately afterwards; the download fallback only triggers when the copy fails

---

## ⚠️ Known limitations

- Cannot capture built-in browser pages (`chrome://`, `edge://`)
- Cross-origin iframes, canvas-rendered text, and system-level dialogs cannot be scanned
- The clipboard may be unavailable in headless browsers or unfocused windows (it automatically falls back to a download)
- The shortcut cannot be changed by typing inside the extension (Chrome API limitation) — use the browser's shortcut settings page
- **Showing the password before capturing may not result in redaction**: some websites (e.g., Vue/Element UI) rebuild the input DOM node when toggling password visibility, causing auto-tracking to fail. Recommended to **switch the password back to hidden state before capturing** (then manually show it after redaction), or **manually drag a mask over the password area** in the overlay

---

## 📁 Project structure

```
safeshot-lite/
├── manifest.json       # Extension config (Manifest V3): permissions, shortcuts, resources
├── i18n.js             # Bilingual dictionary (zh/en) + language resolution shared by all contexts
├── background.js       # Background: flow orchestration, capture, clipboard/download fallback, messaging
├── content-scan.js     # Page scanning, mask overlay, image compositing, copy chain
├── main-world.js       # MAIN world: navigator.clipboard write on HTTPS pages
├── clip.html / clip.js # Extension iframe clipboard fallback for HTTP pages
├── offscreen.html/js   # Offscreen clipboard fallback
├── rules.js            # Sensitive-information rule library
├── popup.html/css/js   # Popup: status + settings (scan / whitelist / mask style / language / shortcut)
├── _locales/           # Manifest strings (zh_CN, en), following the browser UI language
└── icons/              # Extension icons (16/48/128)
```

### Language selection

The UI language is resolved in this order:

1. The in-extension setting (**Settings → Language**): `Auto` / `中文` / `English`
2. When set to `Auto`, the browser UI language (`chrome.i18n.getUILanguage()`) decides — `zh*` → Chinese, anything else → English

The manifest name and description shown on `chrome://extensions` are localized separately by Chrome via `_locales`, and always follow the browser UI language.

---