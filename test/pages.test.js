import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const PAGES = [
  { name: 'index.html', path: 'public/index.html' },
  { name: 'plan.html', path: 'public/plan.html' },
];

describe('Static HTML Pages Audit', () => {
  for (const page of PAGES) {
    describe(page.name, () => {
      const content = readFileSync(page.path, 'utf8');

      it('declares a valid document language', () => {
        assert.match(content, /<html\s+lang="[a-z]{2}"/);
      });

      it('has exactly one h1 tag for accessibility', () => {
        const matches = content.match(/<h1[\s>]/g) || [];
        assert.equal(matches.length, 1, `Expected exactly 1 <h1> in ${page.name}, found ${matches.length}`);
      });

      it('contains an accessible skip link', () => {
        assert.match(content, /class="skip-link"/);
      });

      it('loads no third-party CDNs or inline style attributes to honor strict CSP', () => {
        assert.doesNotMatch(content, /https?:\/\/(?!localhost|auraplan)/i, 'External CDN found in HTML');
        assert.doesNotMatch(content, /<style[\s>]/i, 'Inline <style> tag found');
      });

      it('uses module scripts with src or no scripts', () => {
        const inlineScripts = content.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi) || [];
        assert.equal(inlineScripts.length, 0, 'Inline <script> found');
      });
    });
  }
});
