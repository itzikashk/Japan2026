import {
  createSessionToken,
  verifySessionToken,
  parseCookie,
  passwordsMatch,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "../lib/session.js";

export default async function handler(req, res) {
  const secret = process.env.FAMILY_SITE_PASSWORD || "";

  if (req.method === "POST") {
    if (!secret) {
      res.status(500).json({
        error: "האתר עדיין לא הוגדר: חסר משתנה הסביבה FAMILY_SITE_PASSWORD בפרויקט ב-Vercel.",
      });
      return;
    }
    const password = req.body && req.body.password;
    if (!password || !(await passwordsMatch(String(password), secret))) {
      res.status(401).json({ error: "סיסמה שגויה." });
      return;
    }
    const token = await createSessionToken(secret);
    res.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`
    );
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === "DELETE") {
    res.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
    );
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === "GET") {
    const token = parseCookie(req.headers.cookie, SESSION_COOKIE);
    const valid = !!secret && (await verifySessionToken(token, secret));
    res.status(200).json({ authenticated: valid });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
