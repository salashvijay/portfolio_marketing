(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var DATA = null;

  function days(iso) {
    var d = new Date(iso + "T00:00:00");
    var t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 86400000);
  }
  function fmt(iso) {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
  function fill(sel, values) {
    values.forEach(function (v) { var o = document.createElement("option"); o.value = v; o.textContent = v; sel.appendChild(o); });
  }

  function render() {
    var a = $("#area").value, r = $("#region").value, w = $("#when").value;
    var items = DATA.items.filter(function (it) {
      var dl = days(it.date);
      return (!a || it.area === a) && (!r || it.region === r) &&
             (!w || (w === "live" ? dl <= 0 : dl > 0));
    }).sort(function (x, y) {
      var dx = days(x.date), dy = days(y.date);
      if ((dx > 0) !== (dy > 0)) return dx > 0 ? -1 : 1;     // upcoming first
      return dx > 0 ? dx - dy : dy - dx;                       // soonest first, then most recent
    });
    $("#rows").innerHTML = items.length ? items.map(function (it) {
      var dl = days(it.date);
      var when = dl > 0 ? '<span class="pill soon">in ' + dl + " days</span>" : '<span class="pill live">in force</span>';
      return "<tr><td><b>" + esc(fmt(it.date)) + "</b><br>" + when + "</td><td>" + esc(it.region) + '<br><span class="fine">' + esc(it.area) + "</span></td><td>" + esc(it.rule) +
        "</td><td>" + esc(it.who) + '</td><td><a href="' + esc(it.source) + '" rel="noopener" target="_blank">' + (it.confidence === "official" ? "official" : "press") + "</a></td></tr>";
    }).join("") : '<tr><td colspan="5">Nothing matches these filters.</td></tr>';
  }

  fetch("data/deadlines.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (d) {
    DATA = d;
    $("#checked").textContent = "Sources last checked: " + fmt(d.checked) + ". " + d.note;
    fill($("#area"), Array.from(new Set(d.items.map(function (i) { return i.area; }))).sort());
    fill($("#region"), Array.from(new Set(d.items.map(function (i) { return i.region; }))).sort());
    ["#area", "#region", "#when"].forEach(function (s) { $(s).addEventListener("change", render); });
    render();
  }).catch(function () { $("#rows").innerHTML = '<tr><td colspan="5">Could not load the deadlines. Please reload the page.</td></tr>'; });
})();
