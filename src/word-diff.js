const MAX_TOKENS = 2000;

export function tokenize(text) {
  if (!text) return [];
  return text.match(/\S+|\s+/g) || [];
}

export function computeWordDiff(oldText, newText) {
  const a = tokenize(oldText);
  const b = tokenize(newText);

  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
    const ops = [];
    if (a.length) ops.push({ type: 'remove', value: a.join('') });
    if (b.length) ops.push({ type: 'add', value: b.join('') });
    return ops;
  }

  const m = a.length;
  const n = b.length;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const ops = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      ops.push({ type: 'equal', value: a[i - 1] });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ type: 'remove', value: a[i - 1] });
      i--;
    } else {
      ops.push({ type: 'add', value: b[j - 1] });
      j--;
    }
  }
  while (i > 0) {
    ops.push({ type: 'remove', value: a[i - 1] });
    i--;
  }
  while (j > 0) {
    ops.push({ type: 'add', value: b[j - 1] });
    j--;
  }
  ops.reverse();

  return mergeAdjacent(ops);
}

export function renderForOldSide(ops) {
  return ops
    .filter((op) => op.type !== 'add')
    .map((op) =>
      op.type === 'remove'
        ? `<del class="word-del">${escapeHtml(op.value)}</del>`
        : escapeHtml(op.value)
    )
    .join('');
}

export function renderForNewSide(ops) {
  return ops
    .filter((op) => op.type !== 'remove')
    .map((op) =>
      op.type === 'add'
        ? `<ins class="word-add">${escapeHtml(op.value)}</ins>`
        : escapeHtml(op.value)
    )
    .join('');
}

function mergeAdjacent(ops) {
  const merged = [];
  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last && last.type === op.type) {
      last.value += op.value;
    } else {
      merged.push({ ...op });
    }
  }
  return merged;
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c]
  );
}
