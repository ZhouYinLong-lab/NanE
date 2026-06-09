# NanE Auth / UX / Items Improvements

**Date:** 2026-06-10
**Status:** Implemented
**Branch:** Multiple worktrees → main

## Overview

Comprehensive improvements across four areas:
1. Login security (change password, profile form UX)
2. Login page UI (spacing, layout)
3. Item upload validation (expiry date)
4. Item lifecycle (auto-expire, takedown)

Plus three additional items:
5. Home page tags (responsive multi-line, multi-select)
6. Debug mode (hide test data in production)
7. Navigation restructure (settings → mine sub-menu)

---

## 1. Change Password (Logged-in User)

### Decision
Use **current password verification + new password typed twice** (traditional pattern). No email verification needed since user is already authenticated via JWT.

### Rationale
- User already holds a valid JWT, proving they control the account
- Email verification is for the "forgot password" flow (unauthenticated)
- Typing twice prevents typos in the new password
- Current password verification prevents unauthorized changes if someone gains device access

### Implementation
- **New endpoint:** `POST /api/auth/password/change`
- Input: `{ currentPassword, newPassword, confirmPassword }`
- Server validates: current password correct (timing-safe compare), new password strength, confirm match
- Frontend: form in settings area (hidden by default), shown via "修改密码" button

### Alternatives Considered
- Email verification approach: redundant for authenticated users, adds friction
- Single password field: risk of typos locking user out

---

## 2. Profile Form Auto-Close

### Decision
After saving profile successfully, hide the profile form card (`profileFormCard`).

### Rationale
- Matches behavior of password set prompt (hides after success)
- User feedback: "账号资料修改了之后页面不会像修改密码一样自动收回"
- Clean UX: confirmation message visible, form collapses

### Implementation
- Add `$("profileFormCard").hidden = true` after successful save in `saveProfile()`

---

## 3. Login Page UI Spacing

### Decision
Restructure email login to two rows:
- Row 1: email input (full width)
- Row 2: verification code input + send button + login button (right-aligned)

### Rationale
- Current layout squeezes email-combo and button in one row → cramped
- Two rows with gap provides breathing room
- Buttons on right follows common login form patterns

### Implementation
- HTML: split codeLoginSection and passwordLoginSection into two auth-row divs
- CSS: auth-row already has `gap: var(--space-md)`

---

## 4. Item Upload Expiry Date Validation

### Decision
Reject `expireDate` that is today or earlier at upload time.

### Rationale
- "虽然审核能筛选掉" — but blocking at upload is a better UX
- Prevents obviously invalid submissions before they reach review queue
- Today is considered expired (items should have at least 1 day of validity)

### Implementation
- In `validateItemInput()`: after format check, compare expireDate to current date
- Error message: "有效期不能早于明天，请修改后重新提交"

---

## 5. Auto-Expire Items

### Decision
Run an idempotent UPDATE before every item listing query to auto-expire past-date items. Show expired count to the owner.

### Rationale
- No cron job infrastructure available
- Pre-query sweep is cheap (indexed on status + expire_date)
- Idempotent: running multiple times is harmless
- Owner should be notified of newly expired items

### Implementation
- Server: `UPDATE items SET status = 'expired' WHERE status = 'online' AND no_expiry = false AND expire_date < CURRENT_DATE`
- Runs before `listItems()` and `adminListItems()` SELECT queries
- New endpoint `GET /api/me/expired-count` returns count of user's expired items
- Frontend can poll this and show a banner

---

## 6. Home Page Tags

### Decision
Multi-line wrapping (`flex-wrap: wrap`) + multi-select toggle (checkboxes behavior), remove horizontal scrollbar.

### Rationale
- Current `overflow-x: auto` with single-select is restrictive
- Multi-select allows filtering e.g. "感冒药 OR 退烧药"
- Wrapping is natural responsive behavior, no custom scrollbar needed

### Implementation
- CSS: `.chips` → remove `overflow-x: auto`, add `flex-wrap: wrap`
- JS: toggle chip.active on click (multi-select), deactivate "全部" when others selected
- Client-side filtering for multiple type/category combinations

### Alternatives Considered
- Server-side multi-filter: requires API changes, more complex
- Keep single-select: user explicitly asked for multi-select

---

## 7. Debug Mode

### Decision
Environment variable `DEBUG_MODE` controls visibility of test/demo data.

### Rationale
- Seed data (`u_demo` user) should not appear in production
- Simple env-var toggle, no database changes needed
- Server-side filtering ensures test data never reaches clients

### Implementation
- `server/env.js`: read `DEBUG_MODE` (default "false")
- When not debug: filter `WHERE owner_id NOT IN ('u_demo')` in listItems, adminListItems, admin stats
- Expandable test user list for future

---

## 8. Navigation: Settings → Mine Sub-menu

### Decision
Remove "设置" from main tab bar. Add "账号设置" as a sub-navigation item within "我的" view.

### Rationale
- 3 main tabs (发现/发布/我的) is cleaner than 4
- Settings is account-centric, logically belongs under "我的"
- Sub-nav pattern is already used (login-tabs), consistent

### Implementation
- Remove settings tab button from nav
- Add `.mine-subnav` with "我的发布" and "账号设置" sub-tabs inside view-mine
- Toggle between items panel and settings panel
- CSS: sub-nav styled like login-tabs for consistency

---

## Route Summary (New/Modified Endpoints)

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | `/api/auth/password/change` | Change password (authenticated) | New |
| GET | `/api/me/expired-count` | Get user's expired item count | New |
| POST | `/api/me/profile` | Update profile (existing, no change) | - |
| GET | `/api/items` | List items (added auto-expire + debug filter) | Modified |
| GET | `/api/admin/items` | Admin list items (added auto-expire + debug filter) | Modified |

## Files Modified

- `server/index.js` — auth endpoints, validation, auto-expire, debug filter
- `server/env.js` — DEBUG_MODE env var
- `web/index.html` — login layout, settings→mine restructure, change password form
- `web/styles.css` — tags wrapping, sub-nav styles, login spacing
- `web/app.js` — profile auto-close, change password handler, multi-select tags, mine sub-views
