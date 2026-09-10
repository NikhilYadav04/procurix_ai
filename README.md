<div align="center">

<h1>Procurix</h1>

<h3>Say what you need to buy. It does the rest.</h3>

<p>
It emails your suppliers, reads their quotes — PDFs, photographs, four lines typed in a reply —<br>
ranks them on <i>your</i> terms, and then watches the clock, because in India<br>
paying a small supplier late now costs you the tax deduction.
</p>

<p>
<img alt="Agentic AI Hackathon, IIT Bhubaneswar" src="https://img.shields.io/badge/Agentic%20AI%20Hackathon-IIT%20Bhubaneswar-A63C15?style=flat-square">
<img alt="LangGraph and Gemini" src="https://img.shields.io/badge/agent-LangGraph%20%2B%20Gemini-1E1A14?style=flat-square">
<img alt="17 agent tools" src="https://img.shields.io/badge/tools-17-6B5F4B?style=flat-square">
<img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white">
<img alt="Supabase Postgres" src="https://img.shields.io/badge/Supabase-Postgres-3FCF8E?style=flat-square&logo=supabase&logoColor=white">
<img alt="Section 43B(h) compliance engine" src="https://img.shields.io/badge/Section%2043B(h)-compliance%20engine-A81F2D?style=flat-square">
</p>

<br>

<a href="https://youtu.be/i7kpz78zU34"><img width="720" alt="Watch the Procurix demo" src="https://img.youtube.com/vi/i7kpz78zU34/maxresdefault.jpg"></a>

<p><b>▶ <a href="https://youtu.be/i7kpz78zU34">Watch the demo</a></b></p>

<br>

<p>
Built for the <b>Agentic AI Hackathon</b>, Indian Institute of Technology Bhubaneswar<br>
<b>Team KB Innovator</b> — Nikhil Yadav <i>(IIIT Ranchi)</i> · Kaushik Shahare <i>(Parul University)</i>
</p>

<p>
<a href="docs/Procurix-KB-Innovator-Round1.pdf"><b>Round 1 brief</b></a> &nbsp;·&nbsp;
<a href="docs/TECHNICAL.md"><b>Technical documentation</b></a>
</p>

</div>

---

## The problem

Two problems live in the same inbox.

**Buying is still email.** A firm needs 250 desks. Someone writes to five suppliers. Replies come back over a fortnight — one a PDF, one a photograph of a letterhead, one four lines typed into the message body. Someone retypes it all into a spreadsheet, gives up on comparing payment terms properly, and picks a number. The reason for the choice leaves with the inbox.

**And since 2023, paying late is a tax event.** Section 43B(h) of the Income Tax Act: if you do not pay a Udyam-registered micro or small supplier within the agreed term — 45 days maximum, 15 if nothing was agreed in writing — you cannot deduct that expense this year. It moves to the year you actually pay, plus interest at three times the RBI bank rate, compounded monthly, which is itself not deductible.

Nothing happens on day 46. Most firms find out at audit, ten months later, when nothing can be done.

---

## What it does

One chat box runs the whole loop.

| Step | What happens |
|------|--------------|
| **1. You describe it** | "I need 250 workstation desks, get quotes from Kumar, Rapid and Godrej" |
| **2. RFP drafted and sent** | Written, numbered, turned into a PDF, emailed from your own Gmail |
| **3. Quotes read from email** | It reads PDFs *and photographs* — price, delivery, terms, warranty, line items |
| **4. Ranked on your weights** | Move price / delivery / quality and the ranking reorders live |
| **5. Award** | Purchase order generated with your company details on it |
| **6. Clock watched to payment** | Record the invoice and the 43B(h) countdown starts, in rupees, before it becomes a loss |

Where competition beats negotiation, the same suppliers can bid the price down in a **live reverse auction** through a tokenised link — the vendor needs no account.

---

## Why it needs an agent, not a form

**You do not control the input.** Quotes arrive as scans and photographs. Conventional procurement software fixes this by making the supplier register on a portal and fill in a form — which is exactly why it never reached Indian SMEs. It asks the weaker party to change first. An agent reads whatever arrives.

**It is a chain, not a transaction.** One sentence expands into eight steps spread over days. A revised price, a missing delivery date, a vendor replying late — the branches are not a closed set, so they cannot be declared in advance.

**The criteria change every time.** Cheapest is not best. This month delivery decides it, next month payment terms. And always underneath: is this supplier MSME, because that sets when you are legally obliged to pay.

---

## Three design decisions

**The model never computes a rupee.** Scoring and compliance are ordinary TypeScript functions the agent calls as tools. A figure on screen cannot be hallucinated, because no model produced it.

**It refuses to invent.** Quote parsing runs at temperature zero against a strict schema and returns `null` for anything absent rather than a plausible guess, with a confidence score that feeds the ranking. Savings are claimed only where a losing quote exists to prove them.

**The human awards.** The agent ranks, explains and drafts. It does not commit money or send a negotiation without approval.

---

## Built with

| | |
|---|---|
| **Agent** | LangGraph 1.0 over Gemini · 17 tools · zod-typed contracts · SSE streaming |
| **Frontend** | Next.js 16 · React 19 · TypeScript · Tailwind · shadcn/ui |
| **Data** | Supabase Postgres · 13 tables · row-level security |
| **Identity** | Google OAuth · Gmail API with auto-refresh |
| **Documents** | PDFKit for RFPs and purchase orders |

**17 agent tools · 28 API routes · 12 screens · 13 database tables**

---

## Run it locally

```bash
npm install
cp .env.example .env.local     # fill in the values
npm run dev                    # http://localhost:3000
```

You will need a Supabase project, a Google OAuth client (with Gmail scope) and a Gemini API key. Every variable is listed in [the technical documentation](docs/TECHNICAL.md#environment-variables).

**To load the demo data:**

```bash
node scripts/seed-demo.js --reset    # 7 vendors, 5 RFPs, 8 POs, 2 live auctions
npx tsx scripts/verify-demo.ts       # 37 checks against the app's own logic
```

The seed builds a working procurement history: three quotes waiting on a live comparison, a purchase order eleven days past its MSME deadline, and a reverse auction mid-flight. Dates are relative to when you run it, so reseed before a demo.

---

## What it does not do

Worth saying plainly.

- **It does not find suppliers.** There is no discovery or marketplace. Vendors are added by the user.
- **GSTIN is validated, not looked up.** The full mod-36 check digit is verified offline, so an invented number is caught with no API call — but the live government registry lookup needs credentials that are not configured, so a supplier's MSME status is *recorded*, not *proven*. The interface says so rather than assuming.
- **Nothing runs on a schedule.** Quote syncing, compliance checks and reports run when asked. A background watcher on the inbox and the payment clock is the next thing to build.

---

## Repository

```
agent/tools/          17 agent tools — RFP, email, quotes, compliance, auctions, vendors
src/pages/            12 screens and 28 API routes
src/lib/              deterministic engines — scoring, MSME compliance, GSTIN, PDFs
src/components/       UI, quote comparison, MSME radar, auction feed
database/             schema, applied in order
scripts/              reset, seed and verify the demo
docs/                 technical documentation, the Round 1 brief, the demo script
```
