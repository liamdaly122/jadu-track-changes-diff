import { describe, it, expect, beforeEach } from 'vitest';
import {
  listSavedComparisons,
  saveComparison,
  loadComparison,
  deleteComparison,
  clearAllComparisons,
} from '../src/storage.js';

beforeEach(() => {
  localStorage.clear();
});

describe('listSavedComparisons', () => {
  it('returns an empty array when nothing is saved', () => {
    expect(listSavedComparisons()).toEqual([]);
  });

  it('returns an empty array if storage is corrupted', () => {
    localStorage.setItem('jadu-diff-saved-comparisons', '{not valid json');
    expect(listSavedComparisons()).toEqual([]);
  });

  it('returns an empty array if storage is not an array', () => {
    localStorage.setItem(
      'jadu-diff-saved-comparisons',
      JSON.stringify({ not: 'an array' })
    );
    expect(listSavedComparisons()).toEqual([]);
  });
});

describe('saveComparison', () => {
  it('returns an entry with id, savedAt, title and rawHtml', () => {
    const entry = saveComparison({
      rawHtml: '<p>hi</p>',
      title: 'Test page',
    });
    expect(entry.id).toBeTruthy();
    expect(entry.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entry.title).toBe('Test page');
    expect(entry.rawHtml).toBe('<p>hi</p>');
  });

  it('puts newest first', () => {
    saveComparison({ rawHtml: 'a', title: 'A' });
    saveComparison({ rawHtml: 'b', title: 'B' });
    const list = listSavedComparisons();
    expect(list[0].title).toBe('B');
    expect(list[1].title).toBe('A');
  });

  it('caps at 20, dropping the oldest', () => {
    for (let i = 0; i < 25; i++) {
      saveComparison({ rawHtml: `${i}`, title: `item-${i}` });
    }
    const list = listSavedComparisons();
    expect(list).toHaveLength(20);
    expect(list[0].title).toBe('item-24');
    expect(list[19].title).toBe('item-5');
  });

  it('falls back to "(no title)" when title is empty', () => {
    const entry = saveComparison({ rawHtml: 'x', title: '' });
    expect(entry.title).toBe('(no title)');
    const entry2 = saveComparison({ rawHtml: 'x', title: '   ' });
    expect(entry2.title).toBe('(no title)');
  });

  it('refuses to save empty html', () => {
    expect(() =>
      saveComparison({ rawHtml: '', title: 'x' })
    ).toThrow(/no HTML/);
    expect(() =>
      saveComparison({ rawHtml: '   ', title: 'x' })
    ).toThrow(/no HTML/);
  });

  it('generates a unique id per save', () => {
    const a = saveComparison({ rawHtml: 'a', title: 'A' });
    const b = saveComparison({ rawHtml: 'b', title: 'B' });
    expect(a.id).not.toBe(b.id);
  });
});

describe('loadComparison', () => {
  it('returns the saved entry by id, including rawHtml', () => {
    const entry = saveComparison({ rawHtml: '<p>x</p>', title: 'X' });
    const loaded = loadComparison(entry.id);
    expect(loaded).not.toBeNull();
    expect(loaded.title).toBe('X');
    expect(loaded.rawHtml).toBe('<p>x</p>');
  });

  it('returns null for an unknown id', () => {
    expect(loadComparison('nope')).toBeNull();
  });
});

describe('deleteComparison', () => {
  it('removes the matching entry only', () => {
    const a = saveComparison({ rawHtml: 'a', title: 'A' });
    const b = saveComparison({ rawHtml: 'b', title: 'B' });
    deleteComparison(a.id);
    const list = listSavedComparisons();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(b.id);
  });

  it('is a no-op for an unknown id', () => {
    saveComparison({ rawHtml: 'a', title: 'A' });
    deleteComparison('nope');
    expect(listSavedComparisons()).toHaveLength(1);
  });
});

describe('clearAllComparisons', () => {
  it('removes everything', () => {
    saveComparison({ rawHtml: 'a', title: 'A' });
    saveComparison({ rawHtml: 'b', title: 'B' });
    clearAllComparisons();
    expect(listSavedComparisons()).toEqual([]);
  });
});
