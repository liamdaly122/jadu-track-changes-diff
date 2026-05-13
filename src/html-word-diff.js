const TOKEN_REGEX = /<[^>]+>|&[^;\s<>]+;|[\w'’\-]+|\s+|./g;
const MAX_COMPARABLE = 2000;

export function tokenizeHtml(html) {
  if (!html) return [];
  const matches = html.match(TOKEN_REGEX) || [];
  return matches.map((value) => ({ type: classify(value), value }));
}

export function htmlWordDiff(oldHtml, newHtml) {
  const oldTokens = tokenizeHtml(oldHtml);
  const newTokens = tokenizeHtml(newHtml);

  const oldComp = oldTokens.filter((t) => t.type !== 'tag');
  const newComp = newTokens.filter((t) => t.type !== 'tag');

  if (oldComp.length > MAX_COMPARABLE || newComp.length > MAX_COMPARABLE) {
    return null;
  }

  const m = oldComp.length;
  const n = newComp.length;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldComp[i - 1].value === newComp[j - 1].value) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const oldOps = [];
  const newOps = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (oldComp[i - 1].value === newComp[j - 1].value) {
      oldOps.push('equal');
      newOps.push('equal');
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      oldOps.push('remove');
      i--;
    } else {
      newOps.push('add');
      j--;
    }
  }
  while (i > 0) {
    oldOps.push('remove');
    i--;
  }
  while (j > 0) {
    newOps.push('add');
    j--;
  }
  oldOps.reverse();
  newOps.reverse();

  return {
    oldAnnotated: annotate(oldTokens, oldOps),
    newAnnotated: annotate(newTokens, newOps),
  };
}

export function renderForOldSide(annotated) {
  return renderSide(annotated, 'remove', 'word-del', 'del');
}

export function renderForNewSide(annotated) {
  return renderSide(annotated, 'add', 'word-add', 'ins');
}

function classify(value) {
  if (value.startsWith('<')) return 'tag';
  if (
    value.startsWith('&') &&
    value.endsWith(';') &&
    value.length > 2
  )
    return 'word';
  if (/^\s+$/.test(value)) return 'space';
  if (/^[\w'’\-]+$/.test(value)) return 'word';
  return 'punct';
}

function annotate(tokens, ops) {
  let opIdx = 0;
  return tokens.map((t) => {
    if (t.type === 'tag') return { ...t, op: 'tag' };
    return { ...t, op: ops[opIdx++] };
  });
}

function renderSide(annotated, opToHighlight, cls, wrapTag) {
  let html = '';
  let inWrap = false;
  const closeWrap = () => {
    if (inWrap) {
      html += `</${wrapTag}>`;
      inWrap = false;
    }
  };
  const openWrap = () => {
    if (!inWrap) {
      html += `<${wrapTag} class="${cls}">`;
      inWrap = true;
    }
  };

  for (const t of annotated) {
    if (t.op === 'tag') {
      closeWrap();
      html += t.value;
    } else if (t.op === opToHighlight) {
      if (t.type === 'space') {
        // Don't wrap pure whitespace — it's invisible and adds noise.
        closeWrap();
        html += t.value;
      } else {
        openWrap();
        html += emit(t);
      }
    } else if (t.op === 'equal') {
      closeWrap();
      html += emit(t);
    }
    // else: opposite-side op, skip
  }
  closeWrap();
  return html;
}

function emit(t) {
  if (t.type === 'word' && t.value.startsWith('&') && t.value.endsWith(';')) {
    return t.value;
  }
  return t.value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
