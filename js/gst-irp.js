/* India GST e-invoice: 30-day IRP reporting window calculator.
   Rule (GSTN advisory of 5 Nov 2024): from 1 Apr 2025, taxpayers with aggregate annual turnover (AATO)
   of Rs 10 crore or more cannot report an e-invoice, credit note or debit note to the IRP when its
   document date is more than 30 days old. Below Rs 10 crore there is no such restriction for now.
   Dates are plain calendar dates (YYYY-MM-DD) handled in UTC so time zones never shift a day. */
(function (root) {
  "use strict";

  var WINDOW_DAYS = 30;
  var SAFETY_DAYS = 3; // we suggest reporting this many days before the last day
  var MS = 86400000;

  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
    return d;
  }
  function fmt(d) { return d.toISOString().slice(0, 10); }
  function addDays(d, n) { return new Date(d.getTime() + n * MS); }

  // aato: "10cr_plus" (Rs 10 crore or more) or "below10cr"
  function check(invoiceDate, today, aato) {
    var inv = parse(invoiceDate), now = parse(today);
    var r = { ok: false, errors: [] };
    if (!inv) r.errors.push("Enter the invoice date as YYYY-MM-DD.");
    if (!now) r.errors.push("Enter today's date as YYYY-MM-DD.");
    if (r.errors.length) return r;
    r.ok = true;
    r.applies = aato !== "below10cr";
    r.invoiceDate = fmt(inv);
    r.lastDay = fmt(addDays(inv, WINDOW_DAYS));
    r.aimFor = fmt(addDays(inv, WINDOW_DAYS - SAFETY_DAYS));
    r.age = Math.round((now - inv) / MS);
    r.daysLeft = WINDOW_DAYS - r.age;
    if (r.age < 0) r.state = "future";
    else if (!r.applies) r.state = "no-limit";
    else if (r.daysLeft < 0) r.state = "expired";
    else if (r.daysLeft <= SAFETY_DAYS) r.state = "urgent";
    else r.state = "open";
    return r;
  }

  var api = { check: check, parse: parse, WINDOW_DAYS: WINDOW_DAYS, SAFETY_DAYS: SAFETY_DAYS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VLGst = api;
})(typeof window !== "undefined" ? window : this);
