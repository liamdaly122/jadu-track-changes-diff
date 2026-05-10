const BLOCK_SELECTORS = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'blockquote',
  'pre',
  'div.uol-accordion',
  'div.uol-in-text-cta',
  'div.uol-in-text-ctas-wrapper',
];

export function parsePastedHtml(rawHtml) {
  if (typeof rawHtml !== 'string' || rawHtml.trim() === '') {
    throw new Error('Pasted HTML is empty.');
  }

  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  const { oldCell, newCell } = findCells(doc);

  return {
    oldVersion: parseCell(oldCell, 'removed'),
    newVersion: parseCell(newCell, 'added'),
  };
}

export function findCells(root) {
  const oldCell = root.querySelector('td.track-changes-diff--old');
  const newCell = root.querySelector(
    'td.track-changes-diff:not(.track-changes-diff--old)'
  );

  if (!oldCell) {
    throw new Error(
      "Could not find the old version cell. Looked for <td class='track-changes-diff--old'>."
    );
  }
  if (!newCell) {
    throw new Error(
      "Could not find the new version cell. Looked for <td class='track-changes-diff'> without the --old modifier."
    );
  }
  return { oldCell, newCell };
}

export function parseRows(cell) {
  const innerTable = cell.querySelector('table');
  if (!innerTable) {
    throw new Error(
      'No inner table found in cell. Expected the Jadu metadata table (Page No. / Image / Title / Description).'
    );
  }

  const rows = new Map();
  const trs = innerTable.querySelectorAll(':scope > tbody > tr, :scope > tr');
  for (const tr of trs) {
    const labelCell = tr.querySelector(':scope > td.generic_desc');
    const valueCell = tr.querySelector(':scope > td.generic_action');
    if (!labelCell || !valueCell) continue;
    const label = normaliseWhitespace(labelCell.textContent).toLowerCase();
    if (label) rows.set(label, valueCell);
  }
  return rows;
}

export function extractMetadata(rows) {
  const titleEl = rows.get('title');
  const imageEl = rows.get('image');

  const title = titleEl ? normaliseWhitespace(titleEl.textContent) : '';
  let imageUrl = '';
  if (imageEl) {
    const img = imageEl.querySelector('img');
    if (img) imageUrl = img.getAttribute('src') || '';
  }
  return { title, imageUrl };
}

export function unwrapDiffSpans(element, kind) {
  const className = kind === 'removed' ? 'diffRemoved' : 'diffAdded';
  const spans = element.querySelectorAll(`span.${className}`);
  for (const span of spans) {
    const parent = span.parentNode;
    if (!parent) continue;
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
  }
}

export function extractBlocks(containerEl) {
  const blocks = [];
  for (const child of containerEl.children) {
    if (matchesAnyBlockSelector(child)) {
      blocks.push(buildBlock(child));
    }
  }
  return blocks;
}

export function normaliseWhitespace(text) {
  if (text == null) return '';
  return String(text).replace(/\s+/g, ' ').trim();
}

function parseCell(cellElement, diffKind) {
  const rows = parseRows(cellElement);
  const { title, imageUrl } = extractMetadata(rows);
  const descriptionEl = rows.get('description');
  if (!descriptionEl) {
    const found = [...rows.keys()].join(', ') || '(none)';
    throw new Error(
      `Couldn't find a 'Description' row. Found rows: ${found}. The parser keys rows by their label text — if Jadu uses different labels here, this needs adjusting.`
    );
  }

  const clone = descriptionEl.cloneNode(true);
  unwrapDiffSpans(clone, diffKind);

  return {
    title,
    imageUrl,
    descriptionHtml: clone.innerHTML,
    blocks: extractBlocks(clone),
  };
}

function matchesAnyBlockSelector(el) {
  return BLOCK_SELECTORS.some((sel) => el.matches(sel));
}

function buildBlock(el) {
  return {
    tag: el.tagName.toLowerCase(),
    html: el.outerHTML,
    text: normaliseWhitespace(el.textContent),
  };
}
