const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { DOMParser } = require("@xmldom/xmldom");
const secrets = require("../js/secrets.js");
const impact = require("../js/impact.js");
const einvoice = require("../js/einvoice.js");
const peppol = require("../js/peppol.js");
const gst = require("../js/gst-irp.js");

test("GST 30-day window: dates, states, month ends, bad input", () => {
  let r = gst.check("2026-10-20", "2026-11-01", "10cr_plus");
  assert.strictEqual(r.lastDay, "2026-11-19"); assert.strictEqual(r.age, 12); assert.strictEqual(r.daysLeft, 18); assert.strictEqual(r.state, "open");
  assert.strictEqual(r.aimFor, "2026-11-16");
  assert.strictEqual(gst.check("2026-01-31", "2026-02-01", "10cr_plus").lastDay, "2026-03-02");
  assert.strictEqual(gst.check("2024-02-15", "2024-02-16", "10cr_plus").lastDay, "2024-03-16");
  assert.strictEqual(gst.check("2026-10-04", "2026-11-01", "10cr_plus").state, "urgent");
  assert.strictEqual(gst.check("2026-10-02", "2026-11-01", "10cr_plus").state, "urgent");
  assert.strictEqual(gst.check("2026-10-01", "2026-11-01", "10cr_plus").state, "expired");
  assert.strictEqual(gst.check("2026-09-01", "2026-11-01", "below10cr").state, "no-limit");
  assert.strictEqual(gst.check("2026-12-01", "2026-11-01", "10cr_plus").state, "future");
  assert.strictEqual(gst.check("2026-02-30", "2026-11-01", "10cr_plus").ok, false);
});

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
test("non-XML and an empty CII invoice are reported clearly", () => {
  assert.strictEqual(einvoice.check("%PDF-1.7 not xml", DOMParser).ok, false);
  const cii = '<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"/>';
  const r = einvoice.check(cii, DOMParser);
  assert.strictEqual(r.kind, "CII");
  assert.ok(["BT-24", "BT-1", "BG-4", "BG-22"].every((x) => r.errors.some((e) => e.rule === x)));
});

// ---------- e-invoice: CII (Factur-X / ZUGFeRD / XRechnung CII)
const sampleCII = fs.readFileSync(path.join(__dirname, "..", "data", "sample-invoice-cii.xml"), "utf8");
test("valid CII sample passes", () => {
  const r = einvoice.check(sampleCII, DOMParser);
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.warnings, []);
  assert.strictEqual(r.kind, "CII");
  assert.strictEqual(r.profile, "EN 16931 (Factur-X / ZUGFeRD EN 16931 profile)");
  assert.strictEqual(r.fields["Amount due"], "360 EUR");
  assert.strictEqual(r.fields["Seller"], "Exemple Fournisseur SAS");
});
test("CII wrong totals and line sum are caught", () => {
  const bad = sampleCII.replace("<ram:GrandTotalAmount>360.00", "<ram:GrandTotalAmount>350.00")
    .replace("<ram:LineTotalAmount>100.00</ram:LineTotalAmount>", "<ram:LineTotalAmount>90.00</ram:LineTotalAmount>");
  const rules = einvoice.check(bad, DOMParser).errors.map((e) => e.rule);
  assert.ok(["BR-CO-10", "BR-CO-15", "BR-CO-16"].every((x) => rules.includes(x)), rules.join());
});
test("CII: VAT in a second accounting currency is ignored", () => {
  const two = sampleCII.replace('<ram:TaxTotalAmount currencyID="EUR">60.00</ram:TaxTotalAmount>',
    '<ram:TaxTotalAmount currencyID="CHF">57.00</ram:TaxTotalAmount><ram:TaxTotalAmount currencyID="EUR">60.00</ram:TaxTotalAmount>');
  assert.strictEqual(einvoice.check(two, DOMParser).ok, true);
});
test("CII: bad date format, XRechnung buyer reference, MINIMUM profile", () => {
  let r = einvoice.check(sampleCII.replace(">20261015<", ">2026-10-15<"), DOMParser);
  assert.ok(r.errors.some((e) => e.rule === "BT-2"));
  r = einvoice.check(sampleCII.replace("urn:cen.eu:en16931:2017<", "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0<")
    .replace("<ram:BuyerReference>PO-7781</ram:BuyerReference>", ""), DOMParser);
  assert.strictEqual(r.profile, "XRechnung (CII)");
  assert.ok(r.errors.some((e) => e.rule === "BT-10"));
  const min = sampleCII.replace("urn:cen.eu:en16931:2017<", "urn:factur-x.eu:1p0:minimum<")
    .replace(/<ram:IncludedSupplyChainTradeLineItem>[\s\S]*<\/ram:IncludedSupplyChainTradeLineItem>/, "")
    .replace("<ram:LineTotalAmount>300.00</ram:LineTotalAmount>", "");
  r = einvoice.check(min, DOMParser);
  assert.strictEqual(r.profile, "Factur-X / ZUGFeRD MINIMUM");
  assert.deepStrictEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => w.rule === "PROFILE"));
});

// ---------- e-invoice: XML embedded in a Factur-X / ZUGFeRD PDF
const zlib = require("node:zlib");
function fakePdf(xml, { flate = true, indirectLength = false } = {}) {
  const data = flate ? zlib.deflateSync(Buffer.from(xml, "utf8")) : Buffer.from(xml, "utf8");
  const len = indirectLength ? "9 0 R" : String(data.length);
  return new Uint8Array(Buffer.concat([
    Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n4 0 obj\n<< /Length 5 >>\nstream\nhello\nendstream\nendobj\n"),
    Buffer.from("7 0 obj\n<< /Type /EmbeddedFile /Subtype /text#2Fxml " + (flate ? "/Filter /FlateDecode " : "") + "/Length " + len + " >>\nstream\r\n"),
    data,
    Buffer.from("\r\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n")
  ]));
}
test("finds the XML inside a Factur-X PDF (compressed, plain, indirect length)", async () => {
  for (const opts of [{}, { flate: false }, { indirectLength: true }]) {
    const xml = await einvoice.xmlFromPdf(fakePdf(sampleCII, opts));
    assert.ok(xml && xml.includes("FA-2026-0107"), JSON.stringify(opts));
    assert.strictEqual(einvoice.check(xml, DOMParser).ok, true);
  }
});
test("a plain PDF or a non-PDF gives null", async () => {
  const plain = new Uint8Array(Buffer.from("%PDF-1.7\n1 0 obj\n<< /Length 5 >>\nstream\nhello\nendstream\nendobj\n%%EOF"));
  assert.strictEqual(await einvoice.xmlFromPdf(plain), null);
  assert.strictEqual(await einvoice.xmlFromPdf(new Uint8Array(Buffer.from("not a pdf"))), null);
});

// ---------- Peppol ID (sample numbers are made up; check digits computed independently)
test("Belgian enterprise number: cleaned, padded, check digit", () => {
  let r = peppol.check("0208", "BE 0123.456.749");
  assert.strictEqual(r.ok, true); assert.strictEqual(r.id, "0208:0123456749");
  assert.strictEqual(r.full, "iso6523-actorid-upis::0208:0123456749");
  assert.strictEqual(peppol.check("0208", "123456749").value, "0123456749");
  r = peppol.check("0208", "0123456748");
  assert.strictEqual(r.ok, false); assert.match(r.errors[0], /check digit/);
  assert.strictEqual(peppol.check("9925", "0123456749").id, "9925:BE0123456749");
});
test("check digits for the common schemes", () => {
  const good = { "0088": "5400000000010", "0192": "923113002", "0007": "5566778899", "0002": "732829320", "0009": "73282932000157",
    "0151": "51 824 753 556", "0199": "5493001KJTIIGC8Y1R12", "9918": "GB82 WEST 1234 5698 7654 32", "0106": "12345678", "0060": "123456789" };
  for (const [icd, v] of Object.entries(good)) assert.strictEqual(peppol.check(icd, v).ok, true, icd + " " + v);
  const bad = { "0088": "5400000000011", "0192": "923113003", "0007": "5566778898", "0009": "73282932000158", "0151": "51824753557",
    "0199": "5493001KJTIIGC8Y1R13", "9918": "GB82WEST12345698765433", "0106": "1234567" };
  for (const [icd, v] of Object.entries(bad)) assert.strictEqual(peppol.check(icd, v).ok, false, icd + " " + v);
  assert.strictEqual(peppol.check("0192", "NO923113002MVA").value, "923113002");
});
test("VAT schemes warn about the country prefix; Leitweg-ID is taken as given", () => {
  assert.ok(peppol.check("9930", "123456789").warnings.some((w) => /DE123456789/.test(w)));
  assert.ok(peppol.check("9930", "FR123456789").warnings.some((w) => /Germany/.test(w)));
  assert.deepStrictEqual(peppol.check("9930", "de123456789").warnings, []);
  assert.deepStrictEqual(peppol.check("9933", "EL123456789").warnings, []);
  const lw = peppol.check("0204", "04000000-FHBXLAND-82");
  assert.strictEqual(lw.ok, true); assert.strictEqual(lw.value, "04000000-FHBXLAND-82");
});
test("scheme states and parsing", () => {
  assert.strictEqual(peppol.SCHEMES.length, 105);
  assert.strictEqual(peppol.check("9958", "x").ok, false);                       // removed
  assert.ok(peppol.check("9909", "NO923113002MVA").warnings.length > 0);        // deprecated
  assert.match(peppol.check("1234", "1").errors[0], /not in the Peppol/);
  assert.strictEqual(peppol.parse("iso6523-actorid-upis::0208:0123456749").ok, true);
  assert.strictEqual(peppol.parse(" 0208 : 0123456749 ").id, "0208:0123456749");
  assert.strictEqual(peppol.parse("0123456749").ok, false);
  assert.ok(peppol.forCountry("BE").some((s) => s.icd === "0088"));
  assert.ok(!peppol.forCountry("BE").some((s) => s.state === "removed"));
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
