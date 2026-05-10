import { parsePastedHtml } from './parser.js';
import { computeDiff } from './differ.js';
import { renderPanes, renderMetadata, renderStatus } from './renderer.js';
import {
  listSavedComparisons,
  saveComparison,
  loadComparison,
  deleteComparison,
} from './storage.js';

const SAMPLE_HTML = `<table><tr>
  <td class="track-changes-diff track-changes-diff--old">
    <table>
      <tr>
        <td class="generic_desc"><p>Page No.</p></td>
        <td class="generic_action">1</td>
      </tr>
      <tr>
        <td class="generic_desc"><p>Image</p></td>
        <td class="generic_action">
          <img name="imageURL" src="https://example.com/old-image.jpg" class="img_preview" alt="Selected Image">
        </td>
      </tr>
      <tr>
        <td class="generic_desc"><p>Title</p></td>
        <td class="generic_action">Welcome to the Department of Examples</td>
      </tr>
      <tr>
        <td class="generic_desc"><p>Description</p></td>
        <td class="generic_action">
          <p>The department offers <span class="diffRemoved">a wide range of </span>undergraduate courses in example studies.</p>
          <h2>Our research</h2>
          <p>Our research focuses on theoretical frameworks.</p>
          <div class="uol-in-text-ctas-wrapper">
            <div class="uol-in-text-cta">
              <p class="uol-in-text-cta__heading"><a class="uol-in-text-cta__link" href="https://example.com/old-cta">Apply now for the 2024 intake</a></p>
              <p class="uol-in-text-cta__text">Visit the application page to begin your journey.</p>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </td>
  <td class="track-changes-diff">
    <table>
      <tr>
        <td class="generic_desc"><p>Page No.</p></td>
        <td class="generic_action">1</td>
      </tr>
      <tr>
        <td class="generic_desc"><p>Image</p></td>
        <td class="generic_action">
          <img name="imageURL" src="https://example.com/new-image.jpg" class="img_preview" alt="Selected Image">
        </td>
      </tr>
      <tr>
        <td class="generic_desc"><p>Title</p></td>
        <td class="generic_action">Welcome to the Department of Examples (Updated)</td>
      </tr>
      <tr>
        <td class="generic_desc"><p>Description</p></td>
        <td class="generic_action">
          <p>The department offers undergraduate courses in example studies<span class="diffAdded">, with a strong emphasis on practical application</span>.</p>
          <h2>Our research</h2>
          <p>Our research focuses on theoretical frameworks.</p>
          <div class="uol-in-text-ctas-wrapper">
            <div class="uol-in-text-cta">
              <p class="uol-in-text-cta__heading"><a class="uol-in-text-cta__link" href="https://example.com/new-cta">Browse our open days to find out more</a></p>
              <p class="uol-in-text-cta__text">Find out about our programmes by visiting on an open day.</p>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr></table>`;

const els = {
  htmlInput: document.getElementById('html-input'),
  compareBtn: document.getElementById('compare-btn'),
  loadSampleBtn: document.getElementById('load-sample-btn'),
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

els.loadSampleBtn.addEventListener('click', () => {
  els.htmlInput.value = SAMPLE_HTML;
});

els.clearBtn.addEventListener('click', () => {
  els.htmlInput.value = '';
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

function showError(message) {
  currentDiff = null;
  currentRawHtml = null;
  currentTitle = '';
  els.saveBtn.disabled = true;
  els.metadata.hidden = true;
  els.paneOld.innerHTML = `<p class="pane-error"></p>`;
  els.paneNew.innerHTML = `<p class="pane-error"></p>`;
  els.paneOld.querySelector('.pane-error').textContent = message;
  els.paneNew.querySelector('.pane-error').textContent = message;
  els.status.hidden = false;
  els.statusText.textContent = 'Error';
}
