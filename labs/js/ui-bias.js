(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var I = window.VLImpact, CSV = null, MAX = 20 * 1024 * 1024;

  function pct(x) { return (x * 100).toFixed(1) + "%"; }
  function opts(sel, headers, blank) {
    sel.innerHTML = (blank ? '<option value="">(none)</option>' : "") + headers.map(function (h) { return '<option>' + esc(h) + "</option>"; }).join("");
  }
  function guess(headers, re) { return headers.filter(function (h) { return re.test(h); })[0] || ""; }

  function load(text) {
    CSV = I.parseCSV(text);
    if (!CSV.headers.length || !CSV.records.length) { $("#out").innerHTML = '<p class="verdict bad">That file has no rows. It needs a header row and one row per candidate.</p>'; return; }
    var h = CSV.headers;
    opts($("#g1"), h); opts($("#g2"), h, true); opts($("#oc"), h);
    $("#g1").value = guess(h, /^(sex|gender)$/i) || h[0];
    $("#g2").value = guess(h, /race|ethnic/i);
    var o = guess(h, /select|hired|advanc|outcome|pass|score/i); if (o) $("#oc").value = o;
    $("#mode").value = /score/i.test($("#oc").value) ? "score" : "selection";
    $("#loaded").textContent = CSV.records.length + " rows loaded. Choose the columns, then press Calculate.";
    $("#setup").classList.remove("hidden");
  }

  function table(t, label) {
    var rateName = t.mode === "score" ? "Scoring rate" : "Selection rate";
    var hitName = t.mode === "score" ? "Above median" : "Selected";
    var h = "<h2>" + esc(label) + "</h2><div class='scroll'><table><thead><tr><th>Category</th><th class='num'>People</th><th class='num'>" + hitName +
      "</th><th class='num'>" + rateName + "</th><th class='num'>Impact ratio</th></tr></thead><tbody>";
    h += t.rows.map(function (g) {
      var cls = g.excluded ? "dim" : g.flag ? "flag" : "";
      var ratio = g.ratio == null ? "left out (under 2%)" : g.ratio.toFixed(3) + (g.flag ? " ⚠" : "");
      return '<tr class="' + cls + '"><td>' + esc(g.category) + "</td><td class='num'>" + g.n + "</td><td class='num'>" + g.hits + "</td><td class='num'>" + pct(g.rate) + "</td><td class='num'>" + ratio + "</td></tr>";
    }).join("");
    h += "</tbody></table></div><p class='fine'>" + t.known + " people with a known category. " + t.unknown + " with an unknown or blank category (not in the table)." +
      (t.skipped ? " " + t.skipped + " rows had no numeric score and were skipped." : "") +
      (t.cutoff != null ? " Median score of the sample: " + t.cutoff + "." : "") + "</p>";
    return h;
  }

  function run() {
    try {
      var g1 = $("#g1").value, g2 = $("#g2").value, oc = $("#oc").value, mode = $("#mode").value;
      var h = table(I.impactTable(CSV.records, [g1], oc, { mode: mode }), "By " + g1);
      if (g2 && g2 !== g1) {
        h += table(I.impactTable(CSV.records, [g2], oc, { mode: mode }), "By " + g2);
        h += table(I.impactTable(CSV.records, [g1, g2], oc, { mode: mode }), "By " + g1 + " × " + g2 + " (combined)");
      }
      $("#out").innerHTML = h + "<p class='fine'>⚠ = impact ratio under 0.8 (the EEOC four-fifths rule of thumb). Local Law 144 itself sets no threshold.</p>";
    } catch (e) {
      $("#out").innerHTML = '<p class="verdict bad">' + esc(e.message) + "</p>";
    }
  }

  function sample() {
    // Made-up data, generated here, for trying the tool.
    var rows = ["sex,race_ethnicity,selected"], seed = 7;
    var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    var groups = [["Female", "Hispanic or Latino", 0.22], ["Female", "White", 0.30], ["Female", "Black or African American", 0.20], ["Female", "Asian", 0.28],
                  ["Male", "Hispanic or Latino", 0.27], ["Male", "White", 0.36], ["Male", "Black or African American", 0.25], ["Male", "Asian", 0.33]];
    groups.forEach(function (g) { for (var i = 0; i < 120; i++) rows.push(g[0] + "," + g[1] + "," + (rnd() < g[2] ? 1 : 0)); });
    for (var k = 0; k < 15; k++) rows.push("Unknown,Unknown," + (rnd() < 0.3 ? 1 : 0));
    load(rows.join("\n")); run();
  }

  function readFile(f) {
    if (!f) return;
    if (f.size > MAX) { $("#out").innerHTML = '<p class="verdict bad">That file is over 20 MB. Remove columns you don\'t need and try again.</p>'; return; }
    var rd = new FileReader(); rd.onload = function () { load(rd.result); }; rd.readAsText(f);
  }
  $("#file").addEventListener("change", function (e) { readFile(e.target.files[0]); });
  $("#go").addEventListener("click", run);
  $("#sample").addEventListener("click", function (e) { e.preventDefault(); sample(); });
  var d = $("#drop");
  ["dragenter", "dragover"].forEach(function (ev) { d.addEventListener(ev, function (e) { e.preventDefault(); d.classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (ev) { d.addEventListener(ev, function (e) { e.preventDefault(); d.classList.remove("over"); }); });
  d.addEventListener("drop", function (e) { readFile(e.dataTransfer.files[0]); });
})();
