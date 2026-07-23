import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveBrandColors,
  fallbackPalette,
  hslToHex,
} from './brand-palette';

const HEX = /^#[0-9a-f]{6}$/;

describe('brand palette resolution', () => {
  it('uses real colors the owner gave (words → hex)', () => {
    const p = resolveBrandColors(['teal', 'gold'], 'cus_1');
    assert.equal(p.primary, '#0F766E');
    assert.equal(p.secondary, '#C79A45');
  });

  it('uses real hexes as given (normalized to lowercase)', () => {
    const p = resolveBrandColors(['#8C2F39'], 'cus_1');
    assert.equal(p.primary.toLowerCase(), '#8c2f39');
  });

  it('falls back to a DISTINCT palette per business when we have none', () => {
    // The whole point: no shared default. Two colorless businesses must differ.
    const a = resolveBrandColors([], 'cus_aaaaaaaa');
    const b = resolveBrandColors([], 'cus_bbbbbbbb');
    assert.match(a.primary, HEX);
    assert.notEqual(a.primary, b.primary, 'colorless brands must not share a color');
  });

  it('spreads many colorless businesses across the wheel, not onto one navy', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `cus_${i}_zzz`);
    const primaries = new Set(ids.map((id) => fallbackPalette(id).primary));
    assert.ok(primaries.size >= 18, `expected a spread, got ${primaries.size} distinct`);
  });

  it('is deterministic — same id, same palette (re-render stays identical)', () => {
    assert.deepEqual(fallbackPalette('cus_x'), fallbackPalette('cus_x'));
  });

  it('ignores junk color strings and falls back', () => {
    // toSvgColors drops unrenderable words; an all-junk list must not yield a
    // broken color — it should fall through to the per-brand palette.
    const p = resolveBrandColors(['not-a-color-!!!'], 'cus_q');
    assert.match(p.primary, HEX);
  });
});

describe('hslToHex', () => {
  it('produces valid hex across the wheel', () => {
    for (let h = 0; h < 360; h += 30) assert.match(hslToHex(h, 0.5, 0.42), HEX);
  });
  it('hits known anchors', () => {
    assert.equal(hslToHex(0, 1, 0.5), '#ff0000');
    assert.equal(hslToHex(120, 1, 0.5), '#00ff00');
    assert.equal(hslToHex(240, 1, 0.5), '#0000ff');
  });
});
