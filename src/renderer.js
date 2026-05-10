import {
  computeWordDiff,
  renderForOldSide,
  renderForNewSide,
} from './word-diff.js';

const LEEDS_FONTS_URL = 'https://use.typekit.net/xpd0xwa.css';
const LEEDS_CSS_URL = 'https://jaducdn.leeds.ac.uk/uol-ds/1.0.20/css/style.css';

const IFRAME_BASE_STYLES = `
  body {
    margin: 0;
    padding: 16px 20px;
    background: #ffffff;
  }
  .block {
    display: block;
    padding: 4px 10px;
    margin: 0 -10px 8px;
    border-left: 4px solid transparent;
    border-radius: 2px;
  }
  .block.added {
    background: #e6f4ea;
    border-left-color: #34a853;
  }
  .block.removed {
    background: #fce8e6;
    border-left-color: #d93025;
  }
  .block.modified {
    background: #fef7e0;
    border-left-color: #f9ab00;
  }
  .block > :first-child { margin-top: 0 !important; }
  .block > :last-child { margin-bottom: 0 !important; }
  ins.word-add {
    background: #c8e6c9;
    color: #0d4f1c;
    text-decoration: none;
    padding: 0 2px;
    border-radius: 2px;
  }
  del.word-del {
    background: #f9c8c5;
    color: #5c0e0a;
    text-decoration: line-through;
    padding: 0 2px;
    border-radius: 2px;
  }
`;

export function renderPanes(els, diff, options) {
  const opts = { highlight: true, rendered: true, wordDiff: false, ...options };
  renderEntries(els.oldPane, 'old', diff.oldEntries, opts);
  renderEntries(els.newPane, 'new', diff.newEntries, opts);
}

export function renderMetadata(els, oldVer, newVer) {
  els.container.hidden = false;
  els.oldTitle.textContent = oldVer.title || '—';
  els.newTitle.textContent = newVer.title || '—';
  els.oldImage.textContent = oldVer.imageUrl || '—';
  els.newImage.textContent = newVer.imageUrl || '—';

  const titleChanged = oldVer.title !== newVer.title;
  const imageChanged = oldVer.imageUrl !== newVer.imageUrl;
  els.oldTitle.classList.toggle('changed', titleChanged);
  els.newTitle.classList.toggle('changed', titleChanged);
  els.oldImage.classList.toggle('changed', imageChanged);
  els.newImage.classList.toggle('changed', imageChanged);
}

export function renderStatus(els, diff) {
  els.container.hidden = false;
  const c = diff.counts;
  els.text.textContent = `${c.added} added, ${c.removed} removed, ${c.modified} modified, ${c.unchanged} unchanged`;
}

function renderEntries(paneEl, paneId, entries, options) {
  paneEl.innerHTML = '';
  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'pane-empty';
    empty.textContent = 'No content.';
    paneEl.appendChild(empty);
    return;
  }
  if (options.rendered) {
    paneEl.appendChild(buildIframe(paneId, entries, options));
  } else {
    for (const entry of entries) {
      paneEl.appendChild(renderPlainBlock(entry, paneId, options));
    }
  }
}

function buildIframe(paneId, entries, options) {
  const blocksHtml = entries
    .map((e) => blockToIframeHtml(e, paneId, options))
    .join('\n');

  const srcdoc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<base target="_blank" rel="noopener noreferrer">
<link rel="stylesheet" href="${LEEDS_FONTS_URL}">
<link rel="stylesheet" href="${LEEDS_CSS_URL}">
<style>${IFRAME_BASE_STYLES}</style>
</head>
<body>
<div class="uol-rich-text uol-rich-text--with-lead">
${blocksHtml}
</div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.className = 'pane-iframe';
  iframe.dataset.pane = paneId;
  iframe.title =
    paneId === 'old' ? 'Old version preview' : 'New version preview';
  iframe.setAttribute(
    'sandbox',
    'allow-same-origin allow-popups allow-popups-to-escape-sandbox'
  );
  iframe.srcdoc = srcdoc;

  iframe.addEventListener('load', () => attachAutoResize(iframe));
  return iframe;
}

function blockToIframeHtml(entry, paneId, options) {
  const cls = options.highlight ? `block ${entry.type}` : 'block';
  const inner = shouldUseWordDiff(entry, options)
    ? `<p class="block-text">${wordDiffHtml(entry, paneId)}</p>`
    : entry.block.html;
  return `<div class="${cls}">${inner}</div>`;
}

function attachAutoResize(iframe) {
  let doc;
  try {
    doc = iframe.contentDocument;
  } catch {
    return;
  }
  if (!doc || !doc.documentElement) return;

  const update = () => {
    const h = doc.documentElement.scrollHeight;
    iframe.style.height = `${h + 4}px`;
  };
  update();

  try {
    const ro = new ResizeObserver(update);
    ro.observe(doc.documentElement);
    if (doc.body) ro.observe(doc.body);
  } catch {}
}

function renderPlainBlock(entry, paneId, options) {
  const wrapper = document.createElement('div');
  wrapper.className = options.highlight ? `block ${entry.type}` : 'block';
  const text = document.createElement('p');
  text.className = 'block-text';

  if (shouldUseWordDiff(entry, options)) {
    text.innerHTML = wordDiffHtml(entry, paneId);
  } else {
    text.textContent = entry.block.text || '(empty block)';
  }
  wrapper.appendChild(text);
  return wrapper;
}

function shouldUseWordDiff(entry, options) {
  return (
    options.wordDiff &&
    options.highlight &&
    entry.type === 'modified' &&
    !!entry.match
  );
}

function wordDiffHtml(entry, paneId) {
  const oldText = paneId === 'old' ? entry.block.text : entry.match.text;
  const newText = paneId === 'old' ? entry.match.text : entry.block.text;
  const ops = computeWordDiff(oldText, newText);
  return paneId === 'old' ? renderForOldSide(ops) : renderForNewSide(ops);
}
