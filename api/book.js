// Vercel serverless function: receive the contact/reservation form and email it
// to the restaurant via their SMTP. Credentials come from environment variables
// (set in the Vercel dashboard), never hard-coded:
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_SECURE ("true" for 465),
//   SMTP_USER, SMTP_PASS, BOOKING_TO (recipient), BOOKING_FROM (optional From).
const nodemailer = require("nodemailer");

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); }
    catch { return Object.fromEntries(new URLSearchParams(req.body)); }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { return Object.fromEntries(new URLSearchParams(raw)); }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  let body;
  try { body = await readBody(req); }
  catch { res.status(400).json({ ok: false, error: "Bad request" }); return; }

  const get = (...keys) => {
    for (const k of keys) {
      if (body[k] != null && String(body[k]).trim()) return String(body[k]).trim();
    }
    return "";
  };

  // Spam honeypot: a hidden field humans never fill. If present, pretend success.
  if (get("_company", "_gotcha")) { res.status(200).json({ ok: true }); return; }

  const first = get("First Name", "firstName", "first_name");
  const last = get("Last Name", "lastName", "last_name");
  const email = get("Email", "email");
  const message = get("Message", "message");

  if (!first || !last || !email || !message) {
    res.status(422).json({ ok: false, error: "Please fill in all required fields." });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(422).json({ ok: false, error: "Please enter a valid email address." });
    return;
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, BOOKING_TO, BOOKING_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // Until the SMTP credentials are added in Vercel, fail clearly (no crash).
    res.status(503).json({ ok: false, error: "Reservation email is not configured yet." });
    return;
  }

  const port = Number(SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: SMTP_SECURE ? SMTP_SECURE === "true" : port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const name = `${first} ${last}`;
  const to = BOOKING_TO || SMTP_USER;
  const from = BOOKING_FROM || SMTP_USER;

  try {
    await transporter.sendMail({
      from: `"La Lasagna website" <${from}>`,
      to,
      replyTo: `"${name}" <${email}>`,
      subject: `New table reservation — ${name}`,
      text: `New reservation request from the website.\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}\n`,
      html: `<h2 style="margin:0 0 12px">New table reservation</h2>
<p><strong>Name:</strong> ${esc(name)}<br>
<strong>Email:</strong> <a href="mailto:${esc(email)}">${esc(email)}</a></p>
<p><strong>Message:</strong><br>${esc(message).replace(/\n/g, "<br>")}</p>`,
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("book: sendMail failed:", err && err.message);
    res.status(502).json({ ok: false, error: "Could not send your request right now. Please email or call us." });
  }
};
