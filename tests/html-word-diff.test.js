import { describe, it, expect } from 'vitest';
import {
  tokenizeHtml,
  htmlWordDiff,
  renderForOldSide,
  renderForNewSide,
} from '../src/html-word-diff.js';

describe('tokenizeHtml', () => {
  it('separates tags from words and whitespace', () => {
    const tokens = tokenizeHtml('<p>Hello world</p>');
    expect(tokens.map((t) => t.value)).toEqual([
      '<p>',
      'Hello',
      ' ',
      'world',
      '</p>',
    ]);
    expect(tokens[0].type).toBe('tag');
    expect(tokens[1].type).toBe('word');
    expect(tokens[2].type).toBe('space');
  });

  it('treats a tag with attributes as a single token', () => {
    const tokens = tokenizeHtml('<a href="https://example.com">click</a>');
    expect(tokens[0].value).toBe('<a href="https://example.com">');
    expect(tokens[0].type).toBe('tag');
  });

  it('handles self-closing tags', () => {
    const tokens = tokenizeHtml('before<br />after');
    const tags = tokens.filter((t) => t.type === 'tag');
    expect(tags).toHaveLength(1);
    expect(tags[0].value).toBe('<br />');
  });

  it('treats HTML entities as single word-type tokens', () => {
    const tokens = tokenizeHtml('Cost &pound;524 per year');
    const entityToken = tokens.find((t) => t.value === '&pound;');
    expect(entityToken).toBeDefined();
    expect(entityToken.type).toBe('word');
  });

  it('returns an empty array for empty or null input', () => {
    expect(tokenizeHtml('')).toEqual([]);
    expect(tokenizeHtml(null)).toEqual([]);
  });
});

describe('htmlWordDiff', () => {
  it('marks identical content as all equal', () => {
    const result = htmlWordDiff('<p>Hello world</p>', '<p>Hello world</p>');
    const oldNonTag = result.oldAnnotated.filter((t) => t.op !== 'tag');
    expect(oldNonTag.every((t) => t.op === 'equal')).toBe(true);
  });

  it('detects a replaced word', () => {
    const result = htmlWordDiff(
      '<p>The red car</p>',
      '<p>The blue car</p>'
    );
    const removes = result.oldAnnotated.filter((t) => t.op === 'remove');
    const adds = result.newAnnotated.filter((t) => t.op === 'add');
    expect(removes.map((t) => t.value)).toContain('red');
    expect(adds.map((t) => t.value)).toContain('blue');
  });

  it('aligns text across structural-only changes (added <strong>)', () => {
    const result = htmlWordDiff(
      '<p>The quick brown fox</p>',
      '<p>The <strong>quick</strong> brown fox</p>'
    );
    const removes = result.oldAnnotated.filter((t) => t.op === 'remove');
    const adds = result.newAnnotated.filter((t) => t.op === 'add');
    expect(removes).toHaveLength(0);
    expect(adds).toHaveLength(0);
  });

  it('keeps tag tokens unchanged in their original sides', () => {
    const result = htmlWordDiff(
      '<p>Hello</p>',
      '<p><strong>Hello</strong></p>'
    );
    const oldTags = result.oldAnnotated
      .filter((t) => t.op === 'tag')
      .map((t) => t.value);
    const newTags = result.newAnnotated
      .filter((t) => t.op === 'tag')
      .map((t) => t.value);
    expect(oldTags).toEqual(['<p>', '</p>']);
    expect(newTags).toEqual(['<p>', '<strong>', '</strong>', '</p>']);
  });

  it('handles a price change inside a <strong> tag (entity)', () => {
    const result = htmlWordDiff(
      '<p>The cost is <strong>&pound;524</strong> per year</p>',
      '<p>The cost is <strong>&pound;558</strong> per year</p>'
    );
    const removes = result.oldAnnotated
      .filter((t) => t.op === 'remove')
      .map((t) => t.value);
    const adds = result.newAnnotated
      .filter((t) => t.op === 'add')
      .map((t) => t.value);
    expect(removes).toContain('524');
    expect(adds).toContain('558');
  });

  it('returns null for huge inputs (falls back to caller)', () => {
    const huge = '<p>' + 'word '.repeat(3000) + '</p>';
    const result = htmlWordDiff(huge, huge);
    expect(result).toBeNull();
  });

  it('handles empty input gracefully', () => {
    const result = htmlWordDiff('', '<p>hello</p>');
    const adds = result.newAnnotated.filter((t) => t.op === 'add');
    expect(adds.map((t) => t.value)).toContain('hello');
  });
});

describe('renderForOldSide', () => {
  it('preserves tags and wraps removed words in <del>', () => {
    const result = htmlWordDiff(
      '<p>The red car</p>',
      '<p>The blue car</p>'
    );
    const html = renderForOldSide(result.oldAnnotated);
    expect(html).toContain('<p>');
    expect(html).toContain('</p>');
    expect(html).toContain('<del class="word-del">red</del>');
    expect(html).not.toContain('blue');
  });

  it('keeps a link clickable when only the surrounding text changed', () => {
    const result = htmlWordDiff(
      '<p>Read the <a href="/old">guide</a> for help</p>',
      '<p>Check the <a href="/old">guide</a> for help</p>'
    );
    const html = renderForOldSide(result.oldAnnotated);
    expect(html).toContain('<a href="/old">');
    expect(html).toContain('guide');
    expect(html).toContain('</a>');
    expect(html).toContain('<del class="word-del">Read</del>');
  });

  it('does not wrap del across a tag boundary', () => {
    const result = htmlWordDiff(
      '<p>The quick brown fox</p>',
      '<p>The lazy dog</p>'
    );
    const html = renderForOldSide(result.oldAnnotated);
    // No <del> should remain open when </p> is emitted
    expect(html).not.toMatch(/<del[^>]*>[^<]*<\/p>/);
  });

  it('preserves HTML entities in output', () => {
    const result = htmlWordDiff(
      '<p>Cost is &pound;524</p>',
      '<p>Cost is &pound;558</p>'
    );
    const html = renderForOldSide(result.oldAnnotated);
    expect(html).toContain('&pound;');
  });
});

describe('renderForNewSide', () => {
  it('preserves tags and wraps added words in <ins>', () => {
    const result = htmlWordDiff(
      '<p>The red car</p>',
      '<p>The blue car</p>'
    );
    const html = renderForNewSide(result.newAnnotated);
    expect(html).toContain('<ins class="word-add">blue</ins>');
    expect(html).not.toContain('red');
  });

  it('wraps an added word inside <strong> correctly', () => {
    const result = htmlWordDiff(
      '<p>The cost is <strong>&pound;524</strong> per year</p>',
      '<p>The cost is <strong>&pound;558</strong> per year</p>'
    );
    const html = renderForNewSide(result.newAnnotated);
    expect(html).toContain('<strong>');
    expect(html).toContain('<ins class="word-add">558</ins>');
    expect(html).toContain('</strong>');
  });

  it('does not produce ins inside a tag attribute', () => {
    const result = htmlWordDiff(
      '<p>Click <a href="/x">here</a></p>',
      '<p>Click <a href="/x">now</a></p>'
    );
    const html = renderForNewSide(result.newAnnotated);
    // <a href="/x"> should stay intact, ins should be inside the anchor's text
    expect(html).toContain('<a href="/x">');
    expect(html).toMatch(/<a href="\/x"><ins[^>]*>now<\/ins><\/a>/);
  });
});

describe('round-trip integration', () => {
  it('stripping tags from old-side output yields the old text', () => {
    const oldHtml = '<p>The <strong>quick</strong> brown fox</p>';
    const newHtml = '<p>The <strong>slow</strong> brown fox</p>';
    const result = htmlWordDiff(oldHtml, newHtml);
    const out = renderForOldSide(result.oldAnnotated);
    const text = out.replace(/<[^>]+>/g, '');
    expect(text).toBe('The quick brown fox');
  });

  it('stripping tags from new-side output yields the new text', () => {
    const oldHtml = '<p>The <strong>quick</strong> brown fox</p>';
    const newHtml = '<p>The <strong>slow</strong> brown fox</p>';
    const result = htmlWordDiff(oldHtml, newHtml);
    const out = renderForNewSide(result.newAnnotated);
    const text = out.replace(/<[^>]+>/g, '');
    expect(text).toBe('The slow brown fox');
  });
});
