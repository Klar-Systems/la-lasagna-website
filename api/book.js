// Vercel serverless function: receive the contact/reservation form and email it
// to the restaurant via Resend. Credentials come from environment variables
// (set in the Vercel dashboard), never hard-coded:
//   RESEND_API_KEY (required),
//   BOOKING_TO (recipient, defaults to the restaurant Gmail),
//   BOOKING_FROM (verified sender, e.g. reservations@lalasagnahelsinki.com;
//                 falls back to Resend's test address for first-run testing).
const { Resend } = require("resend");

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

  // Accept the key under any of the names it may have been given in the
  // Vercel dashboard (env vars are case-sensitive).
  const RESEND_API_KEY =
    process.env.RESEND_API_KEY || process.env.Resend || process.env.resend || process.env.RESEND;
  const { BOOKING_TO, BOOKING_FROM } = process.env;
  if (!RESEND_API_KEY) {
    // Until the Resend API key is added in Vercel, fail clearly (no crash).
    res.status(503).json({ ok: false, error: "Reservation email is not configured yet." });
    return;
  }

  const name = `${first} ${last}`;
  const to = BOOKING_TO || "lalasagnahelsinki@gmail.com";
  // A verified domain sender is preferred; the Resend test address lets the
  // form work before the domain is verified (it can only deliver to the
  // account owner's address, which is fine for first-run testing).
  const from = BOOKING_FROM || "La Lasagna <onboarding@resend.dev>";

  const resend = new Resend(RESEND_API_KEY);

  try {
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: `"${name}" <${email}>`,
      subject: `New table reservation — ${name}`,
      text: `New reservation request from the website.\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}\n`,
      html: `<h2 style="margin:0 0 12px">New table reservation</h2>
<p><strong>Name:</strong> ${esc(name)}<br>
<strong>Email:</strong> <a href="mailto:${esc(email)}">${esc(email)}</a></p>
<p><strong>Message:</strong><br>${esc(message).replace(/\n/g, "<br>")}</p>`,
    });
    if (error) throw new Error(error.message || "Resend error");
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("book: send failed:", err && err.message);
    res.status(502).json({ ok: false, error: "Could not send your request right now. Please email or call us." });
  }
};
