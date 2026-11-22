// End-to-end: load each page in a simulated browser, run its scripts, click, check output.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const ROOT = path.join(__dirname, "..");

function page(name) {
  const html = fs.readFileSync(path.join(ROOT, name), "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://vihsmai.com/labs/" + name });
  const w = dom.window;
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.fetch = async (u) => {
    const p = path.join(ROOT, String(u).replace(/^https:\/\/vihsmai\.com\/labs\//, ""));
    const body = fs.readFileSync(p, "utf8");
    return { ok: true, json: async () => JSON.parse(body), text: async () => body };
  };
  for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(fs.readFileSync(path.join(ROOT, m[1]), "utf8"));
  return w;
}
const tick = () => new Promise((r) => setTimeout(r, 30));

test("no inline scripts or external resources (CSP-safe)", () => {
  for (const f of ["index.html", "deadlines.html", "einvoice.html", "bias.html", "keys.html", "ai-disclosure.html", "peppol-id.html", "gst-irp.html", "dupes.html"]) {
    const h = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(!/<script>(?!\s*<\/script>)/.test(h), f + " has an inline script");
    assert.ok(!/<script[^>]+src="https?:/.test(h) && !/<link[^>]+href="https?:\/\/(?!vihsmai\.com)/.test(h.replace(/<link rel="canonical"[^>]*>/, "")), f + " loads an external resource");
    assert.ok(/<title>.+<\/title>/.test(h) && /name="description"/.test(h), f + " missing title/description");
  }
});
test("deadlines page renders rows with sources", async () => {
  const w = page("deadlines.html"); await tick();
  const rows = w.document.querySelectorAll("#rows tr");
  assert.ok(rows.length >= 15, "rows: " + rows.length);
  assert.ok(w.document.querySelector("#rows a").href.startsWith("https://"));
  w.document.querySelector("#when").value = "live"; w.document.querySelector("#when").dispatchEvent(new w.Event("change"));
  assert.ok([...w.document.querySelectorAll("#rows tr")].every((r) => /in force/.test(r.textContent)));
});
test("e-invoice page: sample passes, broken XML fails", async () => {
  const w = page("einvoice.html");
  w.document.querySelector("#sample").click(); await tick();
  assert.match(w.document.querySelector("#out").textContent, /basic checks pass/);
  w.document.querySelector("#xml").value = "<Invoice xmlns='urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'/>";
  w.document.querySelector("#go").click();
  assert.match(w.document.querySelector("#out").textContent, /problems found/);
  w.document.querySelector("#sample-cii").click(); await tick();
  assert.match(w.document.querySelector("#out").textContent, /basic checks pass \(EN 16931/);
});
test("e-invoice page: a Factur-X PDF dropped on the page is read", async () => {
  const w = page("einvoice.html");
  w.DecompressionStream = DecompressionStream;
  const zlib = require("node:zlib");
  const xml = fs.readFileSync(path.join(ROOT, "data", "sample-invoice-cii.xml"));
  const data = zlib.deflateSync(xml);
  const head = ["%PDF-1.7", "5 0 obj", "<< /Type /EmbeddedFile /Filter /FlateDecode /Length " + data.length + " >>", "stream", ""].join(String.fromCharCode(10));
  const pdf = Buffer.concat([Buffer.from(head), data, Buffer.from(String.fromCharCode(10) + "endstream endobj %%EOF")]);
  const file = new w.File([pdf], "invoice.pdf", { type: "application/pdf" });
  const input = w.document.querySelector("#file");
  Object.defineProperty(input, "files", { value: [file] });
  input.dispatchEvent(new w.Event("change"));
  for (let i = 0; i < 20 && !/basic checks/.test(w.document.querySelector("#out").textContent); i++) await tick();
  assert.match(w.document.querySelector("#out").textContent, /basic checks pass/);
  assert.match(w.document.querySelector("#xml").value, /FA-2026-0107/);
});
test("peppol page: builds a Belgian ID, flags a typo, escapes input", () => {
  const w = page("peppol-id.html");
  const d = w.document;
  assert.strictEqual(d.querySelector("#scheme").value, "0208");
  assert.match(d.querySelector("#tip").textContent, /enterprise number/);
  d.querySelector("#num").value = "BE 0123.456.749";
  d.querySelector("#build").click();
  assert.match(d.querySelector("#out").textContent, /0208:0123456749 · check digit OK/);
  assert.match(d.querySelector("#out").textContent, /iso6523-actorid-upis::0208:0123456749/);
  d.querySelector("#pid").value = "0208:0123456748";
  d.querySelector("#check").click();
  assert.match(d.querySelector("#out").textContent, /check digit doesn't match/);
  d.querySelector("#pid").value = "9930:<img src=x onerror=alert(1)>";
  d.querySelector("#check").click();
  assert.strictEqual(d.querySelector("#out img"), null);
  d.querySelector("#country").value = "DE"; d.querySelector("#country").dispatchEvent(new w.Event("change"));
  assert.strictEqual(d.querySelector("#scheme").value, "9930");
  assert.match(d.querySelector("#tip").textContent, /Leitweg-ID/);
});
test("gst page: open, expired and no-limit cases", () => {
  const w = page("gst-irp.html");
  const d = w.document;
  d.querySelector("#today").value = "2026-11-01";
  d.querySelector("#inv").value = "2026-10-20";
  d.querySelector("#go").click();
  assert.match(d.querySelector("#out").textContent, /18 days left/);
  assert.match(d.querySelector("#out").textContent, /2026-11-19/);
  d.querySelector("#inv").value = "2026-09-01";
  d.querySelector("#go").click();
  assert.match(d.querySelector("#out").textContent, /30 days have passed/);
  d.querySelector("#aato").value = "below10cr";
  d.querySelector("#go").click();
  assert.match(d.querySelector("#out").textContent, /No 30-day limit/);
  d.querySelector("#inv").value = "not a date";
  d.querySelector("#go").click();
  assert.match(d.querySelector("#out").textContent, /YYYY-MM-DD/);
});
test("dupes page: sample finds three groups, escapes input", () => {
  const w = page("dupes.html");
  const d = w.document;
  d.querySelector("#sample").click();
  assert.match(d.querySelector("#out").textContent, /3 possible duplicate groups in 7 invoices/);
  assert.strictEqual(d.querySelectorAll("#out table").length, 3);
  d.querySelector("#csv").value = "Supplier,Invoice no,Amount\n<img src=x onerror=alert(1)>,1,5\n<img src=x onerror=alert(1)>,1,5";
  d.querySelector("#go").click();
  assert.strictEqual(d.querySelector("#out img"), null);
  assert.match(d.querySelector("#out").textContent, /1 possible duplicate group/);
  d.querySelector("#csv").value = "a,b\n1,2";
  d.querySelector("#go").click();
  assert.match(d.querySelector("#out").textContent, /Could not find a column/);
});
test("bias page: sample shows three tables with impact ratios", async () => {
  const w = page("bias.html");
  w.document.querySelector("#sample").click(); await tick();
  const tables = w.document.querySelectorAll("#out table");
  assert.strictEqual(tables.length, 3);
  assert.match(w.document.querySelector("#out").textContent, /Impact ratio/);
  assert.match(w.document.querySelector("#out").textContent, /unknown/);
});
test("keys page: finds a fake key in pasted text, masks it", () => {
  const w = page("keys.html");
  const fake = "sk-ant-" + "x".repeat(30);
  w.document.querySelector("#code").value = 'const k="' + fake + '"';
  w.document.querySelector("#go").click();
  const out = w.document.querySelector("#out").textContent;
  assert.match(out, /Anthropic API key/); assert.ok(!out.includes(fake));
});
test("disclosure page: writes the chat notice with the business name, escaped", () => {
  const w = page("ai-disclosure.html");
  w.document.querySelector("#biz").value = "Acme <b>Ltd</b>";
  w.document.querySelector("#human").value = "help@acme.test";
  w.document.querySelector("#go").click();
  const out = w.document.querySelector("#out");
  assert.match(out.textContent, /Acme <b>Ltd<\/b>'s AI assistant/);
  assert.strictEqual(out.querySelectorAll("b").length > 0 && [...out.querySelectorAll("pre b")].length, 0);
  assert.match(out.textContent, /email help@acme\.test/);
});
