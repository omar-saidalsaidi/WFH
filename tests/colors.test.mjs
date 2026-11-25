import test from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, PALETTE_FLAT, resolveColor, normalizeHex, surfaceFor, accentFor, contrast } from '../src/colors.js';

test('36 لوناً في ثلاث مجموعات بلا تكرار، وبالقيم المطلوبة', () => {
  assert.equal(PALETTE.length, 3);
  assert.ok(PALETTE.every((g) => g.colors.length === 12));
  assert.equal(new Set(PALETTE_FLAT.map((c) => c.hex)).size, 36);
  for (const hex of ['#EDE4FF', '#E3F2FD', '#EAF4D3', '#B8A1E3', '#C5E1A5', '#593D91', '#526B30', '#9B3030']) assert.ok(PALETTE_FLAT.some((c) => c.hex === hex), hex);
});

test('HEX مخصص ومفاتيح الإصدار السابق', () => {
  assert.equal(normalizeHex('abc'), '#AABBCC');
  assert.equal(normalizeHex('#12ab9f'), '#12AB9F');
  assert.equal(normalizeHex('#12ab9'), null);
  assert.equal(normalizeHex('red'), null);
  assert.equal(resolveColor('mint'), '#E3F5EA');
  assert.equal(resolveColor(null), null);
  assert.equal(surfaceFor(null, false), null);
});

test('تباين النص كافٍ (4.5:1 على الأقل) لكل الألوان في الوضعين', () => {
  for (const { hex } of PALETTE_FLAT) {
    for (const dark of [false, true]) {
      const s = surfaceFor(hex, dark);
      assert.ok(s.ratio >= 4.5, `${hex} ${dark ? 'داكن' : 'فاتح'}: ${s.ratio.toFixed(2)}`);
      const a = accentFor(hex, dark);
      assert.ok(contrast(a.bg, a.ink) >= 3, `تمييز ${hex}`);
    }
  }
});

test('الوضع الداكن يخفف الألوان الفاتحة ويبقي الداكنة', () => {
  const light = surfaceFor('#EDE4FF', true);
  assert.notEqual(light.bg, '#EDE4FF'); assert.equal(light.onDark, true);
  assert.equal(surfaceFor('#593D91', true).bg, '#593D91');
  assert.equal(surfaceFor('#EDE4FF', false).bg, '#EDE4FF');
  assert.equal(surfaceFor('#EDE4FF', false).onDark, false);
});
