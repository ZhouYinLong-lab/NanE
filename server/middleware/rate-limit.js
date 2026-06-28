// In-memory rate limiting for password login: email → {attempts, lockedUntil}
const loginAttempts = new Map();
function recordFailedLogin(key) {
  const now = Date.now();
  const rec = loginAttempts.get(key) || { attempts: 0, lockedUntil: 0 };
  rec.attempts += 1;
  if (rec.attempts >= 5) {
    rec.lockedUntil = now + 15 * 60 * 1000;
  }
  loginAttempts.set(key, rec);
}

module.exports = { loginAttempts, recordFailedLogin };
