const STORAGE_KEY = 'jadu-diff-saved-comparisons';
const MAX_ITEMS = 20;

export function listSavedComparisons() {
  return readAll();
}

export function saveComparison({ rawHtml, title }) {
  if (typeof rawHtml !== 'string' || rawHtml.trim() === '') {
    throw new Error('Cannot save: no HTML to save.');
  }
  const all = readAll();
  const entry = {
    id: makeId(),
    savedAt: new Date().toISOString(),
    title: title && title.trim() ? title.trim() : '(no title)',
    rawHtml,
  };
  const next = [entry, ...all].slice(0, MAX_ITEMS);
  writeAll(next);
  return entry;
}

export function loadComparison(id) {
  return readAll().find((c) => c.id === id) || null;
}

export function deleteComparison(id) {
  const next = readAll().filter((c) => c.id !== id);
  writeAll(next);
}

export function clearAllComparisons() {
  writeAll([]);
}

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    if (e && e.name === 'QuotaExceededError') {
      throw new Error(
        'Browser storage is full. Delete some saved comparisons and try again.'
      );
    }
    throw e;
  }
}

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
