// The site's colours (docs/.vitepress/palette.ts) meet WCAG 2.2 AA in both themes, and
// docs/.vitepress/theme/custom.css uses the same values.

import { test, expect, describe } from "bun:test";
import { resolve } from "node:path";
import { dark, light, type Palette } from "../docs/.vitepress/palette";

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (h: string) => {
  const [r, g, b] = rgb(h).map(lin);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** A translucent colour over an opaque one, as the browser paints it. */
const over = (top: [number, number, number, number], under: string) => {
  const u = rgb(under);
  return "#" + [0, 1, 2].map((i) => Math.round(top[i]! * top[3] + u[i]! * (1 - top[3])).toString(16).padStart(2, "0")).join("");
};

// VitePress's --vp-c-default-soft, the grey behind inline code.
const inlineCodeBg = { light: [142, 150, 170, 0.14], dark: [101, 117, 133, 0.16] } as const;

const TEXT = ["text1", "text2", "text3", "punct", "keyword", "name", "constant", "string", "model", "comment", "danger"] as const;
const BACKGROUNDS = ["bg", "bgAlt", "bgSoft", "bgElv", "code"] as const;

for (const [mode, p] of [["dark", dark], ["light", light]] as [string, Palette][]) {
  describe(`${mode} palette`, () => {
    test("every text colour reads at 4.5:1 on every background", () => {
      const failing: string[] = [];
      for (const t of TEXT)
        for (const b of BACKGROUNDS) {
          const r = ratio(p[t], p[b]);
          if (r < 4.5) failing.push(`${t} ${p[t]} on ${b} ${p[b]}: ${r.toFixed(2)}`);
        }
      expect(failing).toEqual([]);
    });

    test("inline code (the brand colour on its grey) reads at 4.5:1, in table rows too", () => {
      const soft = inlineCodeBg[mode as "light" | "dark"] as unknown as [number, number, number, number];
      for (const b of BACKGROUNDS) expect(ratio(p.keyword, over(soft, p[b]))).toBeGreaterThanOrEqual(4.5);
    });

    test("text on a filled brand button reads at 4.5:1, at rest and on hover", () => {
      expect(ratio(p.onBrand, p.keyword)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p.onBrand, p.brandHover)).toBeGreaterThanOrEqual(4.5);
    });

    test("field borders and the focus ring reach 3:1", () => {
      for (const b of ["bg", "bgSoft", "bgElv"] as const) {
        expect(ratio(p.control, p[b])).toBeGreaterThanOrEqual(3);
        expect(ratio(p.name, p[b])).toBeGreaterThanOrEqual(3);
      }
    });
  });
}

test("custom.css uses palette.ts's values", async () => {
  const css = await Bun.file(resolve(import.meta.dir, "../docs/.vitepress/theme/custom.css")).text();
  const block = (selector: string) => css.slice(css.indexOf(`${selector} {`), css.indexOf("}", css.indexOf(`${selector} {`)));
  const vars = (text: string) => Object.fromEntries([...text.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]!.toLowerCase()]));
  const expected = (p: Palette) => ({
    "--halo-keyword": p.keyword,
    "--halo-name": p.name,
    "--halo-constant": p.constant,
    "--halo-string": p.string,
    "--halo-model": p.model,
    "--halo-comment": p.comment,
    "--halo-punct": p.punct,
    "--halo-danger": p.danger,
    "--halo-control": p.control,
    "--halo-on-brand": p.onBrand,
    "--vp-c-bg": p.bg,
    "--vp-c-bg-alt": p.bgAlt,
    "--vp-c-bg-soft": p.bgSoft,
    "--vp-c-bg-elv": p.bgElv,
    "--vp-c-divider": p.divider,
    "--vp-code-block-bg": p.code,
    "--vp-c-text-1": p.text1,
    "--vp-c-text-2": p.text2,
    "--vp-c-text-3": p.text3,
    "--vp-c-brand-2": p.brandHover,
  });
  expect(vars(block(":root"))).toMatchObject(expected(light));
  expect(vars(block(".dark"))).toMatchObject(expected(dark));
});
