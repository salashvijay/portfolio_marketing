/* Duplicate invoice finder: works on pasted CSV text, in the browser or in Node tests.
   Looks for the same supplier invoice entered twice, so a payment is not made twice.
   Rules (each group is reported once, strongest first):
   1. exact: same supplier, same invoice number (ignoring case, spaces, dashes, leading zeros), same amount.
   2. number-reused: same supplier and invoice number but a different amount or date.
   3. same-amount-date: same supplier, amount and date but a different invoice number (re-keyed or re-issued).
   Nothing is proof of a duplicate: a person must look at each group. */
(function (root) {
  "use strict";

  var HEADERS = {
    number: /^(invoice\s*(no|num|number|#|id|ref)?|inv\s*(no|num|number|#)?|bill\s*(no|number)?|document\s*(no|number)|reference|ref)\.?$/i,
    amount: /^(amount|total|gross|gross\s*amount|invoice\s*amount|invoice\s*total|grand\s*total|value|net\s*payable|payable)$/i,
    date: /^(date|invoice\s*date|inv\s*date|bill\s*date|document\s*date|issue\s*date)$/i,
    supplier: /^(supplier|vendor|supplier\s*name|vendor\s*name|payee|seller|party|name)$/i
  };

  // Split CSV text into rows of cells. Handles quotes, "" escapes, and , ; tab or | separators.
  function parseCsv(text) {
    text = String(text || "").replace(/^﻿/, "");
    var first = text.split(/\r?\n/, 1)[0] || "";
    var best = ",", bestN = 0;
    [",", ";", "\t", "|"].forEach(function (d) {
      var n = first.split(d).length - 1;
      if (n > bestN) { best = d; bestN = n; }
    });
    var rows = [], row = [], cell = "", q = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === best) { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.some(function (x) { return x.trim() !== ""; })) rows.push(row);
        row = [];
      } else cell += c;
    }
    row.push(cell);
    if (row.some(function (x) { return x.trim() !== ""; })) rows.push(row);
    return { rows: rows, delimiter: best };
  }

  function findColumns(header) {
    var cols = {};
    header.forEach(function (h, idx) {
      var name = String(h).trim();
      Object.keys(HEADERS).forEach(function (k) {
        if (cols[k] === undefined && HEADERS[k].test(name)) cols[k] = idx;
      });
    });
    return cols;
  }

  function normNumber(v) {
    var s = String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return s.replace(/(^|[A-Z])0+(?=[0-9])/g, "$1");
  }
  function normSupplier(v) {
    return String(v || "").toLowerCase().replace(/&/g, " and ")
      .replace(/\b(pvt|private|ltd|limited|llc|inc|incorporated|gmbh|corp|corporation|co|company|llp|plc)\b\.?/g, " ")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }
  // "1,234.50", "1.234,50", "Rs 1234", "(500)" -> number of cents; null if not a number.
  function parseAmount(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s) return null;
    var neg = /^\(.*\)$/.test(s) || /^-/.test(s);
    s = s.replace(/[^0-9.,]/g, "");
    if (!/\d/.test(s)) return null;
    var lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
    if (lastDot >= 0 && lastComma >= 0) {
      if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
      else s = s.replace(/,/g, "");
    } else if (lastComma >= 0) {
      s = /,\d{1,2}$/.test(s) && s.indexOf(",") === lastComma ? s.replace(",", ".") : s.replace(/,/g, "");
    }
    var n = Number(s);
    if (!isFinite(n)) return null;
    return Math.round(n * 100) * (neg ? -1 : 1);
  }
  // YYYY-MM-DD, DD/MM/YYYY or DD-MM-YYYY, DD.MM.YYYY (day first), or "1 Nov 2026". Returns YYYY-MM-DD or null.
  function parseDate(v) {
    var s = String(v || "").trim(), m, y, mo, d;
    if ((m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(s))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/.exec(s))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
    else if ((m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})$/.exec(s))) {
      mo = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[2].toLowerCase()) + 1;
      d = +m[1]; y = +m[3];
    } else return null;
    var t = new Date(Date.UTC(y, mo - 1, d));
    if (!mo || t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
    return t.toISOString().slice(0, 10);
  }

  function group(items, keyFn, skip) {
    var map = {}, order = [];
    items.forEach(function (it) {
      var k = keyFn(it);
      if (k === null || (skip && skip(it))) return;
      if (!map[k]) { map[k] = []; order.push(k); }
      map[k].push(it);
    });
    return order.map(function (k) { return map[k]; }).filter(function (g) { return g.length > 1; });
  }

  function find(text) {
    var out = { ok: false, errors: [], warnings: [], groups: [], rows: 0, delimiter: ",", columns: {} };
    var parsed = parseCsv(text);
    out.delimiter = parsed.delimiter;
    if (parsed.rows.length < 2) { out.errors.push("Paste a CSV with a header row and at least two invoices."); return out; }
    var cols = findColumns(parsed.rows[0]);
    out.columns = cols;
    var missing = ["number", "amount", "supplier"].filter(function (k) { return cols[k] === undefined; });
    if (missing.length) {
      out.errors.push("Could not find a column for: " + missing.join(", ") + ". Name the header cells e.g. Supplier, Invoice number, Amount, Date.");
      return out;
    }
    if (cols.date === undefined) out.warnings.push("No date column found, so the 'same amount and date' check was skipped.");
    var items = [];
    parsed.rows.slice(1).forEach(function (r, i) {
      var amt = parseAmount(r[cols.amount]);
      var it = {
        line: i + 2,
        supplier: (r[cols.supplier] || "").trim(),
        number: (r[cols.number] || "").trim(),
        amountText: (r[cols.amount] || "").trim(),
        dateText: cols.date !== undefined ? (r[cols.date] || "").trim() : "",
        sup: normSupplier(r[cols.supplier]),
        num: normNumber(r[cols.number]),
        cents: amt,
        date: cols.date !== undefined ? parseDate(r[cols.date]) : null
      };
      if (!it.sup && !it.num) return;
      if (amt === null) out.warnings.push("Line " + it.line + ": amount '" + it.amountText + "' is not a number.");
      if (cols.date !== undefined && it.dateText && !it.date) out.warnings.push("Line " + it.line + ": date '" + it.dateText + "' not understood (use YYYY-MM-DD or DD/MM/YYYY).");
      items.push(it);
    });
    out.rows = items.length;
    var used = {};
    function add(kind, label, g) {
      var fresh = g.filter(function (x) { return !used[x.line]; });
      if (fresh.length < 1 || g.length < 2) return;
      // keep groups that include at least one row not already fully explained by a stronger rule
      g.forEach(function (x) { used[x.line] = true; });
      out.groups.push({ kind: kind, label: label, items: g });
    }
    group(items, function (x) { return x.num ? x.sup + "|" + x.num + "|" + x.cents : null; }, function (x) { return x.cents === null; })
      .forEach(function (g) { add("exact", "Same supplier, invoice number and amount", g); });
    group(items, function (x) { return x.num ? x.sup + "|" + x.num : null; })
      .forEach(function (g) {
        var rest = g.filter(function (x) { return !used[x.line]; });
        if (rest.length) add("number-reused", "Same supplier and invoice number, but the amount or date differs", g);
      });
    if (cols.date !== undefined) {
      group(items, function (x) { return x.date && x.cents !== null ? x.sup + "|" + x.cents + "|" + x.date : null; })
        .forEach(function (g) {
          if (g.some(function (x) { return !used[x.line]; })) add("same-amount-date", "Same supplier, amount and date, but a different invoice number", g);
        });
    }
    out.ok = true;
    return out;
  }

  var api = { find: find, parseCsv: parseCsv, parseAmount: parseAmount, parseDate: parseDate, normNumber: normNumber, normSupplier: normSupplier };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VLDupes = api;
})(typeof window !== "undefined" ? window : this);
