(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var MAX = 5 * 1024 * 1024;

  function show(r) {
    var h = "";
    if (r.ok) h += '<p class="verdict ok">✓ The basic checks pass' + (r.profile ? " (" + esc(r.profile) + ")" : "") + ".</p>";
    else h += '<p class="verdict bad">✗ ' + r.errors.length + " problem" + (r.errors.length === 1 ? "" : "s") + " found" + (r.profile ? " (" + esc(r.profile) + ")" : "") + ".</p>";
    var f = Object.keys(r.fields).filter(function (k) { return r.fields[k]; });
    if (f.length) h += "<p>" + f.map(function (k) { return "<b>" + esc(k) + ":</b> " + esc(r.fields[k]); }).join(" · ") + "</p>";
    if (r.errors.length) h += "<h2>Must fix</h2><ul class='list'>" + r.errors.map(function (e) { return '<li class="err"><span class="tag">' + esc(e.rule) + "</span>" + esc(e.msg) + "</li>"; }).join("") + "</ul>";
    if (r.warnings.length) h += "<h2>Check these</h2><ul class='list'>" + r.warnings.map(function (e) { return '<li class="warn"><span class="tag">' + esc(e.rule) + "</span>" + esc(e.msg) + "</li>"; }).join("") + "</ul>";
    if (r.passed.length) h += "<h2>Passed</h2><ul class='list'>" + r.passed.map(function (p) { return '<li class="ok">' + esc(p) + "</li>"; }).join("") + "</ul>";
    $("#out").innerHTML = h;
    $("#out").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function run() {
    var x = $("#xml").value.trim();
    if (!x) { $("#out").innerHTML = '<p class="verdict bad">Paste the invoice XML or choose a file first.</p>'; return; }
    show(window.VLEInvoice.check(x));
  }
  function readFile(file) {
    if (!file) return;
    if (file.size > MAX) { $("#out").innerHTML = '<p class="verdict bad">That file is over 5 MB. E-invoice XML files are usually much smaller. Is it the right file?</p>'; return; }
    var rd = new FileReader();
    rd.onload = function () { $("#xml").value = rd.result; run(); };
    rd.readAsText(file);
  }
  $("#go").addEventListener("click", run);
  $("#sample").addEventListener("click", function () {
    fetch("data/sample-invoice.xml").then(function (r) { return r.text(); }).then(function (t) { $("#xml").value = t; run(); });
  });
  $("#file").addEventListener("change", function (e) { readFile(e.target.files[0]); });
  var d = $("#drop");
  ["dragenter", "dragover"].forEach(function (ev) { d.addEventListener(ev, function (e) { e.preventDefault(); d.classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (ev) { d.addEventListener(ev, function (e) { e.preventDefault(); d.classList.remove("over"); }); });
  d.addEventListener("drop", function (e) { readFile(e.dataTransfer.files[0]); });
})();
