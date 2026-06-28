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

function getLoginAttempts(key) {
  return loginAttempts.get(key);
}

function resetLoginAttempts(key) {
  loginAttempts.delete(key);
}

module.exports = { recordFailedLogin, getLoginAttempts, resetLoginAttempts };
