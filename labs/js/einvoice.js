/* Basic EN 16931 checks for a UBL 2.1 invoice or credit note (Peppol BIS 3, XRechnung UBL,
   and most other UBL-based CIUSs) and for a UN/CEFACT CII invoice (Factur-X, ZUGFeRD,
   XRechnung CII), including the XML embedded in a Factur-X/ZUGFeRD PDF. Runs in the browser;
   the file never leaves the computer. It covers the mandatory core fields and the total
   calculations. It is NOT a replacement for the official Schematron validation that certified
   platforms run. */
(function (root) {
  "use strict";

  function kids(node, name) {
    var out = [];
    if (!node) return out;
    for (var c = node.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1 && (c.localName || c.nodeName.split(":").pop()) === name) out.push(c);
    }
    return out;
  }
  function at(node, path) {               // at(root, "AccountingSupplierParty/Party/PartyName/Name")
    var cur = [node];
    path.split("/").forEach(function (p) {
      var next = [];
      cur.forEach(function (n) { next = next.concat(kids(n, p)); });
      cur = next;
    });
    return cur;
  }
  function text(node, path) {
    var n = at(node, path)[0];
    return n ? String(n.textContent).trim() : "";
  }
  function num(node, path) {
    var t = text(node, path);
    return t === "" ? null : Number(t);
  }
  var near = function (a, b) { return Math.abs(a - b) < 0.011; };
  var r2 = function (x) { return Math.round(x * 100) / 100; };

  function check(xml, DOMParserImpl) {
    var P = DOMParserImpl || (typeof DOMParser !== "undefined" ? DOMParser : null);
    var res = { ok: false, kind: "", profile: "", errors: [], warnings: [], passed: [], fields: {} };
    if (!P) { res.errors.push({ rule: "SETUP", msg: "This browser can't read XML." }); return res; }
    var doc;
    try { doc = new P().parseFromString(String(xml), "application/xml"); } catch (e) { doc = null; }
    var pe = doc && doc.getElementsByTagName("parsererror");
    if (!doc || !doc.documentElement || (pe && pe.length)) {
      res.errors.push({ rule: "XML", msg: "The file is not valid XML. Check that it is the invoice XML file, not a PDF or an email." });
      return res;
    }
    var rootEl = doc.documentElement;
    var name = rootEl.localName || rootEl.nodeName.split(":").pop();
    if (name === "CrossIndustryInvoice") return checkCII(rootEl, res);
    if (name !== "Invoice" && name !== "CreditNote") {
      res.errors.push({ rule: "FORMAT", msg: "The root element is <" + name + ">. A UBL e-invoice starts with <Invoice> or <CreditNote>, and a CII one (Factur-X, ZUGFeRD) with <rsm:CrossIndustryInvoice>." });
      return res;
    }
    res.kind = name;
    var isCN = name === "CreditNote";
    var E = function (rule, msg) { res.errors.push({ rule: rule, msg: msg }); };
    var W = function (rule, msg) { res.warnings.push({ rule: rule, msg: msg }); };
    var OK = function (msg) { res.passed.push(msg); };

    var cust = text(rootEl, "CustomizationID");
    res.profile = /xrechnung/i.test(cust) ? "XRechnung" : /peppol/i.test(cust) ? "Peppol BIS Billing 3.0" : /en16931/i.test(cust) ? "EN 16931" : (cust ? "Other" : "");
    if (!cust) E("BT-24", "Specification identifier (CustomizationID) is missing. It tells the receiver which rules the invoice follows.");
    else OK("Specification identifier: " + cust);

    var must = [
      ["ID", "BT-1", "Invoice number"],
      ["IssueDate", "BT-2", "Issue date"],
      [isCN ? "CreditNoteTypeCode" : "InvoiceTypeCode", "BT-3", "Invoice type code"],
      ["DocumentCurrencyCode", "BT-5", "Currency"]
    ];
    must.forEach(function (m) {
      var v = text(rootEl, m[0]);
      res.fields[m[2]] = v;
      if (!v) E(m[1], m[2] + " (" + m[0] + ") is missing.");
      else OK(m[2] + ": " + v);
    });
    var issue = text(rootEl, "IssueDate");
    if (issue && !/^\d{4}-\d{2}-\d{2}$/.test(issue)) E("BT-2", "Issue date must be written as YYYY-MM-DD (found \"" + issue + "\").");
    var cur = text(rootEl, "DocumentCurrencyCode");
    if (cur && !/^[A-Z]{3}$/.test(cur)) E("BT-5", "Currency must be a 3-letter ISO 4217 code such as EUR (found \"" + cur + "\").");

    var sup = at(rootEl, "AccountingSupplierParty/Party")[0];
    var buy = at(rootEl, "AccountingCustomerParty/Party")[0];
    if (!sup) E("BG-4", "Seller (AccountingSupplierParty) is missing.");
    else {
      var sName = text(sup, "PartyLegalEntity/RegistrationName");
      res.fields["Seller"] = sName;
      if (!sName) E("BT-27", "Seller legal name (PartyLegalEntity/RegistrationName) is missing."); else OK("Seller: " + sName);
      if (!text(sup, "PostalAddress/Country/IdentificationCode")) E("BT-40", "Seller country code (PostalAddress/Country/IdentificationCode) is missing.");
      if (!text(sup, "PartyTaxScheme/CompanyID")) W("BT-31", "Seller VAT number (PartyTaxScheme/CompanyID) is missing. It is required unless the invoice uses a VAT exemption category that doesn't need it.");
      if (!text(sup, "EndpointID")) W("BT-34", "Seller electronic address (EndpointID) is missing. Peppol requires it.");
    }
    if (!buy) E("BG-7", "Buyer (AccountingCustomerParty) is missing.");
    else {
      var bName = text(buy, "PartyLegalEntity/RegistrationName");
      res.fields["Buyer"] = bName;
      if (!bName) E("BT-44", "Buyer legal name (PartyLegalEntity/RegistrationName) is missing."); else OK("Buyer: " + bName);
      if (!text(buy, "PostalAddress/Country/IdentificationCode")) E("BT-55", "Buyer country code is missing.");
      if (!text(buy, "EndpointID")) W("BT-49", "Buyer electronic address (EndpointID) is missing. Peppol requires it.");
    }
    if (res.profile === "XRechnung" && !text(rootEl, "BuyerReference")) E("BT-10", "XRechnung requires the buyer reference (BuyerReference, often the Leitweg-ID).");

    var lines = kids(rootEl, isCN ? "CreditNoteLine" : "InvoiceLine");
    if (!lines.length) E("BG-25", "The invoice has no lines.");
    var sum = 0;
    lines.forEach(function (ln, i) {
      var n = i + 1;
      if (!text(ln, "ID")) E("BT-126", "Line " + n + ": line ID is missing.");
      if (!text(ln, isCN ? "CreditedQuantity" : "InvoicedQuantity")) E("BT-129", "Line " + n + ": quantity is missing.");
      if (!text(ln, "Item/Name")) E("BT-153", "Line " + n + ": item name is missing.");
      if (text(ln, "Price/PriceAmount") === "") E("BT-146", "Line " + n + ": net price is missing.");
      if (!text(ln, "Item/ClassifiedTaxCategory/ID")) E("BT-151", "Line " + n + ": VAT category code is missing.");
      var amt = num(ln, "LineExtensionAmount");
      if (amt == null || isNaN(amt)) E("BT-131", "Line " + n + ": line net amount is missing.");
      else sum += amt;
    });
    if (lines.length) OK(lines.length + " invoice line(s)");

    var tot = at(rootEl, "LegalMonetaryTotal")[0];
    if (!tot) E("BG-22", "Document totals (LegalMonetaryTotal) are missing.");
    else {
      var lineTotal = num(tot, "LineExtensionAmount"), excl = num(tot, "TaxExclusiveAmount"),
          incl = num(tot, "TaxInclusiveAmount"), pay = num(tot, "PayableAmount"),
          allow = num(tot, "AllowanceTotalAmount") || 0, charge = num(tot, "ChargeTotalAmount") || 0,
          prepaid = num(tot, "PrepaidAmount") || 0, round = num(tot, "PayableRoundingAmount") || 0;
      [["BT-106", lineTotal, "LineExtensionAmount"], ["BT-109", excl, "TaxExclusiveAmount"], ["BT-112", incl, "TaxInclusiveAmount"], ["BT-115", pay, "PayableAmount"]]
        .forEach(function (x) { if (x[1] == null || isNaN(x[1])) E(x[0], "Total " + x[2] + " is missing."); });
      if (lineTotal != null && lines.length && !near(lineTotal, sum)) E("BR-CO-10", "Sum of line amounts is " + r2(sum) + " but LineExtensionAmount says " + lineTotal + ".");
      else if (lineTotal != null && lines.length) OK("Line amounts add up to " + lineTotal);
      if (lineTotal != null && excl != null && !near(excl, lineTotal - allow + charge)) E("BR-CO-13", "TaxExclusiveAmount should be line total − allowances + charges = " + r2(lineTotal - allow + charge) + ", but it is " + excl + ".");
      var taxTotals = kids(rootEl, "TaxTotal");
      var vat = 0, haveVat = false;
      taxTotals.forEach(function (t) {
        var a = kids(t, "TaxAmount")[0];
        if (a && (!cur || (a.getAttribute("currencyID") || cur) === cur)) { vat += Number(String(a.textContent).trim()); haveVat = true; }
      });
      if (!haveVat) E("BT-110", "Total VAT amount (TaxTotal/TaxAmount in the document currency) is missing.");
      if (excl != null && incl != null && haveVat && !near(incl, excl + vat)) E("BR-CO-15", "TaxInclusiveAmount should be " + r2(excl) + " + VAT " + r2(vat) + " = " + r2(excl + vat) + ", but it is " + incl + ".");
      else if (excl != null && incl != null && haveVat) OK("VAT and totals add up (" + incl + " " + cur + ")");
      if (incl != null && pay != null && !near(pay, incl - prepaid + round)) E("BR-CO-16", "PayableAmount should be " + r2(incl - prepaid + round) + ", but it is " + pay + ".");
      res.fields["Amount due"] = pay != null ? pay + " " + cur : "";
    }
    if (!isCN && !text(rootEl, "DueDate") && !at(rootEl, "PaymentTerms/Note").length) W("BR-CO-25", "No due date (DueDate) and no payment terms. One of them is required when an amount is due.");
    res.ok = res.errors.length === 0;
    return res;
  }

  // CII amounts can appear twice (document currency and VAT accounting currency): take the one
  // in the invoice currency, or the one without a currency.
  function amountIn(node, path, cur) {
    var hit = at(node, path).filter(function (n) { var c = n.getAttribute("currencyID"); return !c || !cur || c === cur; })[0];
    if (!hit) return null;
    var t = String(hit.textContent).trim();
    return t === "" ? null : Number(t);
  }

  function ciiProfile(id) {
    if (/xrechnung/i.test(id)) return "XRechnung (CII)";
    if (/factur-x\.eu:1p0:minimum/i.test(id)) return "Factur-X / ZUGFeRD MINIMUM";
    if (/factur-x\.eu:1p0:basicwl/i.test(id)) return "Factur-X / ZUGFeRD BASIC WL";
    if (/factur-x\.eu:1p0:extended/i.test(id)) return "Factur-X / ZUGFeRD EXTENDED";
    if (/factur-x\.eu:1p0:basic/i.test(id)) return "Factur-X / ZUGFeRD BASIC";
    if (/en16931/i.test(id)) return "EN 16931 (Factur-X / ZUGFeRD EN 16931 profile)";
    return id ? "Other" : "";
  }

  function checkCII(rootEl, res) {
    var E = function (rule, msg) { res.errors.push({ rule: rule, msg: msg }); };
    var W = function (rule, msg) { res.warnings.push({ rule: rule, msg: msg }); };
    var OK = function (msg) { res.passed.push(msg); };
    res.kind = "CII";

    var guide = text(rootEl, "ExchangedDocumentContext/GuidelineSpecifiedDocumentContextParameter/ID");
    res.profile = ciiProfile(guide);
    if (!guide) E("BT-24", "Specification identifier (GuidelineSpecifiedDocumentContextParameter/ID) is missing. It tells the receiver which rules and profile the invoice follows.");
    else OK("Specification identifier: " + guide);
    // MINIMUM and BASIC WL carry no invoice lines: they are not complete EN 16931 invoices.
    var noLines = /MINIMUM|BASIC WL/.test(res.profile);
    if (noLines) W("PROFILE", "This is the " + res.profile + " profile. It carries no invoice lines and is not a complete EN 16931 invoice, so it may not be accepted where a full e-invoice is required. Line checks are skipped.");

    var docEl = at(rootEl, "ExchangedDocument")[0];
    var tx = at(rootEl, "SupplyChainTradeTransaction")[0];
    var agree = tx && at(tx, "ApplicableHeaderTradeAgreement")[0];
    var settle = tx && at(tx, "ApplicableHeaderTradeSettlement")[0];

    var must = [
      [docEl, "ID", "BT-1", "Invoice number", "ExchangedDocument/ID"],
      [docEl, "IssueDateTime/DateTimeString", "BT-2", "Issue date", "ExchangedDocument/IssueDateTime"],
      [docEl, "TypeCode", "BT-3", "Invoice type code", "ExchangedDocument/TypeCode"],
      [settle, "InvoiceCurrencyCode", "BT-5", "Currency", "ApplicableHeaderTradeSettlement/InvoiceCurrencyCode"]
    ];
    must.forEach(function (m) {
      var v = m[0] ? text(m[0], m[1]) : "";
      res.fields[m[3]] = v;
      if (!v) E(m[2], m[3] + " (" + m[4] + ") is missing.");
      else OK(m[3] + ": " + v);
    });
    var issue = docEl ? text(docEl, "IssueDateTime/DateTimeString") : "";
    if (issue && !/^\d{8}$/.test(issue)) E("BT-2", "In CII the issue date is written as YYYYMMDD with format=\"102\" (found \"" + issue + "\").");
    var cur = settle ? text(settle, "InvoiceCurrencyCode") : "";
    if (cur && !/^[A-Z]{3}$/.test(cur)) E("BT-5", "Currency must be a 3-letter ISO 4217 code such as EUR (found \"" + cur + "\").");

    var sup = agree && at(agree, "SellerTradeParty")[0];
    var buy = agree && at(agree, "BuyerTradeParty")[0];
    if (!sup) E("BG-4", "Seller (SellerTradeParty) is missing.");
    else {
      var sName = text(sup, "Name");
      res.fields["Seller"] = sName;
      if (!sName) E("BT-27", "Seller name (SellerTradeParty/Name) is missing."); else OK("Seller: " + sName);
      if (!text(sup, "PostalTradeAddress/CountryID")) E("BT-40", "Seller country code (PostalTradeAddress/CountryID) is missing.");
      if (!at(sup, "SpecifiedTaxRegistration/ID").length) W("BT-31", "Seller VAT number (SpecifiedTaxRegistration/ID with schemeID=\"VA\") is missing. It is required unless the invoice uses a VAT exemption category that doesn't need it.");
      if (!noLines && !text(sup, "URIUniversalCommunication/URIID")) W("BT-34", "Seller electronic address (URIUniversalCommunication/URIID) is missing. XRechnung and many exchange networks ask for it.");
    }
    if (!buy) E("BG-7", "Buyer (BuyerTradeParty) is missing.");
    else {
      var bName = text(buy, "Name");
      res.fields["Buyer"] = bName;
      if (!bName) E("BT-44", "Buyer name (BuyerTradeParty/Name) is missing."); else OK("Buyer: " + bName);
      if (!noLines && !text(buy, "PostalTradeAddress/CountryID")) E("BT-55", "Buyer country code (PostalTradeAddress/CountryID) is missing.");
      if (!noLines && !text(buy, "URIUniversalCommunication/URIID")) W("BT-49", "Buyer electronic address (URIUniversalCommunication/URIID) is missing. XRechnung and many exchange networks ask for it.");
    }
    if (/XRechnung/.test(res.profile) && !(agree && text(agree, "BuyerReference"))) E("BT-10", "XRechnung requires the buyer reference (ApplicableHeaderTradeAgreement/BuyerReference, often the Leitweg-ID).");

    var lines = tx ? kids(tx, "IncludedSupplyChainTradeLineItem") : [];
    var sum = 0;
    if (!noLines) {
      if (!lines.length) E("BG-25", "The invoice has no lines (IncludedSupplyChainTradeLineItem).");
      lines.forEach(function (ln, i) {
        var n = i + 1;
        if (!text(ln, "AssociatedDocumentLineDocument/LineID")) E("BT-126", "Line " + n + ": line ID is missing.");
        if (!text(ln, "SpecifiedLineTradeDelivery/BilledQuantity")) E("BT-129", "Line " + n + ": quantity (BilledQuantity) is missing.");
        if (!text(ln, "SpecifiedTradeProduct/Name")) E("BT-153", "Line " + n + ": item name is missing.");
        if (text(ln, "SpecifiedLineTradeAgreement/NetPriceProductTradePrice/ChargeAmount") === "") E("BT-146", "Line " + n + ": net price (NetPriceProductTradePrice/ChargeAmount) is missing.");
        if (!text(ln, "SpecifiedLineTradeSettlement/ApplicableTradeTax/CategoryCode")) E("BT-151", "Line " + n + ": VAT category code is missing.");
        var amt = num(ln, "SpecifiedLineTradeSettlement/SpecifiedTradeSettlementLineMonetarySummation/LineTotalAmount");
        if (amt == null || isNaN(amt)) E("BT-131", "Line " + n + ": line net amount (LineTotalAmount) is missing.");
        else sum += amt;
      });
      if (lines.length) OK(lines.length + " invoice line(s)");
    }

    var tot = settle && at(settle, "SpecifiedTradeSettlementHeaderMonetarySummation")[0];
    if (!tot) E("BG-22", "Document totals (SpecifiedTradeSettlementHeaderMonetarySummation) are missing.");
    else {
      var lineTotal = num(tot, "LineTotalAmount"), excl = num(tot, "TaxBasisTotalAmount"),
          vat = amountIn(tot, "TaxTotalAmount", cur), incl = num(tot, "GrandTotalAmount"), pay = num(tot, "DuePayableAmount"),
          allow = num(tot, "AllowanceTotalAmount") || 0, charge = num(tot, "ChargeTotalAmount") || 0,
          prepaid = num(tot, "TotalPrepaidAmount") || 0, round = num(tot, "RoundingAmount") || 0;
      var need = [["BT-109", excl, "TaxBasisTotalAmount"], ["BT-112", incl, "GrandTotalAmount"], ["BT-115", pay, "DuePayableAmount"]];
      if (!noLines) need.unshift(["BT-106", lineTotal, "LineTotalAmount"]);
      need.forEach(function (x) { if (x[1] == null || isNaN(x[1])) E(x[0], "Total " + x[2] + " is missing."); });
      if (!noLines && lineTotal != null && lines.length && !near(lineTotal, sum)) E("BR-CO-10", "Sum of line amounts is " + r2(sum) + " but LineTotalAmount says " + lineTotal + ".");
      else if (!noLines && lineTotal != null && lines.length) OK("Line amounts add up to " + lineTotal);
      if (lineTotal != null && excl != null && !near(excl, lineTotal - allow + charge)) E("BR-CO-13", "TaxBasisTotalAmount should be line total − allowances + charges = " + r2(lineTotal - allow + charge) + ", but it is " + excl + ".");
      if (vat == null) E("BT-110", "Total VAT amount (TaxTotalAmount in the invoice currency) is missing.");
      if (excl != null && incl != null && vat != null && !near(incl, excl + vat)) E("BR-CO-15", "GrandTotalAmount should be " + r2(excl) + " + VAT " + r2(vat) + " = " + r2(excl + vat) + ", but it is " + incl + ".");
      else if (excl != null && incl != null && vat != null) OK("VAT and totals add up (" + incl + " " + cur + ")");
      if (incl != null && pay != null && !near(pay, incl - prepaid + round)) E("BR-CO-16", "DuePayableAmount should be " + r2(incl - prepaid + round) + ", but it is " + pay + ".");
      res.fields["Amount due"] = pay != null ? pay + " " + cur : "";
    }
    var terms = settle ? at(settle, "SpecifiedTradePaymentTerms") : [];
    var hasTerms = terms.some(function (t) { return text(t, "DueDateDateTime/DateTimeString") || text(t, "Description"); });
    if (docEl && text(docEl, "TypeCode") !== "381" && !hasTerms) W("BR-CO-25", "No due date and no payment terms (SpecifiedTradePaymentTerms). One of them is required when an amount is due.");
    res.ok = res.errors.length === 0;
    return res;
  }

  /* ---------- Factur-X / ZUGFeRD PDF: find the embedded XML (it is a file attachment stream).
     Plain PDF invoices have none. Encrypted PDFs are not supported. */
  function latin1(bytes) {
    var s = "", CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return s;
  }
  function browserInflate(data) {            // zlib "deflate" via the browser's DecompressionStream
    if (typeof DecompressionStream === "undefined") return Promise.reject(new Error("no DecompressionStream"));
    var ds = new DecompressionStream("deflate");
    var wr = ds.writable.getWriter();
    wr.write(data).catch(function () {});
    wr.close().catch(function () {});
    var rd = ds.readable.getReader(), parts = [], len = 0;
    function pump() {
      return rd.read().then(function (r) {
        if (r.done) {
          var out = new Uint8Array(len), o = 0;
          parts.forEach(function (p) { out.set(p, o); o += p.length; });
          return out;
        }
        parts.push(r.value); len += r.value.length;
        return pump();
      });
    }
    return pump();
  }
  function utf8(bytes) {
    if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(bytes);
    return decodeURIComponent(escape(latin1(bytes)));
  }

  // Resolves to the embedded invoice XML as text, or null when the PDF has none.
  function xmlFromPdf(bytes, inflate) {
    inflate = inflate || browserInflate;
    var s = latin1(bytes);
    if (s.slice(0, 1024).indexOf("%PDF-") < 0) return Promise.resolve(null);
    var re = /stream(\r\n|\n|\r)/g, m, cands = [];
    while ((m = re.exec(s))) {
      if (s.slice(m.index - 3, m.index) === "end") continue;
      var objAt = s.lastIndexOf(" obj", m.index);
      var dict = s.slice(objAt < 0 ? Math.max(0, m.index - 2000) : objAt, m.index);
      if (!/\/Type\s*\/EmbeddedFile\b/.test(dict)) continue;
      var start = m.index + m[0].length;
      var lenM = /\/Length\s+(\d+)\b(?!\s+\d+\s+R)/.exec(dict);
      var end = lenM ? start + Number(lenM[1]) : s.indexOf("endstream", start);
      if (!lenM) { if (s[end - 1] === "\n") end--; if (s[end - 1] === "\r") end--; }
      cands.push({ data: bytes.subarray(start, end), flate: /\/FlateDecode/.test(dict) });
      re.lastIndex = end;
    }
    var i = 0;
    function next() {
      if (i >= cands.length) return Promise.resolve(null);
      var c = cands[i++];
      var p = c.flate ? inflate(c.data) : Promise.resolve(c.data);
      return p.then(function (raw) {
        var t = utf8(raw).replace(/^﻿/, "");
        return /CrossIndustryInvoice|<(\w+:)?(Invoice|CreditNote)[\s>]/.test(t) ? t : next();
      }, next);
    }
    return next();
  }

  var api = { check: check, xmlFromPdf: xmlFromPdf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VLEInvoice = api;
})(this);
