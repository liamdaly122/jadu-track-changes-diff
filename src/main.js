import { parsePastedHtml } from './parser.js';
import { computeDiff } from './differ.js';
import { renderPanes, renderMetadata, renderStatus } from './renderer.js';
import {
  listSavedComparisons,
  saveComparison,
  loadComparison,
  deleteComparison,
} from './storage.js';

const els = {
  htmlInput: document.getElementById('html-input'),
  compareBtn: document.getElementById('compare-btn'),
  clearBtn: document.getElementById('clear-btn'),
  saveBtn: document.getElementById('save-btn'),
  highlightToggle: document.getElementById('highlight-toggle'),
  renderedToggle: document.getElementById('rendered-toggle'),
  metadata: document.querySelector('.metadata'),
  oldTitle: document.getElementById('old-title'),
  newTitle: document.getElementById('new-title'),
  oldImage: document.getElementById('old-image'),
  newImage: document.getElementById('new-image'),
  status: document.getElementById('status'),
  statusText: document.getElementById('status-text'),
  paneOld: document.getElementById('pane-old'),
  paneNew: document.getElementById('pane-new'),
  sidebarEmpty: document.querySelector('.sidebar-empty'),
  savedList: document.querySelector('.saved-list'),
};

const metadataEls = {
  container: els.metadata,
  oldTitle: els.oldTitle,
  newTitle: els.newTitle,
  oldImage: els.oldImage,
  newImage: els.newImage,
};

const statusEls = {
  container: els.status,
  text: els.statusText,
};

const paneEls = {
  oldPane: els.paneOld,
  newPane: els.paneNew,
};

let currentDiff = null;
let currentRawHtml = null;
let currentTitle = '';

renderSavedList();

els.clearBtn.addEventListener('click', () => {
  els.htmlInput.value = '';
  resetComparisonView();
  els.htmlInput.focus();
});

els.compareBtn.addEventListener('click', () => {
  runCompare(els.htmlInput.value);
});

els.saveBtn.addEventListener('click', () => {
  if (!currentRawHtml) return;
  try {
    saveComparison({ rawHtml: currentRawHtml, title: currentTitle });
    renderSavedList();
    flashSaveButton('Saved ✓');
  } catch (e) {
    showError(e.message);
  }
});

els.highlightToggle.addEventListener('change', rerenderPanes);
els.renderedToggle.addEventListener('change', rerenderPanes);

function runCompare(raw) {
  if (!raw.trim()) {
    showError('Paste some HTML first.');
    return;
  }
  try {
    const parsed = parsePastedHtml(raw);
    currentDiff = computeDiff(
      parsed.oldVersion.blocks,
      parsed.newVersion.blocks
    );
    currentRawHtml = raw;
    currentTitle = parsed.newVersion.title || parsed.oldVersion.title || '';
    renderMetadata(metadataEls, parsed.oldVersion, parsed.newVersion);
    renderStatus(statusEls, currentDiff);
    rerenderPanes();
    els.saveBtn.disabled = false;
  } catch (e) {
    showError(e.message);
  }
}

function rerenderPanes() {
  if (!currentDiff) return;
  renderPanes(paneEls, currentDiff, {
    highlight: els.highlightToggle.checked,
    rendered: els.renderedToggle.checked,
  });
}

function renderSavedList() {
  const list = listSavedComparisons();
  els.savedList.innerHTML = '';
  if (list.length === 0) {
    els.savedList.hidden = true;
    els.sidebarEmpty.hidden = false;
    return;
  }
  els.sidebarEmpty.hidden = true;
  els.savedList.hidden = false;
  for (const item of list) {
    els.savedList.appendChild(buildSavedItem(item));
  }
}

function buildSavedItem(item) {
  const li = document.createElement('li');
  li.className = 'saved-item';

  const loadBtn = document.createElement('button');
  loadBtn.type = 'button';
  loadBtn.className = 'saved-item__load';
  loadBtn.title = `${item.title} · ${formatDate(item.savedAt)}`;

  const titleEl = document.createElement('span');
  titleEl.className = 'saved-item__title';
  titleEl.textContent = item.title;

  const dateEl = document.createElement('span');
  dateEl.className = 'saved-item__date';
  dateEl.textContent = formatDate(item.savedAt);

  loadBtn.appendChild(titleEl);
  loadBtn.appendChild(dateEl);
  loadBtn.addEventListener('click', () => loadSavedItem(item.id));

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'saved-item__delete';
  delBtn.setAttribute('aria-label', `Delete saved comparison: ${item.title}`);
  delBtn.textContent = '×';
  delBtn.addEventListener('click', () => deleteSavedItem(item.id));

  li.appendChild(loadBtn);
  li.appendChild(delBtn);
  return li;
}

function loadSavedItem(id) {
  const entry = loadComparison(id);
  if (!entry) return;
  els.htmlInput.value = entry.rawHtml;
  runCompare(entry.rawHtml);
}

function deleteSavedItem(id) {
  deleteComparison(id);
  renderSavedList();
}

function flashSaveButton(text) {
  const original = els.saveBtn.textContent;
  els.saveBtn.textContent = text;
  els.saveBtn.disabled = true;
  setTimeout(() => {
    els.saveBtn.textContent = original;
    els.saveBtn.disabled = false;
  }, 1200);
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function resetComparisonView() {
  currentDiff = null;
  currentRawHtml = null;
  currentTitle = '';
  els.saveBtn.disabled = true;
  els.metadata.hidden = true;
  els.status.hidden = true;
  els.paneOld.innerHTML =
    '<p class="pane-empty">Paste HTML and click Compare.</p>';
  els.paneNew.innerHTML =
    '<p class="pane-empty">Paste HTML and click Compare.</p>';
}

function showError(message) {
  resetComparisonView();
  els.paneOld.innerHTML = `<p class="pane-error"></p>`;
  els.paneNew.innerHTML = `<p class="pane-error"></p>`;
  els.paneOld.querySelector('.pane-error').textContent = message;
  els.paneNew.querySelector('.pane-error').textContent = message;
  els.status.hidden = false;
  els.statusText.textContent = 'Error';
}
