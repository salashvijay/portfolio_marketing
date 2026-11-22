(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var P = window.VLPeppol;
  // A common starting point for each country; the rest are in the list.
  var DEFAULT = { BE: "0208", DE: "9930", FR: "0009", NL: "0106", NO: "0192", SE: "0007", DK: "0184", AU: "0151", IT: "0211", INT: "0088" };

  $("#ver").textContent = P.LIST_VERSION;
  $("#country").innerHTML = P.countries().map(function (c) {
    return '<option value="' + esc(c.cc) + '">' + esc(c.name) + "</option>";
  }).join("");
  $("#country").value = "BE";

  function fillSchemes() {
    var cc = $("#country").value;
    $("#scheme").innerHTML = P.forCountry(cc).map(function (s) {
      return '<option value="' + esc(s.icd) + '">' + esc(s.icd + " · " + s.name + (s.state === "deprecated" ? " (deprecated)" : "")) + "</option>";
    }).join("");
    if (DEFAULT[cc]) $("#scheme").value = DEFAULT[cc];
    var tip = P.TIPS[cc];
    $("#tip").innerHTML = tip ? '<ul class="list"><li class="info">' + esc(tip.text) + ' <a href="' + esc(tip.source) + '">Source: ' + esc(tip.by) + "</a></li></ul>" : "";
  }

  function show(r) {
    var h = "";
    if (r.ok) h += '<p class="verdict ok">✓ ' + esc(r.id) + (r.checkDigits ? " · check digit OK" : "") + "</p>";
    else h += '<p class="verdict bad">✗ ' + r.errors.length + " problem" + (r.errors.length === 1 ? "" : "s") + " found</p>";
    if (r.scheme) h += "<p><b>Scheme " + esc(r.scheme.icd) + "</b> · " + esc(r.scheme.id) + " · " + esc(r.scheme.name) + " · " + esc(P.COUNTRY[r.scheme.cc] || r.scheme.cc) + " · " + esc(r.scheme.state) + "</p>";
    if (r.errors.length) h += "<ul class='list'>" + r.errors.map(function (e) { return '<li class="err">' + esc(e) + "</li>"; }).join("") + "</ul>";
    if (r.warnings.length) h += "<ul class='list'>" + r.warnings.map(function (e) { return '<li class="warn">' + esc(e) + "</li>"; }).join("") + "</ul>";
    if (r.notes.length) h += "<ul class='list'>" + r.notes.map(function (e) { return '<li class="info">' + esc(e) + "</li>"; }).join("") + "</ul>";
    if (r.ok) {
      h += "<h2>Where it goes</h2><div class=\"scroll\"><table><tbody>" +
        "<tr><th>Peppol ID</th><td><code>" + esc(r.id) + "</code></td></tr>" +
        "<tr><th>Full form (network)</th><td><code>" + esc(r.full) + "</code></td></tr>" +
        "<tr><th>UBL invoice</th><td><code>" + esc('<cbc:EndpointID schemeID="' + r.icd + '">' + r.value + "</cbc:EndpointID>") + "</code></td></tr>" +
        "<tr><th>CII invoice</th><td><code>" + esc('<ram:URIID schemeID="' + r.icd + '">' + r.value + "</ram:URIID>") + "</code></td></tr>" +
        "</tbody></table></div>" +
        '<p class="fine">A correct format doesn\'t prove the company is registered on Peppol. Check the <a href="https://directory.peppol.eu/">Peppol Directory</a> or ask the buyer.</p>';
    }
    $("#out").innerHTML = h;
    $("#out").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("#country").addEventListener("change", fillSchemes);
  $("#build").addEventListener("click", function () { show(P.check($("#scheme").value, $("#num").value)); });
  $("#check").addEventListener("click", function () { show(P.parse($("#pid").value)); });
  [["#num", "#build"], ["#pid", "#check"]].forEach(function (p) {
    $(p[0]).addEventListener("keydown", function (e) { if (e.key === "Enter") $(p[1]).click(); });
  });
  fillSchemes();
})();
