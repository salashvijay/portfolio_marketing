const test = require("node:test");
const assert = require("node:assert");
const d = require("../js/dupes.js");

test("amounts: separators, symbols, negatives", () => {
  assert.strictEqual(d.parseAmount("1,234.50"), 123450);
  assert.strictEqual(d.parseAmount("1.234,50"), 123450);
  assert.strictEqual(d.parseAmount("Rs 1234"), 123400);
  assert.strictEqual(d.parseAmount("12,50"), 1250);
  assert.strictEqual(d.parseAmount("1,234"), 123400);
  assert.strictEqual(d.parseAmount("(500.00)"), -50000);
  assert.strictEqual(d.parseAmount("abc"), null);
  assert.strictEqual(d.parseAmount(""), null);
});
test("dates: ISO, day-first, month name, invalid", () => {
  assert.strictEqual(d.parseDate("2026-10-03"), "2026-10-03");
  assert.strictEqual(d.parseDate("03/10/2026"), "2026-10-03");
  assert.strictEqual(d.parseDate("3 Oct 2026"), "2026-10-03");
  assert.strictEqual(d.parseDate("31.02.2026"), null);
  assert.strictEqual(d.parseDate("soon"), null);
});
test("normalising numbers and supplier names", () => {
  assert.strictEqual(d.normNumber("INV-0042"), d.normNumber("inv 42"));
  assert.strictEqual(d.normNumber("A-100"), "A100");
  assert.strictEqual(d.normNumber("0042"), "42");
  assert.strictEqual(d.normNumber("000"), "0");
  assert.strictEqual(d.normSupplier("Acme Supplies Ltd."), d.normSupplier("ACME supplies LIMITED"));
});
test("CSV: quotes, semicolons, BOM, blank lines", () => {
  const r = d.parseCsv('﻿a;b\r\n"x;y";"he said ""hi"""\r\n\r\n');
  assert.strictEqual(r.delimiter, ";");
  assert.deepStrictEqual(r.rows, [["a", "b"], ["x;y", 'he said "hi"']]);
});
test("finds exact, reused-number and same-amount-date groups, each row once", () => {
  const csv = [
    "Supplier,Invoice no,Date,Total",
    "Acme Ltd,A-1,2026-10-01,100.00",
    "ACME Limited,a1,01/10/2026,100",
    "Beta,B-9,2026-10-02,50",
    "Beta,B-9,2026-10-09,55",
    "Gamma,G-1,2026-10-03,75",
    "Gamma,G-1x,2026-10-03,75",
    "Delta,D-1,2026-10-04,10"
  ].join("\n");
  const r = d.find(csv);
  assert.ok(r.ok);
  assert.deepStrictEqual(r.groups.map((g) => g.kind), ["exact", "number-reused", "same-amount-date"]);
  assert.deepStrictEqual(r.groups[0].items.map((x) => x.line), [2, 3]);
  assert.strictEqual(r.rows, 7);
});
test("different suppliers with the same number are not flagged", () => {
  const r = d.find("Supplier,Invoice,Amount\nA,1,10\nB,1,10");
  assert.ok(r.ok);
  assert.strictEqual(r.groups.length, 0);
});
test("missing columns and too few rows give clear errors", () => {
  assert.match(d.find("a,b\n1,2").errors[0], /Could not find a column/);
  assert.match(d.find("Supplier,Invoice,Amount").errors[0], /at least two invoices/);
  const r = d.find("Supplier,Invoice,Amount\nA,1,x\nA,2,5");
  assert.ok(r.warnings.some((w) => /not a number/.test(w)));
  assert.ok(d.find("Supplier,Invoice,Amount\nA,1,5\nA,2,5").warnings.some((w) => /No date column/.test(w)));
});
