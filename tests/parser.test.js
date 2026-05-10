import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePastedHtml,
  findCells,
  parseRows,
  extractMetadata,
  unwrapDiffSpans,
  extractBlocks,
  normaliseWhitespace,
} from '../src/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_PATH = resolve(__dirname, '../samples/track-changes.html');
const HAS_SAMPLE = existsSync(SAMPLE_PATH);
const sample = HAS_SAMPLE ? readFileSync(SAMPLE_PATH, 'utf8') : null;

const SYNTHETIC_HTML = `<table><tr>
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
          <p>The department offers <span class="diffRemoved">a wide range of </span>undergraduate courses.</p>
          <p>Our research focuses on theoretical frameworks.</p>
          <p><span class="diffRemoved">Apply now for the 2024 intake.</span></p>
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
          <p>The department offers undergraduate courses<span class="diffAdded">, with a strong emphasis on practical application</span>.</p>
          <p>Our research focuses on theoretical frameworks.</p>
          <p><span class="diffAdded">Browse our open days to find out more.</span></p>
        </td>
      </tr>
    </table>
  </td>
</tr></table>`;

describe('normaliseWhitespace', () => {
  it('collapses runs of whitespace to single spaces and trims', () => {
    expect(normaliseWhitespace('  hello\n\n  world  ')).toBe('hello world');
  });

  it('handles tabs and CR characters', () => {
    expect(normaliseWhitespace('a\tb\r\nc')).toBe('a b c');
  });

  it('returns empty string for null or undefined', () => {
    expect(normaliseWhitespace(null)).toBe('');
    expect(normaliseWhitespace(undefined)).toBe('');
  });
});

describe('unwrapDiffSpans', () => {
  it('removes diffRemoved spans but keeps their text', () => {
    const div = document.createElement('div');
    div.innerHTML = 'a <span class="diffRemoved">b</span> c';
    unwrapDiffSpans(div, 'removed');
    expect(div.innerHTML).toBe('a b c');
  });

  it('removes diffAdded spans but keeps their text', () => {
    const div = document.createElement('div');
    div.innerHTML = 'a <span class="diffAdded">b</span> c';
    unwrapDiffSpans(div, 'added');
    expect(div.innerHTML).toBe('a b c');
  });

  it('only removes the requested kind', () => {
    const div = document.createElement('div');
    div.innerHTML =
      '<span class="diffRemoved">x</span><span class="diffAdded">y</span>';
    unwrapDiffSpans(div, 'removed');
    expect(div.innerHTML).toBe('x<span class="diffAdded">y</span>');
  });

  it('preserves nested elements inside the span', () => {
    const div = document.createElement('div');
    div.innerHTML = '<span class="diffAdded"><strong>hi</strong></span>';
    unwrapDiffSpans(div, 'added');
    expect(div.innerHTML).toBe('<strong>hi</strong>');
  });
});

describe('parsePastedHtml on synthetic HTML', () => {
  it('extracts old and new metadata', () => {
    const result = parsePastedHtml(SYNTHETIC_HTML);
    expect(result.oldVersion.title).toBe(
      'Welcome to the Department of Examples'
    );
    expect(result.newVersion.title).toBe(
      'Welcome to the Department of Examples (Updated)'
    );
    expect(result.oldVersion.imageUrl).toBe(
      'https://example.com/old-image.jpg'
    );
    expect(result.newVersion.imageUrl).toBe(
      'https://example.com/new-image.jpg'
    );
  });

  it('cleans diff spans from descriptions', () => {
    const result = parsePastedHtml(SYNTHETIC_HTML);
    expect(result.oldVersion.descriptionHtml).not.toContain('diffRemoved');
    expect(result.newVersion.descriptionHtml).not.toContain('diffAdded');
  });

  it('keeps removed text in the old version', () => {
    const result = parsePastedHtml(SYNTHETIC_HTML);
    expect(result.oldVersion.descriptionHtml).toContain('a wide range of');
    expect(result.oldVersion.descriptionHtml).toContain(
      'Apply now for the 2024 intake'
    );
  });

  it('keeps added text in the new version', () => {
    const result = parsePastedHtml(SYNTHETIC_HTML);
    expect(result.newVersion.descriptionHtml).toContain(
      'practical application'
    );
    expect(result.newVersion.descriptionHtml).toContain('open days');
  });

  it('extracts the expected number of top-level blocks', () => {
    const result = parsePastedHtml(SYNTHETIC_HTML);
    expect(result.oldVersion.blocks).toHaveLength(3);
    expect(result.newVersion.blocks).toHaveLength(3);
    expect(result.oldVersion.blocks.every((b) => b.tag === 'p')).toBe(true);
  });

  it('block.text is whitespace-normalised', () => {
    const result = parsePastedHtml(SYNTHETIC_HTML);
    for (const block of result.oldVersion.blocks) {
      expect(block.text).not.toMatch(/\s{2,}/);
      expect(block.text).not.toMatch(/^\s|\s$/);
    }
  });
});

describe('extractBlocks', () => {
  it('finds all listed block-level tags', () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <p>para</p>
      <h2>heading</h2>
      <ul><li>item</li></ul>
      <ol><li>item</li></ol>
      <blockquote>quote</blockquote>
      <pre>code</pre>
      <div class="uol-accordion">accordion</div>
      <div class="not-a-block">should be skipped</div>
      <span>inline, skipped</span>
    `;
    const blocks = extractBlocks(div);
    const tags = blocks.map((b) => b.tag);
    expect(tags).toEqual([
      'p',
      'h2',
      'ul',
      'ol',
      'blockquote',
      'pre',
      'div',
    ]);
  });

  it('only extracts top-level children, not nested blocks', () => {
    const div = document.createElement('div');
    div.innerHTML = '<div class="uol-accordion"><p>nested</p></div>';
    const blocks = extractBlocks(div);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].tag).toBe('div');
  });
});

describe('error handling', () => {
  it('throws if HTML is empty', () => {
    expect(() => parsePastedHtml('')).toThrow(/empty/i);
    expect(() => parsePastedHtml('   ')).toThrow(/empty/i);
  });

  it('throws if no old cell', () => {
    expect(() => parsePastedHtml('<div>no cells here</div>')).toThrow(
      /old version cell/i
    );
  });

  it('throws if no new cell', () => {
    const html = `<table><tr>
      <td class="track-changes-diff track-changes-diff--old">
        <table><tr>
          <td class="generic_desc"><p>Description</p></td>
          <td class="generic_action"><p>x</p></td>
        </tr></table>
      </td>
    </tr></table>`;
    expect(() => parsePastedHtml(html)).toThrow(/new version cell/i);
  });

  it('throws a helpful error if no Description row', () => {
    const html = `<table><tr>
      <td class="track-changes-diff track-changes-diff--old">
        <table><tr>
          <td class="generic_desc"><p>Title</p></td>
          <td class="generic_action">X</td>
        </tr></table>
      </td>
      <td class="track-changes-diff">
        <table><tr>
          <td class="generic_desc"><p>Title</p></td>
          <td class="generic_action">Y</td>
        </tr></table>
      </td>
    </tr></table>`;
    expect(() => parsePastedHtml(html)).toThrow(/Description/);
    expect(() => parsePastedHtml(html)).toThrow(/Found rows: title/);
  });
});

describe('parsePastedHtml on real Jadu sample', () => {
  it.skipIf(!HAS_SAMPLE)('extracts the expected title', () => {
    const result = parsePastedHtml(sample);
    expect(result.oldVersion.title).toBe('Extending your visa in the UK');
    expect(result.newVersion.title).toBe('Extending your visa in the UK');
  });

  it.skipIf(!HAS_SAMPLE)('extracts the image URL from both versions', () => {
    const result = parsePastedHtml(sample);
    expect(result.oldVersion.imageUrl).toContain('no_image.gif');
    expect(result.newVersion.imageUrl).toContain('no_image.gif');
  });

  it.skipIf(!HAS_SAMPLE)('finds many top-level blocks in both versions', () => {
    const result = parsePastedHtml(sample);
    expect(result.oldVersion.blocks.length).toBeGreaterThan(5);
    expect(result.newVersion.blocks.length).toBeGreaterThan(5);
  });

  it.skipIf(!HAS_SAMPLE)('strips diff spans from both versions', () => {
    const result = parsePastedHtml(sample);
    expect(result.oldVersion.descriptionHtml).not.toContain(
      'class="diffRemoved"'
    );
    expect(result.newVersion.descriptionHtml).not.toContain(
      'class="diffAdded"'
    );
  });

  it.skipIf(!HAS_SAMPLE)(
    'ignores the malformed CMS chrome after the inner table',
    () => {
      const result = parsePastedHtml(sample);
      expect(result.newVersion.descriptionHtml).not.toContain(
        'Keep this Version'
      );
      expect(result.oldVersion.descriptionHtml).not.toContain(
        'Rollback to this Previous Version'
      );
    }
  );

  it.skipIf(!HAS_SAMPLE)('finds the uol-accordion blocks', () => {
    const result = parsePastedHtml(sample);
    const oldAccordions = result.oldVersion.blocks.filter(
      (b) => b.tag === 'div'
    );
    const newAccordions = result.newVersion.blocks.filter(
      (b) => b.tag === 'div'
    );
    expect(oldAccordions.length).toBeGreaterThan(0);
    expect(newAccordions.length).toBeGreaterThan(0);
    expect(oldAccordions[0].html).toContain('uol-accordion');
  });
});
