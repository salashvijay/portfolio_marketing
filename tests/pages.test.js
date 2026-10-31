// End-to-end: load each page in a simulated browser, run its scripts, click, check output.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const ROOT = path.join(__dirname, "..");

function page(name) {
  const html = fs.readFileSync(path.join(ROOT, name), "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://labs.vihsmai.com/" + name });
  const w = dom.window;
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.fetch = async (u) => {
    const p = path.join(ROOT, String(u).replace(/^https:\/\/labs\.vihsmai\.com\//, ""));
    const body = fs.readFileSync(p, "utf8");
    return { ok: true, json: async () => JSON.parse(body), text: async () => body };
  };
  for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) w.eval(fs.readFileSync(path.join(ROOT, m[1]), "utf8"));
  return w;
}
const tick = () => new Promise((r) => setTimeout(r, 30));

test("no inline scripts or external resources (CSP-safe)", () => {
  for (const f of ["index.html", "deadlines.html", "einvoice.html", "bias.html", "keys.html", "ai-disclosure.html"]) {
    const h = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(!/<script>(?!\s*<\/script>)/.test(h), f + " has an inline script");
    assert.ok(!/<script[^>]+src="https?:/.test(h) && !/<link[^>]+href="https?:\/\/(?!labs\.vihsmai)/.test(h.replace(/<link rel="canonical"[^>]*>/, "")), f + " loads an external resource");
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
