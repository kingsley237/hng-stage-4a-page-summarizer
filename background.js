const CACHE_KEY_PREFIX = 'summary_cache_';
const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SUMMARIZE') {
    handleSummarize(message.payload).then(sendResponse);
    return true; // keep channel open for async response
  }

  if (message.type === 'CLEAR_CACHE') {
    clearCache(message.payload.url).then(sendResponse);
    return true;
  }

  if (message.type === 'GET_CACHE') {
    getCached(message.payload.url).then(data => {
      sendResponse(data ? { success: true, data } : { success: false });
    });
    return true;
  }

  if (message.type === 'GET_CACHE') {
    getCached(message.payload.url).then(data => {
      sendResponse(data ? { success: true, data } : { success: false });
    });
    return true;
  }

  if (message.type === 'GET_CACHE') {
    getCached(message.payload.url).then(data => {
      sendResponse(data ? { success: true, data } : { success: false });
    });
    return true;
  }
});

async function handleSummarize({ url, content, title }) {
  try {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey || apiKey.trim() === '') {
      return {
        success: false,
        error: 'NO_API_KEY',
        message: 'No API key set. Please open the extension options and enter your Gemini API key.'
      };
    }

    const summary = await callGemini(apiKey.trim(), content, title);
    await setCached(url, summary);
    return { success: true, data: summary, fromCache: false };
  } catch (err) {
    return {
      success: false,
      error: 'API_ERROR',
      message: err.message || 'An unexpected error occurred. Please try again.'
    };
  }
}

async function callGemini(apiKey, content, title) {
  const truncated = content.slice(0, 12000);

  const prompt = `You are a precise, helpful assistant that summarizes web pages.

Page title: "${title}"

Page content:
${truncated}

Respond with ONLY valid JSON in this exact structure, no markdown, no code fences:
{
  "summary": ["bullet point 1", "bullet point 2", "bullet point 3", "bullet point 4", "bullet point 5"],
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "readingTimeMinutes": 4,
  "topic": "brief topic label"
}

Rules:
- summary: 4 to 6 bullet points, each a complete sentence capturing the main ideas
- keyInsights: exactly 3 notable takeaways or implications
- readingTimeMinutes: integer, estimated time to read the full original page
- topic: 2 to 4 word label for the page subject
- Be factual, concise, and neutral
- Do not include any text outside the JSON object`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024
        }
      })
    }
  );

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const errMsg = errBody?.error?.message || `API request failed with status ${response.status}`;

    if (response.status === 400) throw new Error('Invalid API key or request. Check your key in Options.');
    if (response.status === 429) throw new Error('Rate limit reached. Please wait a moment and try again.');
    if (response.status === 403) throw new Error('API key does not have permission. Check your Google AI Studio key.');
    throw new Error(errMsg);
  }

  const data = await response.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!raw) throw new Error('No response from AI. The page content may be too short or unsupported.');

  // strip any accidental markdown fences
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned an unexpected format. Please try again.');
  }

  // validate shape
  if (!Array.isArray(parsed.summary) || !Array.isArray(parsed.keyInsights)) {
    throw new Error('AI returned incomplete data. Please try again.');
  }

  return parsed;
}

async function getCached(url) {
  const key = CACHE_KEY_PREFIX + btoa(url).slice(0, 60);
  const result = await chrome.storage.local.get(key);
  const entry = result[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_EXPIRY_MS) {
    await chrome.storage.local.remove(key);
    return null;
  }
  return entry.data;
}

async function setCached(url, data) {
  const key = CACHE_KEY_PREFIX + btoa(url).slice(0, 60);
  await chrome.storage.local.set({
    [key]: { data, timestamp: Date.now() }
  });
}

async function clearCache(url) {
  const key = CACHE_KEY_PREFIX + btoa(url).slice(0, 60);
  await chrome.storage.local.remove(key);
  return { success: true };
}