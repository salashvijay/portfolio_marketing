// Change these two lines when the mailbox and WhatsApp number exist.
const SITE = {
  email: "hello@vihsmai.com",
  whatsapp: ""
};

const email = document.getElementById("email-link");
email.textContent = SITE.email;
email.href = "mailto:" + SITE.email;

const wa = document.getElementById("whatsapp-link");
const note = document.getElementById("whatsapp-note");
const digits = (SITE.whatsapp || "").replace(/\D/g, "");

if (digits.length >= 10) {
  const text = encodeURIComponent("Hello Vihsm. I want to ask about hosting.");
  wa.href = "https://wa.me/" + digits + "?text=" + text;
  note.textContent = "";
} else {
  wa.classList.add("hidden");
}
