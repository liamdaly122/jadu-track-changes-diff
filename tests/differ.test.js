import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeDiff, similarity } from '../src/differ.js';
import { parsePastedHtml } from '../src/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_PATH = resolve(__dirname, '../samples/track-changes.html');
const HAS_SAMPLE = existsSync(SAMPLE_PATH);
const sample = HAS_SAMPLE ? readFileSync(SAMPLE_PATH, 'utf8') : null;

const block = (tag, text) => ({ tag, text, html: `<${tag}>${text}</${tag}>` });

describe('similarity', () => {
  it('returns 1 for identical text', () => {
    expect(similarity('apple banana cherry', 'apple banana cherry')).toBe(1);
  });

  it('returns 0 for completely disjoint long-word text', () => {
    expect(similarity('apple banana cherry', 'octopus penguin trumpet')).toBe(
      0
    );
  });

  it('is case-insensitive', () => {
    expect(similarity('APPLE banana', 'apple BANANA')).toBe(1);
  });

  it('returns the Dice coefficient for partial overlap', () => {
    expect(similarity('apple orange', 'apple grape')).toBe(0.5);
  });

  it('ignores words of 3 characters or fewer', () => {
    expect(similarity('abc apple', 'def apple')).toBe(1);
    expect(similarity('the cat sat', 'the dog ran')).toBe(1);
  });

  it('returns 1 if both inputs are empty after filtering', () => {
    expect(similarity('', '')).toBe(1);
    expect(similarity('a b c', 'x y z')).toBe(1);
  });

  it('returns 0 if only one input has long words', () => {
    expect(similarity('apple', '')).toBe(0);
    expect(similarity('', 'apple')).toBe(0);
  });

  it('handles unicode and accented characters', () => {
    expect(similarity('résumé practical', 'résumé practical')).toBe(1);
  });
});

describe('computeDiff exact matches', () => {
  it('classifies identical blocks as unchanged', () => {
    const r = computeDiff([block('p', 'Hello there')], [block('p', 'Hello there')]);
    expect(r.oldEntries[0].type).toBe('unchanged');
    expect(r.newEntries[0].type).toBe('unchanged');
    expect(r.oldEntries[0].similarity).toBe(1);
    expect(r.counts).toEqual({ added: 0, removed: 0, modified: 0, unchanged: 1 });
  });

  it('treats same text but different tag as modified, not unchanged', () => {
    const r = computeDiff(
      [block('p', 'Section title goes here today')],
      [block('h2', 'Section title goes here today')]
    );
    expect(r.oldEntries[0].type).toBe('modified');
    expect(r.newEntries[0].type).toBe('modified');
  });

  it('pairs duplicate blocks one-to-one', () => {
    const a = [block('p', 'Identical text here'), block('p', 'Identical text here')];
    const b = [block('p', 'Identical text here'), block('p', 'Identical text here')];
    const r = computeDiff(a, b);
    expect(r.oldEntries.every((e) => e.type === 'unchanged')).toBe(true);
    expect(r.newEntries.every((e) => e.type === 'unchanged')).toBe(true);
  });

  it('does not match the same new block to multiple old blocks', () => {
    const a = [block('p', 'Identical text here'), block('p', 'Identical text here')];
    const b = [block('p', 'Identical text here')];
    const r = computeDiff(a, b);
    const unchanged = r.oldEntries.filter((e) => e.type === 'unchanged').length;
    const removed = r.oldEntries.filter((e) => e.type === 'removed').length;
    expect(unchanged).toBe(1);
    expect(removed).toBe(1);
  });
});

describe('computeDiff similarity matches', () => {
  it('marks similar blocks as modified', () => {
    const a = [
      block('p', 'The department offers undergraduate courses in example studies'),
    ];
    const b = [
      block(
        'p',
        'The department offers undergraduate courses in example studies with practical application'
      ),
    ];
    const r = computeDiff(a, b);
    expect(r.oldEntries[0].type).toBe('modified');
    expect(r.newEntries[0].type).toBe('modified');
    expect(r.oldEntries[0].similarity).toBeGreaterThan(0.5);
    expect(r.oldEntries[0].match).toBe(b[0]);
  });

  it('does not pair blocks whose similarity falls below the threshold', () => {
    const a = [block('p', 'apple banana cherry durian elderberry')];
    const b = [block('p', 'octopus penguin trumpet vanilla walnut')];
    const r = computeDiff(a, b);
    expect(r.oldEntries[0].type).toBe('removed');
    expect(r.newEntries[0].type).toBe('added');
  });

  it('picks the best match when multiple candidates exist', () => {
    const a = [block('p', 'apple orange grape lemon mango')];
    const b = [
      block('p', 'cherry banana coconut'),
      block('p', 'apple orange grape lemon kiwi'),
    ];
    const r = computeDiff(a, b);
    expect(r.oldEntries[0].type).toBe('modified');
    expect(r.oldEntries[0].match).toBe(b[1]);
    expect(r.newEntries[1].type).toBe('modified');
    expect(r.newEntries[0].type).toBe('added');
  });

  it('respects a custom threshold option', () => {
    const a = [block('p', 'apple orange grape lemon mango')];
    const b = [block('p', 'apple orange grape lemon kiwi')];
    const lenient = computeDiff(a, b, { threshold: 0.5 });
    expect(lenient.oldEntries[0].type).toBe('modified');
    const strict = computeDiff(a, b, { threshold: 0.95 });
    expect(strict.oldEntries[0].type).toBe('removed');
    expect(strict.newEntries[0].type).toBe('added');
  });
});

describe('computeDiff added and removed', () => {
  it('marks unmatched old blocks as removed', () => {
    const r = computeDiff([block('p', 'orphan paragraph alone')], []);
    expect(r.oldEntries[0].type).toBe('removed');
    expect(r.counts.removed).toBe(1);
  });

  it('marks unmatched new blocks as added', () => {
    const r = computeDiff([], [block('p', 'brand new paragraph appears')]);
    expect(r.newEntries[0].type).toBe('added');
    expect(r.counts.added).toBe(1);
  });

  it('handles two empty sides', () => {
    const r = computeDiff([], []);
    expect(r.oldEntries).toEqual([]);
    expect(r.newEntries).toEqual([]);
    expect(r.counts).toEqual({ added: 0, removed: 0, modified: 0, unchanged: 0 });
  });
});

describe('computeDiff counts', () => {
  it('counts modifications once, not twice', () => {
    const r = computeDiff(
      [block('p', 'apple orange grape lemon mango')],
      [block('p', 'apple orange grape lemon kiwi')]
    );
    expect(r.counts.modified).toBe(1);
  });

  it('counts a mixed scenario correctly', () => {
    const a = [
      block('p', 'unchanged paragraph stays exactly the same throughout'),
      block('p', 'rewritten paragraph some different words throughout'),
      block('p', 'removed paragraph entirely vanishes from the document'),
    ];
    const b = [
      block('p', 'unchanged paragraph stays exactly the same throughout'),
      block('p', 'rewritten paragraph some different words throughout plus extras'),
      block('p', 'completely brand fresh paragraph appears suddenly here'),
    ];
    const r = computeDiff(a, b);
    expect(r.counts.unchanged).toBe(1);
    expect(r.counts.modified).toBe(1);
    expect(r.counts.removed).toBe(1);
    expect(r.counts.added).toBe(1);
  });
});

describe('computeDiff on real Jadu sample', () => {
  it.skipIf(!HAS_SAMPLE)('produces a sensible classification', () => {
    const parsed = parsePastedHtml(sample);
    const diff = computeDiff(
      parsed.oldVersion.blocks,
      parsed.newVersion.blocks
    );
    expect(
      diff.counts.unchanged + diff.counts.modified + diff.counts.removed
    ).toBe(parsed.oldVersion.blocks.length);
    expect(
      diff.counts.unchanged + diff.counts.modified + diff.counts.added
    ).toBe(parsed.newVersion.blocks.length);
    expect(diff.counts.unchanged).toBeGreaterThan(0);
    expect(
      diff.counts.modified + diff.counts.added + diff.counts.removed
    ).toBeGreaterThan(0);
  });

  it.skipIf(!HAS_SAMPLE)('every entry has a type set', () => {
    const parsed = parsePastedHtml(sample);
    const diff = computeDiff(
      parsed.oldVersion.blocks,
      parsed.newVersion.blocks
    );
    expect(diff.oldEntries.every((e) => e.type)).toBe(true);
    expect(diff.newEntries.every((e) => e.type)).toBe(true);
  });

  it.skipIf(!HAS_SAMPLE)(
    'pairs the price-changed accordion as modified, not added/removed',
    () => {
      const parsed = parsePastedHtml(sample);
      const diff = computeDiff(
        parsed.oldVersion.blocks,
        parsed.newVersion.blocks
      );
      const oldPriceBlock = diff.oldEntries.find(
        (e) => e.block.tag === 'div' && e.block.text.includes('524')
      );
      expect(oldPriceBlock).toBeDefined();
      expect(oldPriceBlock.type).toBe('modified');
      expect(oldPriceBlock.match).toBeTruthy();
      expect(oldPriceBlock.match.text).toContain('558');
    }
  );

  it.skipIf(!HAS_SAMPLE)(
    'majority of accordion blocks pair across old and new (not orphaned)',
    () => {
      const parsed = parsePastedHtml(sample);
      const diff = computeDiff(
        parsed.oldVersion.blocks,
        parsed.newVersion.blocks
      );
      const oldAccordions = diff.oldEntries.filter(
        (e) => e.block.tag === 'div'
      );
      const orphaned = oldAccordions.filter(
        (e) => e.type === 'removed'
      ).length;
      expect(orphaned).toBeLessThan(oldAccordions.length / 2);
    }
  );

  it.skipIf(!HAS_SAMPLE)(
    'old + new entry counts match the parsed block counts',
    () => {
      const parsed = parsePastedHtml(sample);
      const diff = computeDiff(
        parsed.oldVersion.blocks,
        parsed.newVersion.blocks
      );
      expect(diff.oldEntries).toHaveLength(parsed.oldVersion.blocks.length);
      expect(diff.newEntries).toHaveLength(parsed.newVersion.blocks.length);
    }
  );
});
