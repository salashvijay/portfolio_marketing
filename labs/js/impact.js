/* Impact-ratio calculator (the method NYC Local Law 144 bias audits use).
   Runs in the browser; the CSV never leaves the user's computer.

   Selection mode: rate = selected / total in each category; impact ratio = rate / highest rate.
   Scoring mode:   rate = share of the category scoring ABOVE the median of the whole sample.
   Categories under 2% of the sample may be excluded from the ratio (reported, not dropped).
   Rows with a blank or "unknown" category are counted separately, as the rules require. */
(function (root) {
  "use strict";

  function parseCSV(text) {
    var rows = [], row = [], cell = "", q = false;
    text = String(text).replace(/^﻿/, "");
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    if (!rows.length) return { headers: [], records: [] };
    var headers = rows[0].map(function (h) { return h.trim(); });
    var records = rows.slice(1).map(function (r) {
      var o = {};
      headers.forEach(function (h, k) { o[h] = (r[k] || "").trim(); });
      return o;
    });
    return { headers: headers, records: records };
  }

  var YES = /^(1|y|yes|true|selected|hired|advanced|pass|passed)$/i;
  var UNKNOWN = /^(|unknown|n\/?a|na|not disclosed|prefer not to say|declined)$/i;

  function median(nums) {
    var s = nums.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /* records: array of objects; groupCols: ["Sex"] or ["Sex","Race"] for intersectional.
     opts.mode: "selection" (outcomeCol holds yes/no) or "score" (outcomeCol holds numbers). */
  function impactTable(records, groupCols, outcomeCol, opts) {
    opts = opts || {};
    var mode = opts.mode || "selection";
    var minShare = opts.minShare == null ? 0.02 : opts.minShare;
    var cutoff = null;
    if (mode === "score") {
      var scores = records.map(function (r) { return parseFloat(r[outcomeCol]); }).filter(function (x) { return !isNaN(x); });
      if (!scores.length) throw new Error("No numeric scores found in column \"" + outcomeCol + "\".");
      cutoff = median(scores);
    }
    var groups = {}, unknown = 0, skipped = 0, known = 0;
    records.forEach(function (r) {
      var parts = groupCols.map(function (c) { return (r[c] || "").trim(); });
      if (parts.some(function (p) { return UNKNOWN.test(p); })) { unknown++; return; }
      var hit;
      if (mode === "score") {
        var v = parseFloat(r[outcomeCol]);
        if (isNaN(v)) { skipped++; return; }
        hit = v > cutoff;
      } else {
        hit = YES.test((r[outcomeCol] || "").trim());
      }
      var key = parts.join(" × ");
      groups[key] = groups[key] || { category: key, n: 0, hits: 0 };
      groups[key].n++; if (hit) groups[key].hits++;
      known++;
    });
    var list = Object.keys(groups).map(function (k) {
      var g = groups[k];
      g.rate = g.n ? g.hits / g.n : 0;
      g.share = known ? g.n / known : 0;
      g.excluded = g.share < minShare;
      return g;
    });
    var base = list.filter(function (g) { return !g.excluded; });
    var top = base.reduce(function (m, g) { return g.rate > m ? g.rate : m; }, 0);
    list.forEach(function (g) {
      g.ratio = (!g.excluded && top > 0) ? g.rate / top : null;
      g.flag = g.ratio != null && g.ratio < 0.8;
    });
    list.sort(function (a, b) { return b.n - a.n; });
    return { mode: mode, cutoff: cutoff, rows: list, known: known, unknown: unknown, skipped: skipped, topRate: top };
  }

  var api = { parseCSV: parseCSV, impactTable: impactTable, median: median };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VLImpact = api;
})(this);
