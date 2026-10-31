const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { DOMParser } = require("@xmldom/xmldom");
const secrets = require("../js/secrets.js");
const impact = require("../js/impact.js");
const einvoice = require("../js/einvoice.js");

const sample = fs.readFileSync(path.join(__dirname, "..", "data", "sample-invoice.xml"), "utf8");

// ---------- e-invoice
test("valid sample invoice passes", () => {
  const r = einvoice.check(sample, DOMParser);
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.profile, "Peppol BIS Billing 3.0");
  assert.strictEqual(r.fields["Amount due"], "363 EUR");
});
test("wrong totals are caught", () => {
  const bad = sample.replace("<cbc:TaxInclusiveAmount currencyID=\"EUR\">363.00", "<cbc:TaxInclusiveAmount currencyID=\"EUR\">360.00");
  const r = einvoice.check(bad, DOMParser);
  assert.ok(r.errors.some((e) => e.rule === "BR-CO-15"));
  assert.ok(r.errors.some((e) => e.rule === "BR-CO-16"));
});
test("line sum mismatch is caught", () => {
  const bad = sample.replace("<cbc:LineExtensionAmount currencyID=\"EUR\">100.00</cbc:LineExtensionAmount>", "<cbc:LineExtensionAmount currencyID=\"EUR\">90.00</cbc:LineExtensionAmount>");
  assert.ok(einvoice.check(bad, DOMParser).errors.some((e) => e.rule === "BR-CO-10"));
});
test("missing mandatory fields are caught", () => {
  const bad = sample.replace(/<cbc:CustomizationID>.*<\/cbc:CustomizationID>/, "").replace("<cbc:ID>INV-2026-0042</cbc:ID>", "");
  const rules = einvoice.check(bad, DOMParser).errors.map((e) => e.rule);
  assert.ok(rules.includes("BT-24") && rules.includes("BT-1"));
});
test("non-XML and CII are reported clearly", () => {
  assert.strictEqual(einvoice.check("%PDF-1.7 not xml", DOMParser).ok, false);
  const cii = '<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"/>';
  assert.strictEqual(einvoice.check(cii, DOMParser).kind, "CII");
});

// ---------- impact ratio
test("selection rates and impact ratios", () => {
  const csv = "sex,selected\n" + "Female,1\n".repeat(20) + "Female,0\n".repeat(80) + "Male,1\n".repeat(40) + "Male,0\n".repeat(60) + "Unknown,1\n".repeat(5);
  const { records } = impact.parseCSV(csv);
  const t = impact.impactTable(records, ["sex"], "selected");
  const f = t.rows.find((r) => r.category === "Female"), m = t.rows.find((r) => r.category === "Male");
  assert.strictEqual(f.rate, 0.2); assert.strictEqual(m.rate, 0.4);
  assert.strictEqual(m.ratio, 1); assert.strictEqual(f.ratio, 0.5); assert.ok(f.flag);
  assert.strictEqual(t.unknown, 5);
});
test("small categories are excluded from the ratio", () => {
  const csv = "race,selected\n" + "A,1\n".repeat(60) + "A,0\n".repeat(40) + "B,1\n".repeat(1);
  const t = impact.impactTable(impact.parseCSV(csv).records, ["race"], "selected");
  const b = t.rows.find((r) => r.category === "B");
  assert.ok(b.excluded); assert.strictEqual(b.ratio, null);
  assert.strictEqual(t.rows.find((r) => r.category === "A").ratio, 1);
});
test("scoring mode uses the sample median", () => {
  const csv = "sex,score\nF,1\nF,2\nF,3\nM,4\nM,5\nM,6";
  const t = impact.impactTable(impact.parseCSV(csv).records, ["sex"], "score", { mode: "score" });
  assert.strictEqual(t.cutoff, 3.5);
  assert.strictEqual(t.rows.find((r) => r.category === "M").rate, 1);
  assert.strictEqual(t.rows.find((r) => r.category === "F").rate, 0);
});
test("intersectional categories and quoted CSV", () => {
  const csv = 'sex,race,selected\n"Female","Asian, East",yes\nFemale,"Asian, East",no\nMale,White,yes';
  const t = impact.impactTable(impact.parseCSV(csv).records, ["sex", "race"], "selected", { minShare: 0 });
  assert.ok(t.rows.some((r) => r.category === "Female × Asian, East" && r.rate === 0.5));
});

// ---------- secrets (all keys below are fake, built only for the test)
test("finds common keys and masks them", () => {
  const fakeOpenAI = "sk-proj-" + "a".repeat(30);
  const fakeAws = "AKIA" + "ABCDEFGHIJKLMNOP";
  const r = secrets.summarize(secrets.scanText(`const k = "${fakeOpenAI}";\naws = "${fakeAws}"`, "app.js"));
  assert.strictEqual(r.counts.critical, 2);
  assert.ok(r.findings.every((f) => !f.value.includes(fakeOpenAI)));
  assert.strictEqual(r.findings.find((f) => f.type === "AWS access key ID").line, 2);
});
test("Supabase service_role vs anon", () => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwt = (role) => b({ alg: "HS256" }) + "." + b({ iss: "supabase", role, ref: "abcdefghij" }) + ".c2lnbmF0dXJlLXRlc3Q";
  const f = secrets.scanText(`a="${jwt("service_role")}"\nb="${jwt("anon")}"`);
  assert.ok(f.some((x) => x.type === "Supabase service_role key" && x.severity === "critical"));
  assert.ok(f.some((x) => x.type === "Supabase anon key" && x.severity === "info"));
});
test("public env var with a secret name", () => {
  const f = secrets.scanText("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=xyz\nNEXT_PUBLIC_SUPABASE_URL=https://x");
  assert.strictEqual(f.filter((x) => x.severity === "high").length, 1);
});
test("clean code scores A", () => {
  assert.strictEqual(secrets.summarize(secrets.scanText("const x = process.env.OPENAI_API_KEY;")).grade, "A");
});

// ---------- deadlines data
test("every deadline has a date, an official or press label and a source", () => {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "deadlines.json"), "utf8"));
  for (const it of d.items) {
    assert.match(it.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(["official", "press"].includes(it.confidence));
    assert.match(it.source, /^https:\/\//);
  }
});
