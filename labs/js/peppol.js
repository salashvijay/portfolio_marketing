/* Peppol participant ID builder and checker. Turns a company number into a Peppol ID
   (scheme code + value) and checks the format and check digits where the number has them.
   It never looks anything up: there is no network call. Scheme list: Peppol Code Lists,
   Participant identifier schemes v9.7 (2 Jul 2026), https://docs.peppol.eu/edelivery/codelists/ */
(function (root) {
  "use strict";

  var LIST_VERSION = "9.7";
  // icd|scheme ID|country|name|state (a = active, d = deprecated, r = removed)
  var RAW = [
    "0002|FR:SIRENE|FR|SIREN company number (SIRENE)|a", "0007|SE:ORGNR|SE|Organisationsnummer|a", "0009|FR:SIRET|FR|SIRET establishment number|a",
    "0037|FI:OVT|FI|LY-tunnus|r", "0060|DUNS|INT|D-U-N-S Number|a", "0088|GLN|INT|Global Location Number (GLN)|a",
    "0096|DK:P|DK|P-number (Danish Business Authority)|a", "0097|IT:FTI|IT|FTI - Ediforum Italia|a", "0106|NL:KVK|NL|KvK number (Chamber of Commerce)|a",
    "0130|EU:NAL|INT|Directorates of the European Commission|a", "0135|IT:SIA|IT|SIA Object Identifiers|a", "0142|IT:SECETI|IT|SECETI Object Identifiers|a",
    "0151|AU:ABN|AU|Australian Business Number (ABN)|a", "0158|SK:ICO|SK|IČO (identification number)|a", "0183|CH:UIDB|CH|UID business identification number|a",
    "0184|DK:DIGST|DK|CVR number (Danish Business Authority)|a", "0188|JP:SST|JP|Corporate Number|a", "0190|NL:OINO|NL|Organisatie-identificatienummer (OIN)|a",
    "0191|EE:CC|EE|Company code|a", "0192|NO:ORG|NO|Organisasjonsnummer|a", "0193|UBLBE|BE|UBL.BE Party Identifier|d",
    "0195|SG:UEN|SG|UEN (Singapore e-invoicing framework)|a", "0196|IS:KTNR|IS|Kennitala|a", "0198|DK:ERST|DK|SE number (Danish Business Authority)|a",
    "0199|LEI|INT|Legal Entity Identifier (LEI)|a", "0200|LT:LEC|LT|Legal entity code|a", "0201|IT:CUUO|IT|Codice Univoco Unità Organizzativa iPA|a",
    "0204|DE:LWID|DE|Leitweg-ID (public bodies)|a", "0205|IT:COD|IT|CODDEST|a", "0208|BE:EN|BE|Enterprise number (KBO/BCE)|a",
    "0209|GS1|INT|GS1 identification keys|a", "0210|IT:CFI|IT|Codice fiscale|a", "0211|IT:IVA|IT|Partita IVA|a",
    "0212|FI:ORG|FI|Finnish Organization Identifier|r", "0213|FI:VAT|FI|Finnish VAT identifier|r", "0215|FI:NSI|FI|Net service ID|r",
    "0216|FI:OVT2|FI|OVT code|a", "0218|LV:URN|LV|Unified registration number|a", "0221|JP:IIN|JP|Registered number of a qualified invoice issuer|a",
    "0225|FR:CTC|FR|FRCTC electronic address|a", "0230|MY:EIF|MY|National e-Invoicing Framework|a", "0235|AE:TIN|AE|UAE Tax Identification Number (TIN)|a",
    "0240|LU:MAT|LU|Register of legal persons|a", "0242|SPIS|INT|OpenPeppol Service Provider Identification Scheme|a", "0244|NG:TID|NG|Tax Identification Number|a",
    "0245|SK:DIC|SK|DIČ (tax identification number)|a", "0246|DE:GEBA|DE|German Electronic Business Address|a", "0248|OM:VAT|OM|Oman VAT number|a",
    "9901|DK:CPR|DK|Danish Ministry of the Interior and Health|r", "9902|DK:CVR|DK|Danish Commerce and Companies Agency|r", "9904|DK:SE|DK|Danish Ministry of Taxation|r",
    "9905|DK:VANS|DK|Danish VANS providers|r", "9906|IT:VAT|IT|Italian VAT (old scheme)|r", "9907|IT:CF|IT|Italian tax code (old scheme)|r",
    "9908|NO:ORGNR|NO|Enhetsregisteret (old scheme)|r", "9909|NO:VAT|NO|Norwegian VAT number|d", "9910|HU:VAT|HU|Hungary VAT number|a",
    "9912|EU:VAT|INT|EU VAT (old scheme)|d", "9913|EU:REID|INT|Business Registers Network|a", "9914|AT:VAT|AT|Austria VAT number (UID)|a",
    "9915|AT:GOV|AT|Austrian government organisation code|a", "9916|AT:CID|AT|Statistik Austria company ID|d", "9917|IS:KT|IS|Icelandic National Registry|d",
    "9918|IBAN|INT|IBAN|a", "9919|AT:KUR|AT|Austrian company register number|a", "9920|ES:VAT|ES|Spain VAT number|a",
    "9921|IT:IPA|IT|Indice delle Pubbliche Amministrazioni|r", "9922|AD:VAT|AD|Andorra VAT number|a", "9923|AL:VAT|AL|Albania VAT number|a",
    "9924|BA:VAT|BA|Bosnia and Herzegovina VAT number|a", "9925|BE:VAT|BE|Belgium VAT number|a", "9926|BG:VAT|BG|Bulgaria VAT number|a",
    "9927|CH:VAT|CH|Switzerland VAT number|a", "9928|CY:VAT|CY|Cyprus VAT number|a", "9929|CZ:VAT|CZ|Czech Republic VAT number|a",
    "9930|DE:VAT|DE|Germany VAT number (USt-IdNr.)|a", "9931|EE:VAT|EE|Estonia VAT number|a", "9932|GB:VAT|GB|United Kingdom VAT number|a",
    "9933|GR:VAT|GR|Greece VAT number|a", "9934|HR:VAT|HR|Croatia VAT number|a", "9935|IE:VAT|IE|Ireland VAT number|a",
    "9936|LI:VAT|LI|Liechtenstein VAT number|a", "9937|LT:VAT|LT|Lithuania VAT number|a", "9938|LU:VAT|LU|Luxembourg VAT number|a",
    "9939|LV:VAT|LV|Latvia VAT number|a", "9940|MC:VAT|MC|Monaco VAT number|a", "9941|ME:VAT|ME|Montenegro VAT number|a",
    "9942|MK:VAT|MK|North Macedonia VAT number|a", "9943|MT:VAT|MT|Malta VAT number|a", "9944|NL:VAT|NL|Netherlands VAT number|a",
    "9945|PL:VAT|PL|Poland VAT number|a", "9946|PT:VAT|PT|Portugal VAT number|a", "9947|RO:VAT|RO|Romania VAT number|a",
    "9948|RS:VAT|RS|Serbia VAT number|a", "9949|SI:VAT|SI|Slovenia VAT number|a", "9950|SK:VAT|SK|Slovakia VAT number|a",
    "9951|SM:VAT|SM|San Marino VAT number|a", "9952|TR:VAT|TR|Turkey VAT number|a", "9953|VA:VAT|VA|Holy See (Vatican) VAT number|a",
    "9954|NL:OIN|NL|Dutch Originator's Identification Number (old)|r", "9955|SE:VAT|SE|Swedish VAT number|r", "9956|BE:CBE|BE|Belgian CBE number (old scheme)|r",
    "9957|FR:VAT|FR|France VAT number|a", "9958|DE:LID|DE|Leitweg-ID (old scheme)|r", "9959|US:EIN|US|US Employer ID Number (EIN)|a"
  ];
  var STATE = { a: "active", d: "deprecated", r: "removed" };
  var SCHEMES = RAW.map(function (r) {
    var p = r.split("|");
    return { icd: p[0], id: p[1], cc: p[2], name: p[3], state: STATE[p[4]] };
  });
  var COUNTRY = {
    AD: "Andorra", AE: "United Arab Emirates", AL: "Albania", AT: "Austria", AU: "Australia", BA: "Bosnia and Herzegovina", BE: "Belgium",
    BG: "Bulgaria", CH: "Switzerland", CY: "Cyprus", CZ: "Czech Republic", DE: "Germany", DK: "Denmark", EE: "Estonia", ES: "Spain",
    FI: "Finland", FR: "France", GB: "United Kingdom", GR: "Greece", HR: "Croatia", HU: "Hungary", IE: "Ireland", IS: "Iceland",
    IT: "Italy", JP: "Japan", LI: "Liechtenstein", LT: "Lithuania", LU: "Luxembourg", LV: "Latvia", MC: "Monaco", ME: "Montenegro",
    MK: "North Macedonia", MT: "Malta", MY: "Malaysia", NG: "Nigeria", NL: "Netherlands", NO: "Norway", OM: "Oman", PL: "Poland",
    PT: "Portugal", RO: "Romania", RS: "Serbia", SE: "Sweden", SG: "Singapore", SI: "Slovenia", SK: "Slovakia", SM: "San Marino",
    TR: "Turkey", US: "United States", VA: "Holy See (Vatican)", INT: "International (any country)"
  };
  // Country notes, each from an official source.
  var TIPS = {
    BE: {
      text: "Every Belgian company is registered on Peppol under its enterprise number (scheme 0208), and suppliers can send to that number by default, so you usually don't need to ask the customer for their Peppol ID. Other IDs, such as the VAT number (9925), are optional extras.",
      source: "https://einvoice.belgium.be/en/FAQ/general-questions-about-peppol", by: "FPS BOSA, einvoice.belgium.be"
    },
    DE: {
      text: "German public bodies must use their Leitweg-ID (0204) as their Peppol ID. For companies the recommendation is the VAT number (9930), otherwise the GLN (0088), otherwise the IBAN (9918). Use a 0204 Peppol ID exactly as the receiver gives it: senders must not check it against the Leitweg-ID rules.",
      source: "https://xeinkauf.de/app/uploads/2025/01/2025-01-02_Germany_Identifier_v.1.1_eng.pdf", by: "KoSIT and the German Peppol Authority, v1.1 (Jan 2025)"
    }
  };

  function find(icd) { for (var i = 0; i < SCHEMES.length; i++) if (SCHEMES[i].icd === icd) return SCHEMES[i]; return null; }
  function forCountry(cc) {
    return SCHEMES.filter(function (s) { return s.state !== "removed" && (s.cc === cc || (cc !== "INT" && s.cc === "INT")); });
  }
  function countries() {
    var seen = {};
    SCHEMES.forEach(function (s) { if (s.state !== "removed") seen[s.cc] = true; });
    return Object.keys(seen).sort(function (a, b) {
      if (a === "INT") return 1; if (b === "INT") return -1;
      return COUNTRY[a] < COUNTRY[b] ? -1 : 1;
    }).map(function (cc) { return { cc: cc, name: COUNTRY[cc] || cc }; });
  }

  // ---------- check digits
  function luhn(d) {
    var sum = 0;
    for (var i = 0; i < d.length; i++) {
      var n = +d[d.length - 1 - i];
      if (i % 2) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
    }
    return sum % 10 === 0;
  }
  function gs1(d) {
    var sum = 0;
    for (var i = 0; i < d.length - 1; i++) sum += +d[d.length - 2 - i] * (i % 2 ? 1 : 3);
    return (10 - sum % 10) % 10 === +d[d.length - 1];
  }
  function mod97(str) {                         // ISO 7064 MOD 97-10 remainder; letters A=10 … Z=35
    var r = 0, s = str.toUpperCase().replace(/[A-Z]/g, function (c) { return String(c.charCodeAt(0) - 55); });
    for (var i = 0; i < s.length; i++) r = (r * 10 + +s[i]) % 97;
    return r;
  }
  var CHECKS = {
    be: function (d) { return 97 - (Number(d.slice(0, 8)) % 97) === Number(d.slice(8)); },
    no: function (d) {
      var w = [3, 2, 7, 6, 5, 4, 3, 2], s = 0;
      for (var i = 0; i < 8; i++) s += w[i] * +d[i];
      var c = 11 - s % 11; if (c === 11) c = 0;
      return c !== 10 && c === +d[8];
    },
    abn: function (d) {
      var w = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19], s = 0;
      for (var i = 0; i < 11; i++) s += w[i] * (+d[i] - (i === 0 ? 1 : 0));
      return s % 89 === 0;
    },
    siret: function (d) {                       // La Poste establishments use a digit-sum rule instead
      if (d.slice(0, 9) === "356000000") return d.split("").reduce(function (a, c) { return a + +c; }, 0) % 5 === 0;
      return luhn(d);
    },
    iban: function (v) { return mod97(v.slice(4) + v.slice(0, 4)) === 1; },
    lei: function (v) { return mod97(v) === 1; }
  };

  /* Per-scheme rules: clean(raw) → value; pattern; check digits; human hint.
     Schemes without a rule here get only the basic checks. */
  var RULES = {
    "0208": { strip: /^BE/i, pad: 9, re: /^[01]\d{9}$/, check: CHECKS.be, fmt: "10 digits, without BE, e.g. 0123456749" },
    "9925": { prefix: "BE", pad: 9, re: /^BE[01]\d{9}$/, check: function (v) { return CHECKS.be(v.slice(2)); }, fmt: "BE + 10 digits, e.g. BE0123456749" },
    "0088": { re: /^\d{13}$/, check: gs1, fmt: "13 digits" },
    "0060": { re: /^\d{9}$/, fmt: "9 digits" },
    "0192": { strip: /^NO|MVA$/i, re: /^\d{9}$/, check: CHECKS.no, fmt: "9 digits" },
    "0007": { re: /^\d{10}$/, check: luhn, fmt: "10 digits, no hyphen" },
    "0002": { re: /^\d{9}$/, check: luhn, fmt: "9 digits (SIREN)" },
    "0009": { re: /^\d{14}$/, check: CHECKS.siret, fmt: "14 digits (SIRET)" },
    "0106": { re: /^\d{8}$/, fmt: "8 digits" },
    "0151": { re: /^\d{11}$/, check: CHECKS.abn, fmt: "11 digits" },
    "0199": { keep: true, re: /^[A-Z0-9]{18}\d{2}$/, check: CHECKS.lei, fmt: "20 characters" },
    "9918": { keep: true, re: /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/, check: CHECKS.iban, fmt: "IBAN without spaces" },
    "0204": { asIs: true }
  };

  var FULL = "iso6523-actorid-upis::";

  function result(icd, value) {
    return { ok: false, icd: icd, value: value, scheme: find(icd), id: "", full: "", errors: [], warnings: [], notes: [], checkDigits: null };
  }

  function check(icd, raw) {
    icd = String(icd == null ? "" : icd).trim();
    var r = result(icd, "");
    var s = r.scheme;
    if (!/^\d{4}$/.test(icd)) { r.errors.push("The scheme code must be 4 digits, such as 0208 or 9930."); return r; }
    if (!s) { r.errors.push("Scheme " + icd + " is not in the Peppol participant identifier scheme list (v" + LIST_VERSION + ")."); return r; }
    if (s.state === "removed") r.errors.push("Scheme " + icd + " (" + s.id + ") has been removed from Peppol. It can't be used for new registrations.");
    if (s.state === "deprecated") r.warnings.push("Scheme " + icd + " (" + s.id + ") is deprecated in Peppol. It may stop working; ask the receiver whether they also have an ID under an active scheme.");

    var rule = RULES[icd] || {};
    var v = String(raw == null ? "" : raw).trim();
    if (!rule.asIs) {
      v = v.replace(/[\s.\-\/]/g, "");
      if (rule.keep || rule.prefix || /VAT$/.test(s.id)) v = v.toUpperCase();
    }
    if (!v) { r.errors.push("Enter the number."); return r; }
    if (rule.strip && rule.strip.test(v)) {
      while (rule.strip.test(v)) v = v.replace(rule.strip, "");
      r.notes.push("Removed the letters around the number: this scheme takes digits only.");
    }
    if (rule.prefix && v.indexOf(rule.prefix) !== 0) {
      v = rule.prefix + v;
      r.notes.push("Added the " + rule.prefix + " country prefix.");
    }
    if (rule.pad && new RegExp("^" + (rule.prefix || "") + "\\d{" + rule.pad + "}$").test(v)) {
      v = (rule.prefix || "") + "0" + v.slice((rule.prefix || "").length);
      r.notes.push("Added the leading 0: Belgian enterprise numbers have 10 digits.");
    }
    if (!rule.prefix && /VAT$/.test(s.id) && s.cc !== "INT") {
      var pre = s.cc === "GR" ? "EL" : s.cc;
      if (!/^[A-Z]{2}/.test(v)) r.warnings.push("VAT numbers in e-invoices carry the country prefix (" + pre + "). Peppol IDs under VAT schemes are normally written the same way, for example " + icd + ":" + pre + v + ". Check how the receiver registered it.");
      else if (v.slice(0, 2) !== pre && !(s.cc === "GR" && v.slice(0, 2) === "GR")) r.warnings.push("The number starts with " + v.slice(0, 2) + ", but scheme " + icd + " is for " + COUNTRY[s.cc] + " (" + pre + ") VAT numbers.");
    }
    if (rule.asIs) r.notes.push("Use this ID exactly as the receiver gave it. It is not checked further here.");
    if (/\s/.test(v)) r.errors.push("The number contains spaces.");
    if (rule.re) {
      if (!rule.re.test(v)) r.errors.push("This doesn't look like a " + s.name + ": expected " + rule.fmt + ".");
      else if (rule.check) {
        r.checkDigits = rule.check(v);
        if (!r.checkDigits) r.errors.push("The check digit doesn't match. There is probably a typing mistake in the number.");
      }
    }
    r.value = v;
    r.id = icd + ":" + v;
    r.full = FULL + r.id;
    r.ok = r.errors.length === 0;
    return r;
  }

  // Accepts "0208:0123456749" or "iso6523-actorid-upis::0208:0123456749".
  function parse(text) {
    var t = String(text == null ? "" : text).trim().replace(/^iso6523-actorid-upis::/i, "");
    var m = /^(\d{4})\s*:\s*(.+)$/.exec(t);
    if (!m) {
      var r = result("", t);
      r.errors.push(/^\d{4}$/.test(t)
        ? "That is only the scheme code. A Peppol ID is the scheme code, a colon and the number, such as 0208:0123456749."
        : "A Peppol ID is a 4-digit scheme code, a colon and the number, such as 0208:0123456749 or 9930:DE123456789. If you only have a company or VAT number, use the builder above.");
      return r;
    }
    return check(m[1], m[2]);
  }

  var api = { LIST_VERSION: LIST_VERSION, SCHEMES: SCHEMES, COUNTRY: COUNTRY, TIPS: TIPS, find: find, forCountry: forCountry, countries: countries, check: check, parse: parse };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VLPeppol = api;
})(this);
