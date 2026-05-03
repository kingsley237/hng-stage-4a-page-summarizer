# PageBrief : AI Page Summarizer Chrome Extension

A Manifest V3 Chrome Extension that extracts content from any webpage and uses Google Gemini AI to generate a structured summary with bullet points, key insights, and estimated reading time.

---

## Features

- One-click page summarization
- Bullet-point summary and key insights
- Estimated reading time
- 30-minute per-URL summary cache (avoids duplicate API calls)
- Copy summary to clipboard
- Force-refresh to bypass cache
- Clean, accessible popup UI with loading states and error handling
- Settings page for secure API key management
- No API key ever committed to source code

---

## Installation

This extension is not published to the Chrome Web Store. Install it locally in Developer Mode.

### Prerequisites

- Google Chrome (version 88 or later)
- A free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### Steps

1. **Download the extension**

   Clone or download this repository:

```bash
   git clone https://github.com/kingsley237/hng-stage-4a-page-summarizer.git
```

2. **Open Chrome Extensions**

   Navigate to `chrome://extensions` in your browser.

3. **Enable Developer Mode**

   Toggle **Developer mode** on (top-right corner of the extensions page).

4. **Load the extension**

   Click **Load unpacked** and select the root folder of this repository (the folder containing `manifest.json`).

5. **Pin the extension** (recommended)

   Click the puzzle piece icon in the Chrome toolbar, find **PageBrief**, and click the pin icon.

6. **Add your API key**

   - Right-click the PageBrief icon and choose **Options**, or click the gear icon inside the popup.
   - Paste your Gemini API key (starts with `AIza`).
   - Click **Save Key**.

7. **Use the extension**

   Navigate to any article, blog post, or documentation page. Click the PageBrief icon and press **Summarize Page**.

---

## Getting a Gemini API Key

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with a Google account
3. Click **Create API Key**
4. Copy the key
5. Paste it into PageBrief's Settings page

The free tier has generous daily limits and requires no credit card.

---

## Architecture
page-summarizer/
├── manifest.json          : MV3 config, permissions, entry points
├── background.js          : Service worker: API calls, caching, message handling
├── content.js             : Content script: page content extraction
├── popup/
│   ├── popup.html         : Popup UI markup
│   ├── popup.js           : Popup logic and message passing
│   └── popup.css          : Popup styles
├── options/
│   ├── options.html       : Settings page markup
│   ├── options.js         : API key save/load/clear logic
│   └── options.css        : Settings page styles
└── icons/                 : Extension icons (16, 32, 48, 128px)

### Message flow
Popup → content script: { type: 'EXTRACT_CONTENT' }
Content script → Popup: { title, content, wordCount }
Popup → background service worker: { type: 'SUMMARIZE', payload: { url, content, title } }
Background service worker → Gemini API: fetch (secure, key never in popup)
Background service worker → Popup: { success, data, fromCache }

### Content extraction

`content.js` uses a priority-ordered selector list to find the main article content:
- Prefers semantic elements: `article`, `[role="main"]`, `main`
- Falls back to common CMS class names: `.post-content`, `.article-body`, etc.
- Final fallback: scores `<p>`, `<h1>`–`<h4>`, `<li>` elements from the body after stripping nav, header, footer, sidebar, and ad nodes
- Truncates to 15,000 characters before sending to background

### Caching

Summaries are cached in `chrome.storage.local` with a 30-minute TTL per URL. Cache keys are prefixed `summary_cache_` followed by a base64-encoded URL fragment. The Refresh button clears the cache entry for the current URL before re-summarizing.

---

## AI Integration

- **Provider:** Google Gemini (`gemini-2.0-flash`)
- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- **Where the call happens:** Exclusively in `background.js` (the service worker)
- **Prompt:** Instructs Gemini to return strict JSON with `summary` (array), `keyInsights` (array), `readingTimeMinutes` (integer), and `topic` (string)
- **Response handling:** Strips accidental markdown fences, validates JSON shape before returning to popup

---

## Security Decisions

| Decision | Reason |
|---|---|
| API key stored in `chrome.storage.local` only | Never in source code, never committed, never visible in popup JS |
| All API calls made in `background.js` only | Popup cannot access the key directly |
| Key never passed in messages | Background reads key itself from storage on each request |
| `.gitignore` excludes any local config files | Prevents accidental secret commits |
| `host_permissions` scoped to Gemini API domain only | Minimal permission surface |
| Content script uses `cloneNode` before DOM manipulation | No side effects on the live page |
| Summary content set via `textContent` only | Prevents XSS from AI-generated output |

---

## Trade-offs

| Trade-off | Decision made | Reason |
|---|---|---|
| Local key vs. proxy server | Local key in `chrome.storage.local` | No backend required; standard pattern for local extensions; key is user-owned |
| Gemini vs. OpenAI | Gemini `gemini-2.0-flash` | Free tier, no credit card, easy for reviewers to test |
| Side panel vs. popup | Popup | Simpler, no extra permissions, matches task spec |
| Full readability parser vs. heuristics | Heuristics | No build step required; works well on most article pages |
| Cache duration | 30 minutes | Balances freshness with API cost savings |

---

## Demo Video

[Watch the demo](https://www.loom.com/share/839eea2a3a8541f18b98ae9b01f78b67) 

---

## Permissions Used

| Permission | Why |
|---|---|
| `activeTab` | Read the current tab's URL and title |
| `storage` | Store API key and summary cache locally |
| `scripting` | Inject content script if not already present |
| `host_permissions: generativelanguage.googleapis.com` | Allow background script to call Gemini API |