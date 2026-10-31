/* Leaked-key scanner logic. Runs entirely in the browser: nothing is uploaded.
   Finds common secret keys in source code the user owns, and decodes Supabase keys
   to tell a safe "anon" key from a dangerous "service_role" key. */
(function (root) {
  "use strict";

  var RULES = [
    { id: "openai", name: "OpenAI API key", severity: "critical", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, fix: "Revoke it at platform.openai.com → API keys. Call OpenAI from your server, never from the browser." },
    { id: "anthropic", name: "Anthropic API key", severity: "critical", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, fix: "Revoke it in the Anthropic Console. Keep it in a server-side environment variable." },
    { id: "stripe_live", name: "Stripe live secret key", severity: "critical", re: /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/g, fix: "Roll the key in the Stripe Dashboard → Developers → API keys. Only publishable keys (pk_) belong in front-end code." },
    { id: "stripe_test", name: "Stripe test secret key", severity: "medium", re: /\b(?:sk|rk)_test_[A-Za-z0-9]{16,}\b/g, fix: "Test keys can't move real money, but roll it anyway and keep secret keys on the server." },
    { id: "aws", name: "AWS access key ID", severity: "critical", re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, fix: "Deactivate it in AWS IAM, check CloudTrail for misuse, and use roles or server-side credentials." },
    { id: "github", name: "GitHub token", severity: "critical", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/g, fix: "Revoke it at github.com → Settings → Developer settings → Tokens." },
    { id: "razorpay", name: "Razorpay live key ID", severity: "medium", re: /\brzp_live_[A-Za-z0-9]{10,}\b/g, fix: "A key ID alone is public, but the key secret must never sit next to it. Search for the secret too, and roll the pair if it's exposed." },
    { id: "google", name: "Google API key", severity: "medium", re: /\bAIza[0-9A-Za-z_-]{35}\b/g, fix: "Restrict the key to your domains and APIs in Google Cloud Console, or roll it if it's unrestricted." },
    { id: "slack", name: "Slack token", severity: "critical", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, fix: "Revoke it at api.slack.com → Your apps." },
    { id: "private_key", name: "Private key block", severity: "critical", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----/g, fix: "Remove the file from the code and its git history, then replace the key." }
  ];
  var JWT = /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
  var PUBLIC_ENV = /\b(?:NEXT_PUBLIC_|VITE_|REACT_APP_|EXPO_PUBLIC_|PUBLIC_)([A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN)[A-Z0-9_]*)\b/g;

  function b64urlDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    if (typeof atob === "function") {
      try { return decodeURIComponent(escape(atob(s))); } catch (e) { return atob(s); }
    }
    return Buffer.from(s, "base64").toString("utf8");
  }

  function mask(v) {
    return v.length <= 12 ? v.slice(0, 3) + "…" : v.slice(0, 8) + "…" + v.slice(-4);
  }

  function lineOf(text, index) {
    return text.slice(0, index).split("\n").length;
  }

  function scanText(text, file) {
    var out = [];
    file = file || "pasted text";
    RULES.forEach(function (r) {
      r.re.lastIndex = 0;
      var m;
      while ((m = r.re.exec(text))) {
        out.push({ file: file, line: lineOf(text, m.index), type: r.name, severity: r.severity, value: mask(m[0]), fix: r.fix });
      }
    });
    JWT.lastIndex = 0;
    var j;
    while ((j = JWT.exec(text))) {
      var payload = null;
      try { payload = JSON.parse(b64urlDecode(j[0].split(".")[1])); } catch (e) { payload = null; }
      if (!payload) continue;
      var role = payload.role || "";
      var isSupabase = payload.iss === "supabase" || /supabase/.test(String(payload.iss || "")) || role === "anon" || role === "service_role";
      if (role === "service_role") {
        out.push({ file: file, line: lineOf(text, j.index), type: "Supabase service_role key", severity: "critical", value: mask(j[0]),
          fix: "This key bypasses Row Level Security: anyone who has it can read and change every table. Rotate it in Supabase → Project Settings → API, and use it only on a server." });
      } else if (isSupabase && role === "anon") {
        out.push({ file: file, line: lineOf(text, j.index), type: "Supabase anon key", severity: "info", value: mask(j[0]),
          fix: "Anon keys are meant to be public, but only safe when Row Level Security is ON for every table, with policies that limit each user to their own rows." });
      }
    }
    PUBLIC_ENV.lastIndex = 0;
    var p;
    while ((p = PUBLIC_ENV.exec(text))) {
      out.push({ file: file, line: lineOf(text, p.index), type: "Secret-looking variable exposed to the browser", severity: "high", value: p[0],
        fix: "Variables starting with NEXT_PUBLIC_, VITE_, REACT_APP_ or EXPO_PUBLIC_ are bundled into the browser. Rename it without the prefix and read it only on the server." });
    }
    return out;
  }

  var ORDER = { critical: 0, high: 1, medium: 2, info: 3 };
  function summarize(findings) {
    var counts = { critical: 0, high: 0, medium: 0, info: 0 };
    findings.forEach(function (f) { counts[f.severity]++; });
    var score = Math.max(0, 100 - counts.critical * 40 - counts.high * 20 - counts.medium * 8);
    var grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 55 ? "C" : score >= 30 ? "D" : "F";
    findings.sort(function (a, b) { return ORDER[a.severity] - ORDER[b.severity]; });
    return { counts: counts, score: score, grade: grade, findings: findings };
  }

  var api = { scanText: scanText, summarize: summarize, mask: mask };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VLSecrets = api;
})(this);
