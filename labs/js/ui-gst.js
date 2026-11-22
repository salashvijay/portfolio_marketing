(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var G = window.VLGst;

  $("#today").value = new Date().toISOString().slice(0, 10);

  function go() {
    var r = G.check($("#inv").value, $("#today").value, $("#aato").value);
    var h = "";
    if (!r.ok) {
      h = "<ul class='list'>" + r.errors.map(function (e) { return '<li class="err">' + esc(e) + "</li>"; }).join("") + "</ul>";
    } else {
      var msg = {
        open: ["ok", "✓ Still open: " + r.daysLeft + " day" + (r.daysLeft === 1 ? "" : "s") + " left to report this to the IRP."],
        urgent: ["bad", "! Report today: only " + r.daysLeft + " day" + (r.daysLeft === 1 ? "" : "s") + " left."],
        expired: ["bad", "✗ The 30 days have passed (" + r.age + " days old). The IRP is expected to reject it."],
        "no-limit": ["ok", "✓ No 30-day limit applies below Rs 10 crore turnover, for now. Report it as soon as you can."],
        future: ["bad", "✗ The invoice date is after today's date. Check both dates."]
      }[r.state];
      h += '<p class="verdict ' + msg[0] + '">' + esc(msg[1]) + "</p>";
      h += '<div class="scroll"><table><tbody>' +
        "<tr><th>Invoice date</th><td>" + esc(r.invoiceDate) + "</td></tr>" +
        "<tr><th>Age today</th><td>" + esc(r.age) + " days</td></tr>" +
        (r.applies ? "<tr><th>Last day (invoice date + 30 days)</th><td>" + esc(r.lastDay) + "</td></tr>" +
          "<tr><th>Report by (3 days of safety)</th><td>" + esc(r.aimFor) + "</td></tr>" : "") +
        "</tbody></table></div>";
      if (r.state === "expired") h += '<ul class="list"><li class="info">Ask your accountant or GST practitioner what to do next. Some sources say a fresh invoice must be raised; the rules for this are not simple.</li></ul>';
      if (r.applies && r.state !== "expired" && r.state !== "future") h += '<p class="fine">Whether day 30 itself is still allowed is not spelled out clearly in the advisory, so do not wait for the last day.</p>';
    }
    $("#out").innerHTML = h;
    $("#out").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("#go").addEventListener("click", go);
  ["#inv", "#today"].forEach(function (s) { $(s).addEventListener("keydown", function (e) { if (e.key === "Enter") go(); }); });
})();
