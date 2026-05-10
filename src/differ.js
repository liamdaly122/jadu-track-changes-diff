const DEFAULT_THRESHOLD = 0.5;

export function computeDiff(oldBlocks, newBlocks, options = {}) {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;

  const oldEntries = oldBlocks.map((block) => makeEntry(block));
  const newEntries = newBlocks.map((block) => makeEntry(block));

  for (const oldEntry of oldEntries) {
    if (oldEntry.type) continue;
    const newEntry = newEntries.find(
      (e) =>
        !e.type &&
        e.block.tag === oldEntry.block.tag &&
        e.block.text === oldEntry.block.text
    );
    if (newEntry) {
      pair(oldEntry, newEntry, 'unchanged', 1);
    }
  }

  for (const oldEntry of oldEntries) {
    if (oldEntry.type) continue;
    let best = null;
    let bestScore = 0;
    for (const newEntry of newEntries) {
      if (newEntry.type) continue;
      const score = similarity(oldEntry.block.text, newEntry.block.text);
      if (score > bestScore) {
        bestScore = score;
        best = newEntry;
      }
    }
    if (best && bestScore >= threshold) {
      pair(oldEntry, best, 'modified', bestScore);
    }
  }

  for (const e of oldEntries) if (!e.type) e.type = 'removed';
  for (const e of newEntries) if (!e.type) e.type = 'added';

  const counts = {
    added: newEntries.filter((e) => e.type === 'added').length,
    removed: oldEntries.filter((e) => e.type === 'removed').length,
    modified: oldEntries.filter((e) => e.type === 'modified').length,
    unchanged: oldEntries.filter((e) => e.type === 'unchanged').length,
  };

  return { oldEntries, newEntries, counts };
}

export function similarity(a, b) {
  const wordsA = new Set(toLongWords(a));
  const wordsB = new Set(toLongWords(b));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  return (2 * intersection) / (wordsA.size + wordsB.size);
}

function makeEntry(block) {
  return { type: null, block, match: null, similarity: null };
}

function pair(oldEntry, newEntry, type, score) {
  oldEntry.type = type;
  newEntry.type = type;
  oldEntry.match = newEntry.block;
  newEntry.match = oldEntry.block;
  oldEntry.similarity = score;
  newEntry.similarity = score;
}

function toLongWords(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 3);
}
