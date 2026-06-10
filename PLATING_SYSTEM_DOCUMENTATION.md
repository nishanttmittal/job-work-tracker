# UNICO Plating Job Work — Complete System Documentation (ACTUAL)

**App:** Plating Job Work (job-work-tracker) · **Live:** https://nishanttmittal.github.io/job-work-tracker/
**Repo:** github.com/nishanttmittal/job-work-tracker · **Local:** `C:\Users\lenovo\Desktop\job-work-tracker`
**Tech:** Vite + React + Tailwind · Firebase (Firestore) · jsPDF · SheetJS (xlsx import)
**Cloud:** project `unico-operations`, namespace `apps/platingjobwork`
**Generated from a code read on 2026-06-08.** Documents what is **actually implemented**, not the plan.
Legend: ✅ working · 🟡 works with caveat · 🟦 placeholder/dormant · 🔴 not built.

> **Purpose:** track plating material **sent OUT** to a job-work party and **received back IN**, per product, with a running pending balance, alerts and a shareable report. It is a **material in/out register** — not a payments or approval system.

---

## 1. Full App Workflow

### 1.1 Screens at a glance

| Screen | File | Who can open it | Purpose |
|---|---|---|---|
| **Module Home** | `ModuleHome.jsx` | Anyone with the URL | Card grid + stats (challans, active parties, this month) |
| **Dashboard** | `Dashboard.jsx` | Anyone | Party-wise pending, aging, red-flag alerts, per-party tables |
| **New Challan** | `NewEntry.jsx` | **Anyone (no login)** | Create an OUT or IN challan (bulk multi-product) |
| **Modify Challans** | `ModifyEntry.jsx` | **User password** (`nsp@123`) or admin | Edit challans from the **last 24h** |
| **Export / Share** | `Export.jsx` | Anyone | Build PDF report, share on WhatsApp |
| **Admin** | `Admin.jsx` | **Admin gate** (Google = `nspenterprises24@gmail.com`, or password `6133923_N`) | Reconcile, Excel import, logs, manage, backup, reset |

> ⚠️ There is **no role chooser and no login wall**. The app opens straight to the home grid. Only **Modify** and **Admin** are password-gated; **creating challans, viewing the dashboard, and exporting are open to anyone with the link.**

### 1.2 New Challan — the core flow
- **Inputs:** date (defaults today; day/month/year pickers) · direction **OUT** ("Sent for plating") / **IN** ("Received back") · party (dropdown, or **+ New Party** inline) · **multiple product line items** (product + qty; **+ New Product** inline; **+ Add Another Product**) · gaadi number (optional).
- **Live feedback:** as you pick a product, it shows that product's **current pending balance at that party** (🚩 red if already in excess).
- **Challan number:** a preview (e.g. `PJW-0007`) is shown; the **real unique number is assigned on save**.
- **What happens after Save:**
  1. `createChallan()` reserves a unique number and writes **one challan document** with its line items.
  2. An audit **log** line is written (`CREATE · PJW-0007 · OUT · Sriram · 3 item(s)`).
  3. Last party + direction are remembered for the next entry; the form resets; a "✓ Challan Saved!" toast shows.
- **Double-save guard:** ✅ the Save button disables (`saving` state) and the function ignores re-entry while in flight.
- 🟡 **Needs internet:** the number comes from the server, so an offline save **fails** with "check internet & retry" (the form is kept so you can retry). See §1.7.

### 1.3 Challan flow (OUT) & Receive-back flow (IN)
- **OUT** = material sent to the plating party. Increases that party+product's "out".
- **IN** = material received back. Increases "in".
- **Balance per party+product = OUT − IN.** Positive = still pending at the party; negative = more received than sent (a red-flag).
- There is **no explicit "link" between an OUT challan and its IN challan** — they are independent challans; reconciliation is by the running **balance per party+product**, not by matching challan to challan.

### 1.4 Approval / rejection flow
🔴 **Not implemented.** There is no pending→approved pipeline and no reject/rework status. The only correction mechanisms are:
- **Edit** within 24h (Modify page), and
- **Reconcile** any time (Admin) — edit a locked challan with a **mandatory reason**, which sets `reconciled: true` + `reconcileReason` and is logged.

### 1.5 Automation logic (summary; details in §4)
Atomic challan numbering · live balance/pending · 7-day aging reminders · IN>OUT red flags · 24h edit-lock · product-rename cascade · Excel bulk import with a reserved number block.

### 1.6 Edit / lock flow
- A challan is **editable by users for 24h** after creation (Modify page). After that it is **locked** and disappears from Modify; only **Admin → Reconcile** can change it (with a reason).
- `ChallanEditor` (shared) edits party, direction, date, gaadi and line items.

### 1.7 Offline behaviour (actual)
🟡 Firestore is initialised with an **in-memory cache + auto long-polling** — **persistent offline storage is NOT enabled** (the code comment notes IndexedDB hangs on iOS Safari, so it was disabled). Result: the app **needs a connection**; data loads online and creating a challan requires internet (server-issued number). The provider doc-comment that mentions "IndexedDB cache makes it work offline" is **out of date vs the actual config**.

---

## 2. User Roles & Permissions (actual)

There are **no named roles** in the app — access is by **what's gated**, not by an account type. Mapping your requested roles to reality:

| Requested role | Reality in this app | How they get in |
|---|---|---|
| **Worker / Staff** | "Anyone with the link" — **no login** | Just open the URL |
| **Manager / In-Charge** | "User" — only adds the **Modify** page | Password `nsp@123` |
| **Owner / Admin** | "Admin" | Google `nspenterprises24@gmail.com` **or** password `6133923_N` |

### Permission matrix

| Capability | Anyone (Worker) | User (Manager) | Admin (Owner) |
|---|:--:|:--:|:--:|
| View Dashboard | ✅ | ✅ | ✅ |
| **Create challans (OUT/IN)** | ✅ | ✅ | ✅ |
| Export / share PDF | ✅ | ✅ | ✅ |
| Add party / product (during entry) | ✅ | ✅ | ✅ |
| Open **Modify**, edit challans **≤24h** | 🔴 | ✅ | ✅ |
| Edit challans **>24h** (reconcile) | 🔴 | 🔴 | ✅ |
| Excel import | 🔴 | 🔴 | ✅ |
| Rename product (cascades) | 🔴 | 🔴 | ✅ |
| **Delete** (by date range) / **Reset all** | 🔴 | 🔴 | ✅ |
| Backup / Restore | 🔴 | 🔴 | ✅ |
| View audit logs | 🔴 | 🔴 | ✅ |

> 🔴 **Key gap:** there is **no per-challan delete in Modify** — deletion is admin-only and **by date range** (or full reset). And **anyone can create challans** without any identity.

---

## 3. Database Structure (Firestore)

All under `apps/platingjobwork/`. **Per-document challans** (concurrent-safe) + a few singletons.

| Path | Type | Contents |
|---|---|---|
| `apps/platingjobwork/challans/{id}` | collection | one challan per doc |
| `apps/platingjobwork/logs/{id}` | collection | one audit line per doc |
| `apps/platingjobwork/meta/parties` | doc | `{ list: [...] }` |
| `apps/platingjobwork/meta/products` | doc | `{ list: [...] }` |
| `apps/platingjobwork/meta/counter` | doc | `{ value: N }` — atomic challan numbers |

### Challan fields
| Field | Type | Meaning |
|---|---|---|
| `id`, `createdAt` | string | auto |
| `challanNo` | text | `PJW-0001` (unique) |
| `date` | date | challan date |
| `party` | select | job-work party |
| `direction` | select | `out` (sent) / `in` (received back) |
| `gaadi` | text | vehicle no (optional) |
| `items` | list | `[{ product, quantity }]` (bulk line items) |
| `reconciled` | toggle | true if admin edited a locked challan |
| `reconcileReason` | text | mandatory reason recorded on reconcile |

**Log fields:** `id`, `ts`, `action` (CREATE/EDIT/DELETE/RECONCILE/IMPORT/RESET), `detail`, `by`.

### Relationships & data flow
```
meta/parties ─┐
meta/products ┼─ referenced by NAME in ── challans.items[]
              │
challans ──flattenChallans()──► moves [{party,product,direction,qty,date,...}]
                                   │
                                   └─ balance.js → Dashboard (pending / red-flags / aging)
meta/counter ──reserveChallanNumber() (atomic txn)──► challanNo
challans / parties / products / reset ──► logs (audit)
```
- **Links are by name** (party string, product string) — renaming a product **cascades** into challan items via an Admin action; renaming a party does **not** cascade.
- **Balance is fully derived** from challans → flattened moves; nothing is double-stored.

---

## 4. Automation Rules

| # | Rule | Trigger | Logic | Status |
|---|---|---|---|---|
| 1 | **Challan numbering** | On create | **Cloud:** atomic Firestore **transaction** on `meta/counter` → globally unique, even across devices. **Local:** `max(counter, highest existing)+1` with a collision-guard loop. | ✅ Genuinely duplicate-proof |
| 2 | **Material sent (OUT)** | Save OUT challan | Adds to party+product "out"; pending = out − in | ✅ |
| 3 | **Material received (IN)** | Save IN challan | Adds to "in"; pending decreases | ✅ |
| 4 | **Shortage / pending** | Derived | `balance = OUT − IN`; positive = pending at party; per-product + party-net on Dashboard | ✅ (informational, not enforced) |
| 5 | **Red-flag (over-receive)** | Derived | `IN > OUT` → 🚩 alert (excess received) | ✅ |
| 6 | **Aging reminder** | Derived | OUT pending ≥ `OUT_REMINDER_DAYS` (7) from the **oldest OUT date** for that party+product | ✅ |
| 7 | **24h edit lock** | Time-based | Challans older than `EDIT_LOCK_HOURS` (24) leave Modify; admin-reconcile only | ✅ |
| 8 | **Reconciliation** | Admin edits locked challan | Sets `reconciled`, requires reason, logged | ✅ |
| 9 | **Product rename cascade** | Admin | Renames in catalogue **and** all challan line items | ✅ |
| 10 | **Excel import** | Admin uploads .xlsx | Parses date-row / OUT-IN-column register → preview → bulk create with an **atomically reserved block** of numbers; product aliases merge variants | ✅ |
| 11 | **Reject / rework** | — | 🔴 Not modelled |
| 12 | **Payment logic** | — | 🔴 **Not in this app** (payments/rates/ledger live in the separate Welder app) |
| 13 | **Dashboard logic** | Derived | party-wise pending (+ breakdown), aging, red-flags, per-party tables, reconciliations, recent 5; party View filter | ✅ |
| 14 | **Notifications** | — | 🔴 None (on-screen only; manual WhatsApp PDF share) |

---

## 5. Edge Cases / Failure Cases

| Case | Actual behaviour | Verdict |
|---|---|---|
| **Duplicate challan number** | Cloud atomic transaction; local max+collision guard | ✅ Prevented |
| **Wrong quantity** | Edit ≤24h (Modify) or admin reconcile (logged) | ✅ |
| **Wrong party** | Party is editable in `ChallanEditor` (Modify ≤24h / reconcile) | ✅ |
| **Duplicate save click** | `saving` state + disabled button + async guard | ✅ |
| **Internet failure** | Create **fails** (needs server number); form kept, retry toast. No offline persistence (memory cache). | 🔴 Not offline-capable |
| **Wrong receive (IN) qty** | Editable like any challan; over-receiving surfaces as a 🚩 IN>OUT red flag (safety net) | ✅ |
| **Missing material / shortage** | Shown as positive pending + 7-day aging reminder; **not enforced** (no block) | 🟡 Informational |
| **Challan edit** | 24h user window; admin reconcile any time **with mandatory reason**; all logged | ✅ |
| **Restore a backup** | `replaceAll` clears then re-writes all challans (destructive, no merge) | 🟡 |
| **Delete a single challan** | Not possible in UI — only **delete by date range** or full reset (admin) | 🔴 Gap |
| **Rename a party** | Does **not** cascade to existing challans (product rename does) | 🟡 |

---

## 6. Security & Permission Risks

| Risk | Status | Detail |
|---|---|---|
| **No login to create/view** | 🔴 High | Anyone with the URL can create challans, view all data and export. No identity on entries. |
| **Gates are UI-only** | 🔴 High | Firestore rules allow **any signed-in (anonymous) user to read/write everything** under `apps/platingjobwork`. The user/admin passwords and the Google admin check only hide UI — they do **not** restrict the database. A technical user could write directly. |
| **Passwords in client code** | 🔴 High | `nsp@123` and `6133923_N` are shipped in `config.js` (visible in page source). |
| **Admin Google check is cosmetic** | 🟡 | `verifyAdminGoogle()` confirms the email is `nspenterprises24@gmail.com`, but the DB doesn't enforce it — it only unlocks the Admin screen. |
| **Destructive admin actions** | 🟡 | Delete-by-range, Reset-all, Restore are powerful and gated only at the UI. Mitigated by JSON backup + audit log. |
| **Shared project isolation** | ✅ | Rules scope `apps/platingjobwork` independently of welder/fitting/orders — changing one app's data needs its own path. |

> The fix is the same pattern just applied to the Welder app: **Google sign-in + a role list + Firestore rules that enforce roles server-side** (workers can stay anonymous for creating challans; edits/admin restricted by identity).

---

## 7. Scalability Review

| Aspect | Status | Note |
|---|---|---|
| Concurrent multi-device entry | ✅ | Per-document challans + **atomic counter** — no clobbering, no duplicate numbers |
| Volume of challans | 🟡 | `onSnapshot` loads **all** challans into memory; balance is recomputed client-side (parties × products × moves) each render. Fine for thousands; heavy at tens of thousands. **No pagination / date-window loading.** |
| Parties / products lists | 🟡 | Stored as single `meta` docs (`{list:[]}`) — fine for modest counts |
| Offline / poor network | 🔴 | Memory cache only — needs a connection (esp. to create) |
| Multi-factory | 🔴 | No `factoryId`; single namespace |
| Payments / contractor settlement | 🔴 | Not in this app (separate Welder app) |
| Reject / QC / approval | 🔴 | Not built |
| Cross-app link (Welder → Plating) | 🟦 | The Welder app *previews* plating challans but the **live push is not implemented on either side** — nothing writes welder challans into `apps/platingjobwork`. |

**Verdict:** the core data model (per-doc challans + atomic counter + derived balances) is **solid and concurrency-safe**, and Excel import + reconciliation are real strengths. The ceilings are: no real auth, no offline, no pagination for very large datasets, and single-factory.

---

## 8. Missing Features — Recommendations

**Security (highest priority)**
1. 🔴 **Real auth + role-based Firestore rules** (Google sign-in for Manager/Admin; workers anonymous for create only; restrict edit/delete/reset/import to roles) — mirror the Welder app's new model.
2. 🔴 **Remove client-side passwords** once auth is in.

**Reliability**
3. 🔴 **Offline create** — re-enable a persistent cache and a local number fallback, or queue offline creates (today it needs internet).
4. 🟡 **Per-challan delete** (audited) in addition to range-delete.
5. 🟡 **Merge (not replace) on restore**, and a cloud/versioned backup.

**Functionality**
6. **OUT↔IN linking / partial returns** so a return references its dispatch (currently only net balance).
7. **Reject / rework / QC status** if defective returns must be tracked separately.
8. **Cross-app link**: actually push Welder challans into this app (today it's a dormant preview), and feed plating completion to downstream apps.
9. **Party rename cascade** (today only product rename cascades).

**Scale & reporting**
10. **Pagination / date-window loading** of challans for large histories.
11. **`factoryId`** for multi-site (Kansala Rohtak).
12. **Auto WhatsApp daily summary**; per-party statement PDF.

---

## 9. Tests (reality)

Extensive Playwright/Node test suite exists (`test-v2.mjs`, `test-cloud-sync.mjs`, `test-unique.mjs`, `test-recon.mjs`, `test-partywise.mjs`, `test-admin-gate.mjs`, `test-iphone-*`, etc.) plus cloud diagnostic scripts (`diag-*`, `verify-cloud.mjs`, `cleanup-*`). Coverage is notably broader than the Welder app's single test. `vite build` produces a working PWA.

---

### One-line summary
**Real & working:** a concurrency-safe, atomic-numbered plating in/out register — bulk multi-product challans, live party-wise pending balances, 7-day aging + over-receive red flags, 24h edit lock, admin reconciliation with reasons, Excel import, product-rename cascade, audit log, backup/restore, and WhatsApp PDF export.
**Not real:** any login wall on create/view, server-enforced roles, offline use, per-challan delete, reject/rework, payments, multi-factory, and the Welder→Plating live link.
