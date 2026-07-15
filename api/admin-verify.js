// Server-side admin password check. The password lives ONLY in a Vercel
// environment variable (never in client code or the repo). Even if the
// password were guessed, chat logs stay protected by Firestore rules that
// require the owner's signed-in account — this is defence in depth.

const FIREBASE_API_KEY = 'AIzaSyBSAQOlqHnkcWCtwOFMeBIVqyjWiHR0zcQ';

// Small in-memory throttle to blunt brute-force (best-effort per warm instance)
const attempts = new Map();

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    // must be a signed-in user
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) return res.status(401).json({ ok: false, error: 'Sign in required.' });
    const lookup = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) }
    );
    if (!lookup.ok) return res.status(401).json({ ok: false, error: 'Invalid session.' });
    const info = await lookup.json();
    const user = info.users && info.users[0];
    if (!user) return res.status(401).json({ ok: false, error: 'Invalid session.' });

    const uid = user.localId;
    const now = Date.now();
    const rec = attempts.get(uid) || { n: 0, t: now };
    if (now - rec.t > 15 * 60 * 1000) { rec.n = 0; rec.t = now; }
    if (rec.n >= 8) return res.status(429).json({ ok: false, error: 'Too many attempts. Try again later.' });

    const password = (req.body && typeof req.body.password === 'string') ? req.body.password : '';
    const expected = process.env.ADMIN_PASSWORD || '';
    if (!expected) return res.status(500).json({ ok: false, error: 'Admin password not configured.' });

    // constant-time-ish compare
    const ok = password.length === expected.length &&
      password.split('').reduce((a, c, i) => a & (c === expected[i] ? 1 : 0), 1) === 1;

    if (!ok) {
      rec.n += 1; attempts.set(uid, rec);
      return res.status(403).json({ ok: false, error: 'Wrong password.' });
    }
    attempts.delete(uid);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('admin-verify error', e);
    return res.status(500).json({ ok: false, error: 'Something went wrong.' });
  }
}
