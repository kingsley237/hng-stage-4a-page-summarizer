document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadSavedKey();

  document.getElementById('saveBtn').addEventListener('click', saveKey);
  document.getElementById('clearKeyBtn').addEventListener('click', clearKey);
  document.getElementById('clearAllCacheBtn').addEventListener('click', clearAllCache);
  document.getElementById('toggleVisibility').addEventListener('click', toggleVisibility);

  document.getElementById('apiKeyInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveKey();
  });
}

async function loadSavedKey() {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (apiKey) {
    document.getElementById('apiKeyInput').value = apiKey;
  }
}

async function saveKey() {
  const input = document.getElementById('apiKeyInput');
  const key = input.value.trim();

  if (!key) {
    showStatus('statusMsg', 'Please enter an API key.', 'error');
    input.focus();
    return;
  }

  if (!key.startsWith('AIza') || key.length < 20) {
    showStatus('statusMsg', 'That does not look like a valid Gemini API key. It should start with "AIza".', 'error');
    input.focus();
    return;
  }

  await chrome.storage.local.set({ apiKey: key });
  showStatus('statusMsg', 'API key saved successfully.', 'success');
}

async function clearKey() {
  await chrome.storage.local.remove('apiKey');
  document.getElementById('apiKeyInput').value = '';
  showStatus('statusMsg', 'API key removed.', 'success');
}

async function clearAllCache() {
  const all = await chrome.storage.local.get(null);
  const cacheKeys = Object.keys(all).filter(k => k.startsWith('summary_cache_'));
  if (cacheKeys.length === 0) {
    showStatus('cacheStatus', 'No cached summaries found.', 'success');
    return;
  }
  await chrome.storage.local.remove(cacheKeys);
  showStatus('cacheStatus', `Cleared ${cacheKeys.length} cached summary${cacheKeys.length > 1 ? 's' : ''}.`, 'success');
}

function toggleVisibility() {
  const input = document.getElementById('apiKeyInput');
  const btn = document.getElementById('toggleVisibility');
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  btn.setAttribute('aria-label', isPassword ? 'Hide API key' : 'Show API key');
  btn.querySelector('svg').innerHTML = isPassword
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
}

function showStatus(id, message, type) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.className = `status ${type}`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.className = 'status hidden';
  }, 4000);
}