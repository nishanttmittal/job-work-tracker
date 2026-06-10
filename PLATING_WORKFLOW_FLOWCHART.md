# UNICO Plating Job Work — Workflow Flowcharts (Mermaid)

> ACTUAL implemented logic only (code read 2026-06-08). Database writes are shown
> in **orange** `[( )]`. Firestore collections live under `apps/platingjobwork/`.
> 🔴 = not implemented in this app.

---

## 1. Master flow — open → screens → actions → DB writes

```mermaid
flowchart TD
    Start(["Open app link (no login)"]) --> Home["MODULE HOME (card grid + stats)"]

    Home --> Dash["SCREEN: Dashboard"]
    Home --> New["SCREEN: New Challan"]
    Home --> ModGate{"Modify — password<br/>nsp@123 or admin"}
    Home --> Exp["SCREEN: Export / Share"]
    Home --> AdmGate{"Admin — Google<br/>nspenterprises24@gmail.com<br/>or password 6133923_N"}

    ModGate -->|"ok"| Mod["SCREEN: Modify Challans"]
    AdmGate -->|"ok"| Adm["SCREEN: Admin"]

    %% New challan
    New -->|"OUT/IN + products + Save"| CreateC["createChallan()"]
    CreateC --> Rsv[("meta/counter<br/>atomic transaction +1")]
    Rsv --> Wc[("challans/{id} create")]
    Wc --> Wlog1[("logs: CREATE")]

    %% Dashboard reads (derived)
    Dash -->|"reads"| Derive["flattenChallans → balance.js"]
    Derive --> DashOut["pending · red-flags · 7-day aging · per-party tables"]

    %% Modify
    Mod -->|"edit (≤24h)"| Wc2[("challans/{id} update")]
    Wc2 --> Wlog2[("logs: EDIT")]

    %% Export
    Exp -->|"build PDF → WhatsApp"| PDF["jsPDF report (read-only)"]

    %% Admin tabs
    Adm --> Recon["Reconcile (any challan + reason)"]
    Adm --> Imp["Excel Import"]
    Adm --> Logs["Audit Logs (read)"]
    Adm --> Manage["Manage"]
    Recon -->|"update + reason"| Wc3[("challans/{id} update<br/>reconciled=true")]
    Wc3 --> Wlog3[("logs: RECONCILE")]
    Imp -->|"reserve block + bulk write"| Wblk[("meta/counter block<br/>+ challans batch")]
    Wblk --> Wlog4[("logs: IMPORT")]
    Manage -->|"rename / delete-range / reset / restore"| Wc4[("challans + meta writes")]
    Wc4 --> Wlog5[("logs: EDIT/DELETE/RESET")]

    classDef db fill:#fff3e0,stroke:#e8930c,stroke-width:2px,color:#7a4b00;
    classDef screen fill:#e8f0fe,stroke:#4361ee,color:#1b2a6b;
    classDef gate fill:#fde8e8,stroke:#d64545,color:#6b1212;
    class Rsv,Wc,Wlog1,Wc2,Wlog2,Wc3,Wlog3,Wblk,Wlog4,Wc4,Wlog5 db;
    class Dash,New,Mod,Exp,Adm,Home screen;
    class ModGate,AdmGate gate;
```

---

## 2. Challan flow (OUT) + Receive-back flow (IN) — the Save sequence

```mermaid
flowchart TD
    A(["New Challan screen"]) --> B["Pick date"]
    B --> Dir{"Direction"}
    Dir -->|"OUT (sent for plating)"| C["Pick party + add product lines (bulk)"]
    Dir -->|"IN (received back)"| C
    C --> Live["Live preview: pending balance of each product at that party (🚩 if excess)"]
    Live --> Save["Tap Save"]

    Save --> Vd{"Valid?<br/>party + ≥1 product with qty>0"}
    Vd -->|"no"| C
    Vd -->|"yes"| Guard{"Already saving?<br/>(button disabled guard)"}
    Guard -->|"yes"| Ignore(["ignored"])
    Guard -->|"no"| Net{"Internet available?"}

    Net -->|"no"| Fail["Toast: check internet & retry<br/>(form kept — NO offline create)"]
    Net -->|"yes"| Num[("meta/counter:<br/>atomic txn → next number")]
    Num --> Fmt["challanNo = PJW-#### (zero-padded)"]
    Fmt --> Wc[("challans/{id} create:<br/>date, party, direction, gaadi,<br/>items[{product,qty}], reconciled=false")]
    Wc --> Lg[("logs: CREATE …")]
    Lg --> Done["Remember party+direction · reset form · ✓ toast"]

    classDef db fill:#fff3e0,stroke:#e8930c,stroke-width:2px,color:#7a4b00;
    class Num,Wc,Lg db;
```

> OUT and IN are **independent challans** — there is no challan-to-challan return matching. Reconciliation is by the **net balance per party+product** (see §3).

---

## 3. Automation — balance / shortage / alerts (all derived)

```mermaid
flowchart TD
    Ch[("challans (live via onSnapshot)")] --> Flat["flattenChallans() → moves[]<br/>{party, product, direction, qty, date}"]
    Flat --> Calc["calcBalance(party, product)<br/>balance = Σ OUT − Σ IN"]

    Calc --> P{"balance > 0?"}
    P -->|"yes"| Pend["PENDING at party (amber)"]
    P -->|"= 0"| Clear["✓ Cleared"]
    P -->|"< 0 (IN > OUT)"| Flag["🚩 RED FLAG — excess received"]

    Pend --> Age{"oldest OUT ≥ 7 days?<br/>(OUT_REMINDER_DAYS)"}
    Age -->|"yes"| Remind["⏰ Aging reminder on Dashboard"]
    Age -->|"no"| skip[" "]

    Pend --> Sum["Party-wise pending summary + product breakdown"]
    Flag --> Sum
    Clear --> Sum
    Sum --> DB["Dashboard: summary · alerts · per-party tables · recent · reconciliations"]

    classDef db fill:#fff3e0,stroke:#e8930c,stroke-width:2px,color:#7a4b00;
    class Ch db;
```

---

## 4. Edit / 24h-lock / reconcile flow

```mermaid
flowchart TD
    Want(["Need to change a challan"]) --> Age{"Age of challan?"}
    Age -->|"≤ 24h (EDIT_LOCK_HOURS)"| ModP{"Modify password<br/>nsp@123 / admin"}
    Age -->|"> 24h (locked)"| AdmP{"Admin gate"}

    ModP -->|"ok"| Edit["Edit in ChallanEditor<br/>(party/direction/date/gaadi/items)"]
    Edit --> Wu[("challans/{id} update")]
    Wu --> Lg1[("logs: EDIT")]

    AdmP -->|"ok"| Recon["Admin → Reconcile<br/>edit ANY challan"]
    Recon --> Reason{"Reason entered?<br/>(mandatory)"}
    Reason -->|"no"| Recon
    Reason -->|"yes"| Wr[("challans/{id} update<br/>reconciled=true, reconcileReason")]
    Wr --> Lg2[("logs: RECONCILE")]

    note["NOTE: no per-challan DELETE in UI —<br/>only Admin delete-by-date-range or full reset"]:::n
    classDef n fill:#fdeaea,stroke:#d64545,color:#6b1212;
    classDef db fill:#fff3e0,stroke:#e8930c,stroke-width:2px,color:#7a4b00;
    class Wu,Lg1,Wr,Lg2 db;
```

---

## 5. Admin — import / manage flows

```mermaid
flowchart TD
    Adm(["Admin (gated)"]) --> T{"Tab"}

    T -->|"Import"| Up["Upload .xlsx + pick party"]
    Up --> Parse["parseJobWorkExcel() → preview<br/>(date rows · OUT/IN columns · alias merge)"]
    Parse --> Conf{"Confirm import?"}
    Conf -->|"yes"| Blk[("meta/counter: reserve block (atomic)")]
    Blk --> Bw[("challans: batch write PJW-#### sequential")]
    Bw --> Lgi[("logs: IMPORT")]

    T -->|"Manage"| M{"Action"}
    M -->|"rename product"| Rn[("challans: cascade rename items<br/>+ meta/products")]
    M -->|"delete by date range"| Del[("challans: removeWhere(date in range)")]
    M -->|"backup"| Bk["download JSON (read-only)"]
    M -->|"restore"| Rs[("challans.replaceAll (clear+write)")]
    M -->|"reset all"| Rz[("challans.reset (delete all)")]
    Rn --> Lgm[("logs: EDIT")]
    Del --> Lgm
    Rs --> Lgm
    Rz --> Lgr[("logs: RESET")]

    T -->|"Logs"| Lv["Audit log viewer (read)"]

    classDef db fill:#fff3e0,stroke:#e8930c,stroke-width:2px,color:#7a4b00;
    class Blk,Bw,Lgi,Rn,Del,Rs,Rz,Lgm,Lgr db;
```

---

## 6. Payment flow

```mermaid
flowchart TD
    Pay(["Payment / Rates / Ledger / Settlement"]) --> X["🔴 NOT IMPLEMENTED in the Plating app"]
    X --> Y["This app tracks MATERIAL in/out only.<br/>Contractor payments, piece-rates, ledger and<br/>settlement live in the separate WELDER app."]

    classDef todo fill:#fdeaea,stroke:#d64545,color:#6b1212;
    class X,Y todo;
```

---

## 7. Database collections & data flow

```mermaid
flowchart LR
    subgraph Cloud["apps/platingjobwork (Firestore)"]
      C[("challans/{id}")]
      L[("logs/{id}")]
      Pm[("meta/parties {list}")]
      Pr[("meta/products {list}")]
      Cn[("meta/counter {value}")]
    end

    Cn -->|"atomic txn → unique no."| C
    Pm -. "name ref" .-> C
    Pr -. "name ref" .-> C
    C --> Flat{{"flattenChallans → moves"}}
    Flat --> Bal{{"balance engine (derived)"}}
    Bal --> Dash["Dashboard / Export PDF"]
    C -.->|"every create/edit/delete/reconcile/import/reset"| L

    classDef db fill:#fff3e0,stroke:#e8930c,stroke-width:2px,color:#7a4b00;
    class C,L,Pm,Pr,Cn db;
```

---

### Legend
- 🟧 Orange `[( )]` = a Firestore write under `apps/platingjobwork/`.
- 🟦 Blue = screen · 🟥 Red = a gate or a not-implemented item.
- "Derived" = computed live from challans, never stored twice.
- Reflects the code on **2026-06-08**. Note: creating a challan **requires internet** (server-issued atomic number); the app is not offline-capable.
