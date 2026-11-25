// Halo's colours: the colours of the words in a .halo file.
//
// Dark is the reference: keywords orange, declared names and directives blue, constants lilac,
// strings green, model ids amber. Light uses the same hues, darkened until each one reads at
// 4.5:1 or better on every light background, inline-code and table-row greys included
// (WCAG 2.2 AA for body text).
//
// custom.css repeats these values as CSS variables, and the code-block themes in shiki.ts are
// built from them. test/site-palette.test.ts checks that the two agree and that every pair the
// site draws text with meets AA.

export type Palette = {
  bg: string;
  bgAlt: string;
  bgSoft: string;
  bgElv: string;
  code: string;
  divider: string;
  /** Borders that identify a control (inputs, toggles): 3:1 against the background. */
  control: string;
  text1: string;
  text2: string;
  text3: string;
  /** Brackets, commas, separators in code. */
  punct: string;
  keyword: string;
  name: string;
  constant: string;
  string: string;
  model: string;
  comment: string;
  /** Effects: read, write, and external. */
  danger: string;
  /** Text on a filled brand button. */
  onBrand: string;
  brandHover: string;
};

export const dark: Palette = {
  bg: "#0d1016",
  bgAlt: "#0a0d12",
  bgSoft: "#141820",
  bgElv: "#171b23",
  code: "#0a0d12",
  divider: "#262c36",
  control: "#6b7380",
  text1: "#e6e4df",
  text2: "#b8bcc3",
  text3: "#8b929c",
  punct: "#a6a4a0",
  keyword: "#ff8f3f",
  name: "#5ac2fe",
  constant: "#d1a6ff",
  string: "#a9d94c",
  model: "#e5b572",
  comment: "#8b929c",
  danger: "#f26d78",
  onBrand: "#0d1016",
  brandHover: "#ffa463",
};

export const light: Palette = {
  bg: "#ffffff",
  bgAlt: "#f7f8fa",
  bgSoft: "#f5f6f8",
  bgElv: "#ffffff",
  code: "#f7f8fa",
  divider: "#e2e4e8",
  control: "#7a818c",
  text1: "#1c2027",
  text2: "#3d434c",
  text3: "#5c6370",
  punct: "#716f6a",
  keyword: "#ac4800",
  name: "#0174b6",
  constant: "#9633ff",
  string: "#587819",
  model: "#98641c",
  comment: "#5c6370",
  danger: "#db1424",
  onBrand: "#ffffff",
  brandHover: "#963e00",
};
