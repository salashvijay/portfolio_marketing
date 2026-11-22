(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var S = window.VLSecrets;
  var SKIP_DIR = /(^|\/)(node_modules|\.git|\.venv|venv|__pycache__|coverage|\.cache|\.turbo)(\/|$)/;
  var SKIP_EXT = /\.(png|jpe?g|gif|webp|ico|svg|pdf|zip|gz|woff2?|ttf|eot|mp4|mp3|lock|map)$/i;
  var LABEL = { critical: "Critical", high: "High", medium: "Medium", info: "Info" };
  var CLS = { critical: "err", high: "err", medium: "warn", info: "info" };

  function show(sum, scanned) {
    var c = sum.counts, h = "";
    var bad = c.critical + c.high;
    h += '<p class="verdict ' + (bad ? "bad" : "ok") + '">' + (bad ? "✗ " + bad + " serious problem" + (bad === 1 ? "" : "s") + " found" : "✓ No exposed secret keys found") +
      " · Grade " + sum.grade + " (" + sum.score + "/100)</p>";
    h += "<p class='fine'>Scanned " + scanned + ". Critical " + c.critical + " · High " + c.high + " · Medium " + c.medium + " · Info " + c.info + ".</p>";
    if (sum.findings.length) {
      h += "<ul class='list'>" + sum.findings.map(function (f) {
        return '<li class="' + CLS[f.severity] + '"><b>' + LABEL[f.severity] + ": " + esc(f.type) + "</b> <span class='tag'>" + esc(f.file) + ":" + f.line + " · " + esc(f.value) + "</span><br>" + esc(f.fix) + "</li>";
      }).join("") + "</ul>";
    }
    if (bad) h += "<p><b>First step for every critical key:</b> revoke or rotate it with the provider today. Removing it from the code is not enough, because it may already have been copied.</p>";
    $("#out").innerHTML = h;
    $("#out").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("#go").addEventListener("click", function () {
    var t = $("#code").value;
    if (!t.trim()) { $("#out").innerHTML = '<p class="verdict bad">Paste some code or choose a folder first.</p>'; return; }
    show(S.summarize(S.scanText(t, "pasted text")), "the pasted text");
  });

  $("#folder").addEventListener("change", function (e) {
    var files = Array.prototype.filter.call(e.target.files, function (f) {
      var p = f.webkitRelativePath || f.name;
      return !SKIP_DIR.test(p) && !SKIP_EXT.test(p) && f.size <= 1024 * 1024;
    }).slice(0, 5000);
    if (!files.length) { $("#out").innerHTML = '<p class="verdict bad">No text files found to scan in that folder.</p>'; return; }
    $("#out").innerHTML = "<p>Scanning " + files.length + " files…</p>";
    var all = [], done = 0;
    files.forEach(function (f) {
      var rd = new FileReader();
      rd.onload = function () {
        all = all.concat(S.scanText(String(rd.result), f.webkitRelativePath || f.name));
        if (++done === files.length) show(S.summarize(all), files.length + " files");
      };
      rd.onerror = function () { if (++done === files.length) show(S.summarize(all), files.length + " files"); };
      rd.readAsText(f);
    });
  });
})();
