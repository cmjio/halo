import { test, expect, describe } from "bun:test";
import { Sheet } from "./index";

const sheet = (cells: Record<string, string>) => {
  const s = new Sheet();
  for (const [ref, raw] of Object.entries(cells)) s.set(ref, raw);
  return s;
};

describe("cells", () => {
  test("numbers, strings and empty cells", () => {
    const s = sheet({ A1: "5", A2: "-2.5", A3: " 4 ", B1: "hello", B2: "" });
    expect(s.get("A1")).toBe(5);
    expect(s.get("A2")).toBe(-2.5);
    expect(s.get("A3")).toBe(4);
    expect(s.get("B1")).toBe("hello");
    expect(s.get("B2")).toBeNull();
    expect(s.get("Z99")).toBeNull();
  });

  test("references are case-insensitive, and getRaw returns what was set", () => {
    const s = sheet({ a1: "3", B1: "=a1+1" });
    expect(s.get("A1")).toBe(3);
    expect(s.get("b1")).toBe(4);
    expect(s.getRaw("B1")).toBe("=a1+1");
    expect(s.getRaw("C1")).toBe("");
  });

  test("multi-letter columns", () => {
    const s = sheet({ AA1: "2", AB1: "=AA1*10" });
    expect(s.get("AB1")).toBe(20);
  });
});

describe("arithmetic", () => {
  test("precedence and parentheses", () => {
    const s = sheet({ A1: "=1+2*3", A2: "=(1+2)*3", A3: "=10-4-3", A4: "=2^3^2", A5: "=-3+5", A6: "=8/4/2" });
    expect(s.get("A1")).toBe(7);
    expect(s.get("A2")).toBe(9);
    expect(s.get("A3")).toBe(3);
    expect(s.get("A4")).toBe(512);
    expect(s.get("A5")).toBe(2);
    expect(s.get("A6")).toBe(1);
  });

  test("cell references, and empty cells count as 0", () => {
    const s = sheet({ A1: "4", A2: "=A1*A1", A3: "=A2+B9" });
    expect(s.get("A2")).toBe(16);
    expect(s.get("A3")).toBe(16);
  });

  test("decimals and whitespace", () => {
    const s = sheet({ A1: "= 1.5 * ( 2 + 2 ) ", A2: "=.5+.25" });
    expect(s.get("A1")).toBe(6);
    expect(s.get("A2")).toBe(0.75);
  });

  test("comparisons give 1 or 0", () => {
    const s = sheet({ A1: "5", B1: "=A1>3", B2: "=A1<3", B3: "=A1=5", B4: "=A1<>5", B5: "=A1>=5", B6: "=A1<=4" });
    expect([1, 2, 3, 4, 5, 6].map((r) => s.get(`B${r}`))).toEqual([1, 0, 1, 0, 1, 0]);
  });

  test("comparison is lower precedence than arithmetic", () => {
    expect(sheet({ A1: "=1+2=3" }).get("A1")).toBe(1);
  });
});

describe("strings", () => {
  test("literals and concatenation", () => {
    const s = sheet({ A1: "Ada", A2: '="Hello, "&A1', A3: '=A1&" "&1+2', A4: '=""&B9&"x"' });
    expect(s.get("A2")).toBe("Hello, Ada");
    expect(s.get("A3")).toBe("Ada 3");
    expect(s.get("A4")).toBe("x");
  });

  test("a string in arithmetic is #VALUE!", () => {
    const s = sheet({ A1: "abc", A2: "=A1+1", A3: "=-A1", A4: '="2"*3' });
    expect(s.get("A2")).toBe("#VALUE!");
    expect(s.get("A3")).toBe("#VALUE!");
    expect(s.get("A4")).toBe("#VALUE!");
  });
});

describe("functions", () => {
  const s = sheet({ A1: "1", A2: "2", A3: "3", A4: "text", B1: "10", B2: "", B3: "-5" });

  test("SUM over ranges and values, skipping text and empty cells", () => {
    const t = sheet({ ...cells(s), C1: "=SUM(A1:A4)", C2: "=SUM(A1:B3, 100)", C3: "=sum(a1:a2)" });
    expect(t.get("C1")).toBe(6);
    expect(t.get("C2")).toBe(111);
    expect(t.get("C3")).toBe(3);
  });

  test("AVERAGE, MIN, MAX, COUNT", () => {
    const t = sheet({ ...cells(s), C1: "=AVERAGE(A1:A4)", C2: "=MIN(A1:B3)", C3: "=MAX(A1:B3)", C4: "=COUNT(A1:B3)" });
    expect(t.get("C1")).toBe(2);
    expect(t.get("C2")).toBe(-5);
    expect(t.get("C3")).toBe(10);
    expect(t.get("C4")).toBe(5);
  });

  test("AVERAGE of no numbers is #DIV/0!", () => {
    expect(sheet({ A1: "x", B1: "=AVERAGE(A1:A3)" }).get("B1")).toBe("#DIV/0!");
  });

  test("ABS and ROUND", () => {
    const t = sheet({ A1: "=ABS(-7)", A2: "=ROUND(3.14159, 2)", A3: "=ROUND(2.5, 0)", A4: "=ROUND(1234, -2)" });
    expect(t.get("A1")).toBe(7);
    expect(t.get("A2")).toBe(3.14);
    expect(t.get("A3")).toBe(3);
    expect(t.get("A4")).toBe(1200);
  });

  test("IF picks a branch, and only evaluates that one", () => {
    const t = sheet({ A1: "5", B1: '=IF(A1>3, "big", "small")', B2: "=IF(A1>9, 1, 2)", B3: "=IF(1, 7, 1/0)", B4: "=IF(0, 1/0, 8)" });
    expect(t.get("B1")).toBe("big");
    expect(t.get("B2")).toBe(2);
    expect(t.get("B3")).toBe(7);
    expect(t.get("B4")).toBe(8);
  });

  test("nested functions", () => {
    expect(sheet({ A1: "2", A2: "4", B1: "=ROUND(AVERAGE(A1:A2)*SUM(A1:A2, 1)/3, 1)" }).get("B1")).toBe(7);
  });

  test("an unknown function is #NAME?", () => {
    expect(sheet({ A1: "=NOPE(1)" }).get("A1")).toBe("#NAME?");
  });
});

describe("errors", () => {
  test("division by zero", () => {
    const s = sheet({ A1: "=1/0", A2: "=5/B9" });
    expect(s.get("A1")).toBe("#DIV/0!");
    expect(s.get("A2")).toBe("#DIV/0!");
  });

  test("formulas that don't parse", () => {
    const s = sheet({ A1: "=1+", A2: "=(1", A3: "=1 2", A4: "=A1:A2", A5: "=", A6: '="open' });
    for (const r of ["A1", "A2", "A3", "A4", "A5", "A6"]) expect(s.get(r)).toBe("#ERROR!");
  });

  test("errors propagate through references and ranges", () => {
    const s = sheet({ A1: "=1/0", A2: "=A1+1", A3: "=SUM(A1:A2)", A4: "=A2&\"x\"" });
    expect(s.get("A2")).toBe("#DIV/0!");
    expect(s.get("A3")).toBe("#DIV/0!");
    expect(s.get("A4")).toBe("#DIV/0!");
  });

  test("the first error reached left to right wins", () => {
    const s = sheet({ A1: "=1/0", A2: "x", B1: "=A1+A2", B2: "=(A2+1)+A1" });
    expect(s.get("B1")).toBe("#DIV/0!");
    expect(s.get("B2")).toBe("#VALUE!");
  });
});

describe("cycles", () => {
  test("cells in a cycle, and cells that depend on one, are #CYCLE!", () => {
    const s = sheet({ A1: "=B1+1", B1: "=A1+1", C1: "=A1*2", D1: "=D1", E1: "7" });
    expect(s.get("A1")).toBe("#CYCLE!");
    expect(s.get("B1")).toBe("#CYCLE!");
    expect(s.get("C1")).toBe("#CYCLE!");
    expect(s.get("D1")).toBe("#CYCLE!");
    expect(s.get("E1")).toBe(7);
  });

  test("breaking a cycle recomputes the cells", () => {
    const s = sheet({ A1: "=B1+1", B1: "=A1+1", C1: "=A1*2" });
    s.set("B1", "10");
    expect(s.get("A1")).toBe(11);
    expect(s.get("C1")).toBe(22);
  });

  test("a range that includes the cell itself is a cycle", () => {
    expect(sheet({ A1: "1", A3: "=SUM(A1:A3)" }).get("A3")).toBe("#CYCLE!");
  });
});

describe("recalculation", () => {
  test("changing a cell updates everything that depends on it", () => {
    const s = sheet({ A1: "1", A2: "=A1+1", A3: "=A2*10", A4: "=SUM(A1:A3)" });
    expect(s.get("A4")).toBe(23);
    s.set("A1", "2");
    expect(s.get("A2")).toBe(3);
    expect(s.get("A3")).toBe(30);
    expect(s.get("A4")).toBe(35);
  });

  test("a formula can refer to a cell set later", () => {
    const s = sheet({ B1: "=A1*3" });
    expect(s.get("B1")).toBe(0);
    s.set("A1", "4");
    expect(s.get("B1")).toBe(12);
  });

  test("replacing a formula drops its old dependencies", () => {
    const s = sheet({ A1: "1", B1: "=A1", C1: "5" });
    s.set("B1", "=C1");
    s.set("A1", "100");
    expect(s.get("B1")).toBe(5);
  });

  test("a long chain", () => {
    const s = new Sheet();
    s.set("A1", "1");
    for (let i = 2; i <= 500; i++) s.set(`A${i}`, `=A${i - 1}+1`);
    expect(s.get("A500")).toBe(500);
    s.set("A1", "1001");
    expect(s.get("A500")).toBe(1500);
  });
});

describe("CSV", () => {
  test("rows and columns, with empty cells and errors", () => {
    const s = sheet({ A1: "1", B1: "x", A2: "=A1*2", C2: "=1/0" });
    expect(s.toCSV("A1:C2")).toBe("1,x,\n2,,#DIV/0!");
  });
});

function cells(s: Sheet): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of ["A", "B"]) for (let r = 1; r <= 4; r++) if (s.getRaw(`${c}${r}`) !== "") out[`${c}${r}`] = s.getRaw(`${c}${r}`);
  return out;
}
