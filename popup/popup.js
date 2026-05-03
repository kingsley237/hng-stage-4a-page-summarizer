let currentTab = null;
let currentSummary = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  const titleEl = document.getElementById('pageTitle');
  if (tab?.title) {
    titleEl.textContent = tab.title;
    titleEl.title = tab.title;
  }

  document.getElementById('summarizeBtn').addEventListener('click', startSummarize);
  document.getElementById('retryBtn').addEventListener('click', startSummarize);
  document.getElementById('refreshBtn').addEventListener('click', startRefresh);
  document.getElementById('clearBtn').addEventListener('click', showIdle);
  document.getElementById('copyBtn').addEventListener('click', copySummary);
  document.getElementById('optionsBtn').addEventListener('click', openOptions);
  document.getElementById('openOptionsBtn').addEventListener('click', openOptions);

  // try to load existing cached summary for this tab on popup open
  await tryLoadCached();
}

async function tryLoadCached() {
  if (!currentTab?.url) {
    showIdle();
    return;
  }

  try {
    const result = await chrome.runtime.sendMessage({
      type: 'GET_CACHE',
      payload: { url: currentTab.url }
    });

    if (result?.success && result?.data) {
      currentSummary = result.data;
      showResult(result.data, true);
    } else {
      showIdle();
    }
  } catch {
    showIdle();
  }
}

async function showIdle() {
  currentSummary = null;
  if (currentTab?.url) {
    await chrome.runtime.sendMessage({
      type: 'CLEAR_CACHE',
      payload: { url: currentTab.url }
    });
  }
  showState('stateIdle');
}

async function startSummarize() {
  await summarize(false);
}

async function startRefresh() {
  await summarize(true);
}

async function summarize(forceRefresh) {
  if (!currentTab?.id) return;

  showState('stateLoading');
  setLoadingStep(1);

  let content = '';
  let title = currentTab.title || '';

  try {
    const response = await chrome.tabs.sendMessage(currentTab.id, { type: 'EXTRACT_CONTENT' });
    content = response?.content || '';
    title = response?.title || title;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        files: ['content.js']
      });
      const response = await chrome.tabs.sendMessage(currentTab.id, { type: 'EXTRACT_CONTENT' });
      content = response?.content || '';
      title = response?.title || title;
    } catch {
      showError('This page cannot be summarized. Try an article or blog post.');
      return;
    }
  }

  if (!content || content.trim().length < 100) {
    showError('Not enough text found on this page to summarize.');
    return;
  }

  setLoadingStep(2);

  if (forceRefresh) {
    await chrome.runtime.sendMessage({
      type: 'CLEAR_CACHE',
      payload: { url: currentTab.url }
    });
  }

  setLoadingStep(3);

  const result = await chrome.runtime.sendMessage({
    type: 'SUMMARIZE',
    payload: { url: currentTab.url, content, title }
  });

  if (!result.success) {
    if (result.error === 'NO_API_KEY') {
      showError('No API key set. Click "Open Settings" to add your Gemini API key.');
    } else {
      showError(result.message || 'Something went wrong. Please try again.');
    }
    return;
  }

  currentSummary = result.data;
  // fresh generation — never show cache badge
  showResult(result.data, false);
}

function showResult(data, fromCache) {
  showState('stateResult');

  document.getElementById('topicBadge').textContent = data.topic || 'Summary';

  const cacheEl = document.getElementById('cacheBadge');
  if (fromCache) {
    cacheEl.classList.remove('hidden');
  } else {
    cacheEl.classList.add('hidden');
  }

  const mins = data.readingTimeMinutes || 1;
  document.getElementById('readingTimeText').textContent = `${mins} min read`;

  const summaryList = document.getElementById('summaryList');
  summaryList.innerHTML = '';
  for (const point of data.summary) {
    const li = document.createElement('li');
    li.textContent = point;
    summaryList.appendChild(li);
  }

  const insightsList = document.getElementById('insightsList');
  insightsList.innerHTML = '';
  for (const insight of data.keyInsights) {
    const li = document.createElement('li');
    li.textContent = insight;
    insightsList.appendChild(li);
  }
}

function showError(message) {
  showState('stateError');
  document.getElementById('errorMessage').textContent = message;
}

function showState(id) {
  const states = ['stateIdle', 'stateLoading', 'stateError', 'stateResult'];
  for (const s of states) {
    const el = document.getElementById(s);
    if (el) el.classList.toggle('hidden', s !== id);
  }
}

function setLoadingStep(step) {
  const steps = ['step1', 'step2', 'step3'];
  const labels = ['Extracting page content...', 'Sending to AI...', 'Building summary...'];

  const loadingText = document.getElementById('loadingText');
  if (loadingText) loadingText.textContent = labels[step - 1] || '';

  steps.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (i + 1 < step) el.classList.add('done');
    else if (i + 1 === step) el.classList.add('active');
  });
}

async function copySummary() {
  if (!currentSummary) return;

  const lines = [
    `PageBrief Summary: ${currentTab?.title || ''}`,
    '',
    'Summary:',
    ...currentSummary.summary.map(p => `• ${p}`),
    '',
    'Key Insights:',
    ...currentSummary.keyInsights.map(p => `• ${p}`),
    '',
    `Reading time: ~${currentSummary.readingTimeMinutes} min`
  ];

  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    const btn = document.getElementById('copyBtn');
    btn.classList.add('btn-copy-success');
    btn.textContent = 'Copied!';
    setTimeout(() => {
      btn.classList.remove('btn-copy-success');
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    }, 2000);
  } catch {
    const btn = document.getElementById('copyBtn');
    btn.textContent = 'Failed';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  }
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}