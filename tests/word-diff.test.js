import { describe, it, expect } from 'vitest';
import {
  tokenize,
  computeWordDiff,
  renderForOldSide,
  renderForNewSide,
} from '../src/word-diff.js';

describe('tokenize', () => {
  it('splits text into words and whitespace tokens', () => {
    expect(tokenize('hello world')).toEqual(['hello', ' ', 'world']);
  });

  it('preserves runs of whitespace as single tokens', () => {
    expect(tokenize('a  b')).toEqual(['a', '  ', 'b']);
  });

  it('returns an empty array for null, undefined, or empty input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize(null)).toEqual([]);
    expect(tokenize(undefined)).toEqual([]);
  });
});

describe('computeWordDiff', () => {
  it('returns only equal ops for identical text', () => {
    const ops = computeWordDiff('hello world', 'hello world');
    expect(ops.every((o) => o.type === 'equal')).toBe(true);
    expect(ops.map((o) => o.value).join('')).toBe('hello world');
  });

  it('detects an inserted word', () => {
    const ops = computeWordDiff('the cat sat', 'the big cat sat');
    const adds = ops.filter((o) => o.type === 'add').map((o) => o.value);
    expect(adds.join('')).toContain('big');
  });

  it('detects a removed word', () => {
    const ops = computeWordDiff('the big cat', 'the cat');
    const removes = ops.filter((o) => o.type === 'remove').map((o) => o.value);
    expect(removes.join('')).toContain('big');
  });

  it('detects a replaced word as a remove + add pair', () => {
    const ops = computeWordDiff('the red car', 'the blue car');
    const removes = ops.filter((o) => o.type === 'remove').map((o) => o.value);
    const adds = ops.filter((o) => o.type === 'add').map((o) => o.value);
    expect(removes.join('')).toContain('red');
    expect(adds.join('')).toContain('blue');
  });

  it('handles empty old text (everything is added)', () => {
    const ops = computeWordDiff('', 'new text here');
    expect(ops.some((o) => o.type === 'remove')).toBe(false);
    expect(ops.map((o) => o.value).join('')).toBe('new text here');
  });

  it('handles empty new text (everything is removed)', () => {
    const ops = computeWordDiff('old text here', '');
    expect(ops.some((o) => o.type === 'add')).toBe(false);
    expect(ops.map((o) => o.value).join('')).toBe('old text here');
  });

  it('merges adjacent same-type ops into single segments', () => {
    const ops = computeWordDiff('start end', 'start middle middle middle end');
    const adds = ops.filter((o) => o.type === 'add');
    expect(adds).toHaveLength(1);
    expect(adds[0].value).toBe(' middle middle middle');
  });
});

describe('renderForOldSide', () => {
  it('omits added segments and wraps removed in <del class="word-del">', () => {
    const ops = [
      { type: 'equal', value: 'hello ' },
      { type: 'remove', value: 'cruel ' },
      { type: 'add', value: 'wonderful ' },
      { type: 'equal', value: 'world' },
    ];
    const html = renderForOldSide(ops);
    expect(html).toBe('hello <del class="word-del">cruel </del>world');
    expect(html).not.toContain('wonderful');
  });

  it('escapes HTML in equal and remove segments to prevent injection', () => {
    const ops = [
      { type: 'equal', value: '<script>alert(1)</script>' },
      { type: 'remove', value: '<bad>' },
    ];
    const html = renderForOldSide(ops);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;bad&gt;');
  });
});

describe('renderForNewSide', () => {
  it('omits removed segments and wraps added in <ins class="word-add">', () => {
    const ops = [
      { type: 'equal', value: 'hello ' },
      { type: 'remove', value: 'cruel ' },
      { type: 'add', value: 'wonderful ' },
      { type: 'equal', value: 'world' },
    ];
    const html = renderForNewSide(ops);
    expect(html).toBe('hello <ins class="word-add">wonderful </ins>world');
    expect(html).not.toContain('cruel');
  });

  it('escapes HTML in equal and add segments', () => {
    const ops = [
      { type: 'equal', value: 'safe ' },
      { type: 'add', value: '<script>x</script>' },
    ];
    const html = renderForNewSide(ops);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('round-trip integration', () => {
  it('old-side rendering preserves the original text once tags are stripped', () => {
    const ops = computeWordDiff('the big red car', 'the small blue car');
    const html = renderForOldSide(ops);
    const text = html.replace(/<[^>]+>/g, '');
    expect(text).toBe('the big red car');
  });

  it('new-side rendering preserves the new text once tags are stripped', () => {
    const ops = computeWordDiff('the big red car', 'the small blue car');
    const html = renderForNewSide(ops);
    const text = html.replace(/<[^>]+>/g, '');
    expect(text).toBe('the small blue car');
  });
});
