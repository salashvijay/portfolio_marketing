(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var D = window.VLDupes;
  // Fictional data only.
  var SAMPLE = [
    "Supplier,Invoice number,Invoice date,Amount",
    "Acme Supplies Ltd,INV-0042,2026-10-03,1250.00",
    "ACME Supplies Limited,inv 42,2026-10-03,1250.00",
    "Blue Harbour Logistics,BH-901,2026-10-05,\"2,480.50\"",
    "Blue Harbour Logistics,BH-901,2026-10-19,\"2,840.50\"",
    "Northwind Paper,7731,2026-10-07,310.00",
    "Northwind Paper,7731-A,2026-10-07,310.00",
    "Greenfield Services,GF-118,2026-10-09,99.99"
  ].join("\n");

  function run() {
    var r = D.find($("#csv").value);
    var h = "";
    if (!r.ok) {
      h = '<p class="verdict bad">✗ Could not read the list</p><ul class="list">' + r.errors.map(function (e) { return '<li class="err">' + esc(e) + "</li>"; }).join("") + "</ul>";
    } else {
      h += r.groups.length
        ? '<p class="verdict bad">⚠ ' + r.groups.length + " possible duplicate group" + (r.groups.length === 1 ? "" : "s") + " in " + r.rows + " invoices</p>"
        : '<p class="verdict ok">✓ No duplicates found in ' + r.rows + " invoices</p>";
      r.groups.forEach(function (g) {
        h += "<h2>" + esc(g.label) + "</h2><div class=\"scroll\"><table><thead><tr><th>Line</th><th>Supplier</th><th>Invoice number</th><th>Date</th><th>Amount</th></tr></thead><tbody>" +
          g.items.map(function (x) {
            return "<tr><td>" + x.line + "</td><td>" + esc(x.supplier) + "</td><td>" + esc(x.number) + "</td><td>" + esc(x.dateText) + "</td><td>" + esc(x.amountText) + "</td></tr>";
          }).join("") + "</tbody></table></div>";
      });
      if (r.warnings.length) h += "<ul class='list'>" + r.warnings.map(function (e) { return '<li class="warn">' + esc(e) + "</li>"; }).join("") + "</ul>";
      h += '<p class="fine">These are possible duplicates, not proof. Look at the original invoices before you block or reverse a payment. Line numbers count the header as line 1.</p>';
    }
    $("#out").innerHTML = h;
    $("#out").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("#go").addEventListener("click", run);
  $("#sample").addEventListener("click", function () { $("#csv").value = SAMPLE; run(); });
  $("#file").addEventListener("change", function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { $("#csv").value = String(rd.result); run(); };
    rd.readAsText(f);
  });
})();
