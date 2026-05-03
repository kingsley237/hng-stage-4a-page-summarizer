chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_CONTENT') {
    const result = extractPageContent();
    sendResponse(result);
  }
  return true;
});

function extractPageContent() {
  const title = document.title || '';

  // try to find the main article content first
  const content = extractMainContent();
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  return { title, content, wordCount };
}

function extractMainContent() {
  // priority order: semantic article elements, then main, then body fallback
  const candidates = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content-body',
    '.story-body',
    '.article-body',
    '#content',
    '#main-content',
    '.main-content'
  ];

  for (const selector of candidates) {
    const el = document.querySelector(selector);
    if (el) {
      const text = extractText(el);
      if (text.length > 200) return text;
    }
  }

  // fallback: strip nav/header/footer/sidebar from body
  return extractFromBody();
}

function extractText(el) {
  // clone so we can remove unwanted nodes without affecting page
  const clone = el.cloneNode(true);

  const noise = [
    'nav', 'header', 'footer', 'aside',
    'script', 'style', 'noscript',
    '.nav', '.navigation', '.menu', '.sidebar',
    '.advertisement', '.ad', '.ads',
    '.social-share', '.share-buttons',
    '.comments', '.comment-section',
    '[role="navigation"]', '[role="banner"]',
    '[role="complementary"]', '[role="contentinfo"]'
  ];

  for (const sel of noise) {
    clone.querySelectorAll(sel).forEach(n => n.remove());
  }

  return cleanText(clone.innerText || clone.textContent || '');
}

function extractFromBody() {
  const clone = document.body.cloneNode(true);

  const noise = [
    'nav', 'header', 'footer', 'aside',
    'script', 'style', 'noscript',
    '.nav', '.navigation', '.menu', '.sidebar',
    '.advertisement', '.ad', '.ads',
    '.social-share', '.related-posts',
    '.comments', '[role="navigation"]',
    '[role="banner"]', '[role="complementary"]',
    '[role="contentinfo"]'
  ];

  for (const sel of noise) {
    clone.querySelectorAll(sel).forEach(n => n.remove());
  }

  // score paragraphs by text density
  const paragraphs = clone.querySelectorAll('p, h1, h2, h3, h4, li');
  const chunks = [];

  for (const p of paragraphs) {
    const text = (p.innerText || p.textContent || '').trim();
    if (text.length > 40) chunks.push(text);
  }

  if (chunks.length > 0) {
    return cleanText(chunks.join('\n'));
  }

  return cleanText(clone.innerText || clone.textContent || '');
}

function cleanText(text) {
  return text
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 15000);
}