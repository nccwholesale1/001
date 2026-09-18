# Product Requirements Document — NCC Supply Wholesale Storefront

**Version:** 3.1 — Build Release, amended during build
**Date:** 11 September 2026 · last amended 17 September 2026
**Status:** In build — Claude Code (application) + Shopify (commerce platform)
**Supersedes:** all earlier drafts (v1.0–v2.2) circulated for review. This is the consolidated, build-ready version of the PRD — the pre-build review history has been folded into the spec itself rather than kept as a running diff.

**How to use this document.** Sections 1–6 specify the product: what it does, who uses it, and every screen. Section 7 sets the working architecture — Shopify plus a lean custom backend — and is written as a decision already adopted for this build, not an open menu of options. All product content shown anywhere below (titles, prices, SKUs, collection names) is placeholder lorem ipsum — real values are supplied by Shopify at build/runtime.

> **This document has been amended since build started.** v3.0 described the product as specified *before* any code existed. Where the product as built now differs — because a business decision was taken, a Shopify limitation was discovered, or NCC changed its mind — the body text below has been updated to describe the product **as it actually is**, and every such change is recorded in **§14 Amendment Log** with the original v3.0 wording preserved verbatim. Amended passages carry an inline `(amended — §14 A#)` marker so any statement can be traced back to what it originally said and why it changed. Section 13 (Open Questions) tracks what remains genuinely undecided.

---

## 1. Product Overview

NCC Supply is a B2B trade storefront for mobile and device accessories and repair parts, serving retailers and repair workshops who order in volume and need confirmed quantities and a VAT invoice — not an instant consumer checkout.

The defining product decision: **the site never promises live inventory.** Every line is presented as "available to order." A customer submits a basket with no payment, NCC reviews and approves what can actually be supplied, and only then does the customer pay against a confirmed order.

The storefront is open to anyone. Nothing in this document gates browsing, quoting, or ordering behind registration — company accounts are an optional convenience layer on top of that open default (§2).

### 1.1 Goals

| # | Goal | Success signal |
|---|---|---|
| G1 | Let a trade buyer assemble a multi-line basket quickly and with no friction — this is about a fast default experience, not a deadline; no time limit is ever imposed on the buyer | Median basket-build time (watched to spot friction, never enforced as a target); lines per basket |
| G2 | Remove payment anxiety from first contact | Basket submission rate vs. sessions |
| G3 | Give NCC a single screen to review, confirm and invoice an order | Time from submission to confirmed order |
| G4 | Rank for category and trade-intent search queries | Organic entries on category pages |
| G5 | Answer ordering questions before a human is needed | FAQ expand rate; contact deflection |
| G6 | Let a buyer find any SKU in a large catalogue without browsing collection-by-collection | Search/filter usage vs. category-grid clicks |
| G7 | Let a registered company reorder or bulk-order without rebuilding a basket line by line | Share of orders placed via reorder/CSV vs. manual basket |
| G8 | Give a company admin visibility over their buyers' activity | Admin dashboard engagement among multi-buyer accounts |
| G9 | Make requesting a return or raising a complaint as fast and low-friction as placing an order — never a dead end or an email-only fallback | Return/support request completion rate; time to first response |

### 1.2 Non-goals

- Consumer-facing instant checkout at basket time.
- Live stock counters, "only 3 left" scarcity, or delivery-date promises.
- Reviews, ratings or any social proof — no fabricated content, ever.
- Multi-currency, saved payment methods, loyalty pricing outside agreed contract tiers, and real-time live chat (support is ticket/status-based — §6.18).
- Registration is never required to order — company accounts (§2) are additive, not a gate.

### 1.3 UX priority principle

Every flow in this product — ordering, quoting, bulk upload, returns, support, account management — is held to the same bar: clear states, no dead ends, fast on mobile, and never a bottom-out into "email us" with no way to check status. A support ticket or return request gets the same trackable, token-gated status view as an order (§4). New flows reuse the component library in §5 rather than inventing one-off patterns.

---

## 2. Users and Roles

Nobody needs an account to browse, request a quote, or place an order — guest ordering via a private token-gated link is a first-class path through every flow in this document. Company accounts and sales rep assignment are optional layers on top of that default.

**Trade buyer (guest or company).** Retail shop owner or repair workshop manager. Time-poor, price-literate, orders the same lines repeatedly, wants keen trade pricing and certainty about what will actually ship. Orders as a guest via a private token link, or signs in to a company account for reorder history and multi-user buying. *(amended — §14 A1, A2: contract pricing removed; pricing is VAT-inclusive and VAT is never shown.)*

**Company admin.** Owns a company's account. Invites and removes buyer users, sets spend limits (informational context for their own review, not a gate — rule 6), and approves every order a buyer places under the company before it reaches NCC. A company may have more than one admin.

**Company buyer user.** A staff member invited under a company account (e.g. a branch manager at a multi-site retailer). Orders at the same list price as everyone else *(amended — §14 A1)*. Every order they place requires their company admin's approval before it reaches NCC — unconditionally, regardless of amount (rule 6).

**NCC admin.** The internal role that runs the storefront. Reviews and approves every order — guest and company alike — in one action that confirms quantities and delivery and finalizes the order together (rule 13) *(amended — §14 A2)*. Also resolves quotes, manages company accounts, triages returns and support tickets, and is the only role that can create sales rep accounts. Signs in with either an email address or an assigned username, in one field.

**NCC sales representative.** Internal staff scoped to an assigned book of company accounts, for relationship management — a read-only view of their accounts' orders, quotes and returns for context. A sales rep cannot approve orders, price quotes, or edit spend limits; only an NCC admin holds those permissions. Created only by an NCC admin, and only once a verified ID number is on file — the account cannot be activated without one. Signs in the same way as an NCC admin: email or username, one field. A company account is never required to have a sales rep assigned, and most may have none.

**Search engines and AI answer engines.** Consume structured data and question-shaped copy to surface NCC for category and process queries. Faceted URLs stay crawlable and non-duplicative (§9).

---

## 3. Information Architecture

```text
/                       Home — hero, category grid, featured lines, workflow, FAQ
/categories             Full catalogue index
/category/:slug         Collection listing — facet filters, sort, paginate
/search                 Full-catalogue search with facets
/product/:sku           Product detail
/basket                 Basket review + submit (no payment)
/bulk-order             CSV / SKU-list upload → basket
/order-submitted        Confirmation + private order link
/order/:id?token=       Guest view of a confirmed order (token-gated)
/checkout/:id?token=    Payment step — reachable only after NCC admin approval
/quote                  Request a formal quote
/quote/:id?token=       Quote status view — guest or account
/returns                Request a return against a confirmed order
/returns/:id?token=     Return status view — guest (token-gated)
/account/returns        Return history for a company account
/support                Raise a complaint / support ticket
/support/:id?token=     Support ticket status view — guest (token-gated) or account
/how-to-order           Ordering workflow explainer
/contact                General pre-purchase enquiry — distinct from /support (§6.18)
/auth                   Sign-in, role-based redirect — NCC admin/sales rep use email-or-username; company/buyer sign-in is email-only
/register               Company account registration / buyer invite acceptance
/account                Company dashboard — orders, reorder, users, pricing, returns, support
/account/orders         Order history with reorder action
/account/users          Company admin: manage buyer users and spend limits
/account/pricing        Company's contract/tier pricing reference
/staff/orders           NCC order review queue
/staff/order/:id        Order review and approval console
/staff/quotes           Quote queue
/staff/accounts         Manage company accounts and pricing tiers
/staff/returns          Return/RMA queue
/staff/support          Support/complaints queue
/staff/team             NCC admin only — manage NCC admin/sales rep accounts, ID verification, book-of-accounts assignment
```

Ten collections shipped at launch: Chargers, Car Chargers, Wireless Chargers, Power Banks, Headphones, Screens, Batteries, Repair Parts, Screen Protectors, iPad Digitizers. The catalogue is expanding beyond these ten — target collection/SKU count is Open Question 1 (§13). Above roughly 12–15 collections or a few hundred SKUs, the category-grid-only navigation stops scaling and `/search` with facets (§6.3) becomes the primary discovery path rather than a supplement to it.

---

## 4. Core Flows and Business Rules

```text
Browse / search / bulk-upload ──▶ Add to basket ──▶ Submit (no payment)
                                                            │
                                          ┌─────────────────┴─────────────────┐
                                          ▼ (company buyer — always)          ▼ (guest)
                                Company admin approval                  Straight to NCC review
                                          │ approved                          │
                                          └─────────────────┬─────────────────┘
                                                            ▼
                              NCC admin reviews and approves the order
                          (confirms quantities, delivery and VAT, and
                              approves — one action, every order)
                                                            │
                                    ┌──────────────────────┴──────────────────────┐
                                    ▼                                             ▼
                        Customer views confirmed order                    Order cancelled
                                    │
                                    ▼
                        Checkout — cash on delivery or invoice payment link
                                    │
                                    ▼ (within the return window)
                        Customer requests a return against this order
                                    │
                                    ▼
                        NCC reviews the return request
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
                Approved — refund or         Rejected — reason
                replacement issued           shown to customer
```

A separate, parallel path exists for formal quotes: browse or search → request a quote → NCC prices and issues it → the customer accepts → it becomes an order, entering the flow above at "NCC admin reviews and approves the order."

A second parallel path exists for support and complaints, and is *not* tied to any specific order: raised from anywhere on the site (optionally referencing an order) → NCC triages and responds → resolved or escalated. This never blocks or gates any part of the ordering flow — a customer can raise a complaint about a past order while a new basket is still open.

Rules that must survive any redesign:

1. No card details are captured at basket submission.
2. Quantities may only be reduced or removed during NCC's review, never silently increased.
3. Delivery is always shown, and the final total always agreed, before any payment is requested. Displayed prices are VAT-inclusive and VAT is never itemised or mentioned on any customer-facing surface. *(amended — §14 A2.)*
4. `/checkout/:id` returns the customer to the order view unless the order status is `confirmed`.
5. Order links are token-gated; no enumeration, no listing of other customers' orders.
6. Every company buyer's basket requires company admin approval before it reaches NCC — unconditionally, not limited to baskets over a spend limit. Only a guest basket skips this step. The buyer sees a clear pending-approval state, not a silent block.
7. Pricing is resolved server-side and never trusted from client state. Every customer sees the same uniform list price; no contract or tier pricing is configured. *(amended — §14 A1.)*
8. A quote is not an order and creates no obligation until explicitly accepted by the customer.
9. A return request must reference an existing confirmed order and its specific line(s) — there is no "return" with no order behind it.
10. Return status changes (approved/rejected, refund/replacement) are always visible to the customer on the same token-gated or account view as the originating order — never communicated by email alone.
11. A support/complaint ticket always has a trackable status view, even for a guest.
12. No screen enforces a minimum or maximum order quantity, on a line or on the basket/quote total — a buyer may order any quantity, from a single unit upward.
13. An NCC admin reviews and approves every order in one action — confirming quantities and delivery is part of that same approval, not a separate preceding step done by someone else. *(amended — §14 A2.)* This applies to every order, guest and company buyer alike, and is distinct from the company-side approval in rule 6. No order is `confirmed`, and no checkout link is reachable, until this happens.

---

## 5. Design System

### 5.1 Foundations

| Token | Value | Use |
|---|---|---|
| Primary (sky blue) | `#009EE1` | CTAs, accents, links, active states |
| Background | White / near-white | All page surfaces |
| Surface | White card on subtle grey | Product and content cards |
| Muted | Mid grey | Secondary copy, metadata, SKUs |
| Foreground | Near-black | Headings and body |
| Footer | Near-black | Inverted footer with white logo |

All colour is consumed through semantic tokens in the global stylesheet. Hard-coded colour utilities are not permitted in components.

**Typography:** Inter across display and body. Headings semibold, tight leading. Uppercase micro-labels at ~0.7rem with 0.18em tracking for eyebrows and step markers.

**Shape and depth:** 12px radius on cards and buttons, soft low-spread shadows, 1px hairline borders that shift to primary on hover/focus.

**Gradients:** two only — a light sky hero wash on white, and a saturated sky accent gradient for primary buttons, step icons and badges. A faint mesh overlay sits on hero surfaces at low opacity.

**Motion:** 200–500ms ease-out. Staggered rise-in on grids (40–70ms per item, capped), 1–4px hover lift on cards, image scale on category tiles, chevron rotation on disclosure. All motion respects reduced-motion preferences.

### 5.2 Component inventory

- **Header** — blue logo, primary nav, basket indicator, account entry point (shows signed-in company name + role when authenticated), and an always-visible "Help / Report an issue" support entry point — never buried in the footer only.
- **Footer** — white logo on near-black, no staff link exposed.
- **CategoryGrid** — searchable/filterable image tiles with line counts. On the homepage it lays out 1 / 2 / 3 per row at mobile / tablet / desktop, for wider tiles *(amended — §14 A10)*.
- **ProductCard** — gradient thumb, collection tag, title, SKU, price (no VAT label — §6.1), a quantity input (any positive integer, default 1), and an add control with confirm state *(amended — §14 A7)*.
- **CategoryRail** — the header's horizontal category strip. No visible scrollbar; left/right arrow buttons appear only when there is more to scroll in that direction. Wheel, touch and keyboard scrolling still work *(added — §14 A9)*.
- **OrderSteps** — five-step icon flow, compact and full variants.
- **FAQ disclosure grid** — natural-height cards, full-width CTA banner beneath.
- **Filter bar** — brand select, sort select, result count.
- **Facet sidebar** — multi-select checkbox groups per attribute (brand, category, compatibility, grade, etc.), applied-filter chips, clear-all, collapsible on mobile into a full-screen sheet.
- **SearchBar** — global header search with typeahead suggestions (products + collections), used on `/search`.
- **Pagination** — numbered, current state on gradient.
- **Staff console** — per-line quantity editor, totals, invoice link field, status actions.
- **CSV/bulk upload widget** — file drop or SKU/quantity paste, row-by-row match/no-match preview before adding to basket, error list for unrecognised SKUs.
- **Account dashboard shell** — sidebar nav (orders, users, pricing, returns, support), summary cards for open/pending items.
- **Approval banner/state** — inline "pending approval" indicator on basket and order-history rows, with approve/reject action for admins.
- **Buyer user table** — invite, role, spend limit, active/removed status, per-row edit.
- **Quote request form / quote detail view** — mirrors basket layout but produces a quote, not an order; status chips (requested, quoted, accepted, expired).
- **Return request form / return status view** — order-line picker (quantity, reason from a defined list, optional note/photo), status chips (requested, approved, rejected, refunded, replacement sent).
- **Support ticket form / ticket status view** — subject, category, optional order reference, message, attachment; status chips (open, awaiting NCC, awaiting customer, resolved, escalated); mirrors the return status view's disclosure/timeline pattern so the two feel like one family of "case" screens.

### 5.3 Responsive rules

| Breakpoint | Category tiles | Product grid | Steps | Facet sidebar |
|---|---|---|---|---|
| < 640px | 1 col | 1 col | 1 col | Hidden behind a "Filters" button → full-screen sheet |
| 640–1024px | 2 col | 2 col | 2 col | Hidden behind a "Filters" button → full-screen sheet |
| 1024px+ | 5 col | 4 col | 5 col | Persistent left column alongside the product grid |

All content sections share a single max width and horizontal padding so section edges align down the page. Cards size to content — no forced equal heights that leave dead space.

---

## 6. Screen Specifications

All product-related strings below are lorem ipsum stand-ins. They demonstrate length and hierarchy only; Shopify supplies real values at build/runtime.

### 6.1 Home

- **Hero** — light sky gradient on white, dark text. Badge: "Lorem ipsum · Available to order". H1 two-line headline with the second clause in gradient text. Sub-paragraph ≤ 2 lines. Primary CTA to a lead collection, two secondary collection CTAs, one text link to the workflow page. Four trust stats beneath with icons.
- **Shop By Category** — H2 + one-line intro, then the searchable tile grid. Each tile: image, "N lines" badge, collection name, one-line tagline, "View products" affordance.
- **Popular This Month** — 8 product cards on a sky-tinted band.
- **How it works** — eyebrow, H2, one-line intro, compact five-step row.
- **FAQ** — H2, intro, responsive disclosure grid, full-width "still unsure" CTA banner.

Placeholder set for cards:

| Field | Placeholder |
|---|---|
| Collection tag | `Lorem Ipsum` |
| Product title | `Dolor sit amet consectetur adipiscing 20W` |
| SKU line | `SKU LRM-0000` |
| Price | `£00.00` |
| Price subtext | `Available to order` — prices are VAT-inclusive and no VAT label or line appears anywhere a customer can see *(amended — §14 A2)* |
| Grade badge | `LOREM` |
| Tile tagline | `Consectetur adipiscing elit sed do.` |

### 6.2 Collection listing (`/category/:slug`)

Breadcrumb → gradient header (H1 collection name, description, "N lines · from £00.00 · all available to order" — no VAT mention, per §6.1) → facet sidebar (brand, sort, count, plus attribute facets — see §6.3) → 4-up product grid → numbered pagination. Emits `ItemList` structured data.

**Default sort order: lowest price first.** Listings open price-ascending; the buyer can switch to Price ↓, A–Z, or Featured (the collection's own curated order). Shopify exposes no relevance ranking for a collection, so "Featured" is what that option means here — relevance ranking exists only on `/search`. *(amended — §14 A3.)*

Empty state: "No products found" plus a short prompt to contact NCC — never placeholder products presented as real stock.

### 6.3 Search and facets (`/search`)

Global search bar in the header (typeahead: product and collection suggestions) leads here for full-catalogue queries. Layout mirrors collection listing: facet sidebar — brand, category, compatibility/grade, price range as the working facet set, refined once the confirmed catalogue attributes are known (Open Question 1) — with applied-filter chips and result count, 4-up product grid, pagination. Query and active facets reflected in the URL so results are shareable and crawlable. "No results" state offers facet-clearing suggestions and the same contact prompt as §6.2. Emits `ItemList` structured data with `SearchAction` on `/` per §9.

### 6.4 Product detail (`/product/:sku`)

Breadcrumb, gallery, H1 title, collection tag, SKU, price with "Available to order" — no VAT label here either, matching the cards (§6.1) — short description, spec list, quantity + add to basket, and a restatement of the no-payment-yet promise. Every customer sees the same list price, signed in or not *(amended — §14 A1)*. `Product` structured data with availability expressed as order-only. No reviews or rating UI.

### 6.5 Basket

Line list with editable quantities and remove, subtotal, an explicit panel stating delivery is confirmed later, contact fields (email, name, and an optional sales rep ID), and a single "Submit basket" action *(amended — §14 A2, A8)*. Copy must never read "Pay" or "Checkout" here. Quantity fields accept any positive integer — no minimum or maximum order quantity is enforced on any line or on the basket total. Every signed-in company buyer's basket routes to their company admin for approval before reaching NCC — an inline banner explains this on every submission, regardless of spend limit standing; only a guest basket skips this step.

### 6.6 Bulk order (`/bulk-order`)

CSV upload or paste-in SKU + quantity list → server matches against the catalogue → preview table (matched rows with price, unmatched rows flagged with reason) → "Add matched lines to basket". Never silently drops unmatched rows — each is listed with a clear reason (unknown SKU, discontinued, etc.) so the buyer can correct and re-upload. A downloadable CSV template is provided. Upload accepts up to 500 rows per file — an implementation default, not a product constraint, and easy to raise later if needed.

### 6.7 Order view and checkout

Order view shows original vs. confirmed quantity per line, removals called out plainly, delivery, and the final total. Checkout offers cash on delivery or the invoice payment link, and is unreachable before confirmation. *(amended — §14 A2. Note: whether the VAT line and the staff VAT input are removed from the order model entirely is still open — see §13 Q9.)*

### 6.8 Quote request and quote view (`/quote`, `/quote/:id`)

Request form mirrors basket layout (line list, quantities, contact/company fields) but submits as a quote, not an order — copy never implies availability or price is confirmed yet. Quote view shows status (requested → quoted → accepted/expired), NCC-provided pricing once quoted, and an "Accept quote" action that converts it into an order re-entering the standard admin review/approval step (§4) rather than skipping it — consistency over a special case. Token-gated for guests; listed under order history for signed-in company accounts.

### 6.9 Staff console

Queue sorted by submission time with status chips distinguishing "awaiting admin review" from "confirmed." Detail screen: per-line confirmed-quantity input (zero allowed), delivery and VAT inputs, live recalculated total, invoice/payment link field, internal notes, and a single "Approve" action (plus "Cancel") that confirms the order's details and finalizes it together, in one step — restricted to NCC admin accounts (§4, rule 13). Copy-to-clipboard for the customer's private link.

### 6.10 Account dashboard (`/account`)

Landing screen after company sign-in: summary cards (open orders, pending approvals if admin, pending quotes, open returns and support tickets), recent order list with a one-click "Reorder" action per row, shortcuts to `/account/orders`, `/account/users` (admin only), `/account/pricing`, `/account/returns` and `/support`.

### 6.11 Account: order history (`/account/orders`)

Order list for the company — by default, a buyer sees only their own orders, and the company admin sees every order placed under the company. Filterable by status and date, each row expandable to the same detail shown in §6.7, with "Reorder" duplicating the lines into a new basket.

### 6.12 Account: buyer users (`/account/users`)

Table of invited buyer users: name, email, role, spend limit, status (active/pending invite/removed). Admin actions: invite (email), edit role/limit, remove. Removing a user does not alter their historical orders. Spend limit is context the admin sees when approving an order (§4, rule 6) — it does not determine whether approval is required, since every buyer order requires it regardless.

### 6.13 Account: pricing (`/account/pricing`)

Read-only reference of the company's agreed tier/contract pricing, shown per collection or per SKU depending on the chosen pricing model (Open Question 3). Not editable by the account; staff-managed via §6.15.

### 6.14 Staff: quote queue (`/staff/quotes`)

Mirrors the staff order queue (§6.9): list of open quote requests sorted by submission time, detail screen for an NCC admin to price each line and issue the quote, with the same internal-notes pattern as the order console. Quote pricing is NCC-admin-only, consistent with order approval — a sales rep's view of a quote is read-only (§2).

### 6.15 Staff: company accounts (`/staff/accounts`)

Staff screen to create/edit company accounts, set contract/tier pricing (feeding §6.13), and view each company's buyer users and spend-limit configuration for support purposes. An NCC admin can edit a buyer's spend limit directly here, in addition to the company admin doing so from §6.12 — either route stays open, and an admin edit is logged the same way as any other admin action. Each company account also shows which NCC sales rep, if any, it's assigned to — assignment itself is owned by `/staff/team` (§6.22) and shown here read-only.

### 6.16 Request a return (`/returns`)

Reachable from the order view (§6.7) and account order history (§6.11), never as a cold-start form with no order context. Buyer picks the order, then the specific line(s) and quantity to return, a reason from a defined list (damaged, wrong item, no longer needed, other — final reason list and which reasons qualify for which resolution is Open Question 5), an optional note and photo upload, then submits. Copy sets expectations plainly: this is a request, not an automatic refund. Submission produces a private status link (guest) or appears immediately in `/account/returns` (company account) — same token-link pattern as the original order (§4).

### 6.17 Return status view (`/returns/:id`)

Same visual family as the order view: original request, current status (requested → under review → approved/rejected → refunded/replacement sent), staff-visible reasoning if rejected, and — once approved — what happens next (refund method and timing, or replacement dispatch) stated plainly rather than left for the customer to infer.

### 6.18 Raise a support/complaint ticket (`/support`)

Distinct from `/contact` (§3): `/contact` is for pre-purchase questions answered by the FAQ/enquiry pattern; `/support` is for something that's gone wrong with an existing order, account, or the site itself, and always produces a trackable ticket rather than a fire-and-forget email. Form: category (order issue, account issue, site issue, other), optional order/return reference, message, optional attachment. Available to guests (token-gated status link) and signed-in company accounts (appears in their account area).

### 6.19 Support ticket status view (`/support/:id`)

Timeline view: original message, staff replies, current status (open, awaiting NCC, awaiting customer, resolved, escalated), and a reply box so the thread continues on the same page rather than over email. Mirrors the return status view (§6.17) closely enough that a customer who has used one instinctively understands the other.

### 6.20 Staff: return/RMA queue (`/staff/returns`)

Mirrors the staff order queue (§6.9): queue sorted by submission time with status chips, detail screen to approve/reject with a reason, and select refund vs. replacement. The return's status in this application is authoritative, and the refund or replacement itself is actioned by NCC outside the app. Returns raised here have no Shopify-side `Return` object to approve, so no Shopify return mutation is called *(amended — §14 A5; see DECISIONS.md ADR-034 for the evidence)*.

### 6.21 Staff: support/complaints queue (`/staff/support`)

Mirrors the staff return queue: ticket list sorted by submission time and status, detail/reply screen, internal notes, escalation action. Escalation rules and SLA targets are Open Question 6.

### 6.22 Staff: team management (`/staff/team`, NCC admin only)

Table of internal NCC accounts: name, email, username, role (NCC admin / sales rep), for sales reps their assigned company accounts and ID number status, active/removed. "Add account" flow: email, username, role; for a sales rep, an ID number field is required before the account can be activated — the form blocks submission without it and shows the verification result inline rather than silently accepting an empty or malformed value (§7.2). This screen owns assigning/reassigning a sales rep's book of company accounts (shown read-only on `/staff/accounts`, §6.15). This is an internal tool: no customer-facing equivalent, and out of reach of both company admins and buyer users.

### 6.23 How ordering works (`/how-to-order`)

*(added — §14 A4. The route was listed in §3 from v3.0 but never given a screen spec, while the header, footer and homepage all linked to it.)*

Public explainer for the confirm-then-pay model, written so a first-time buyer understands why nothing is charged at basket submission. H1 "How ordering works", a lead paragraph stating the full total including delivery is agreed before any money changes hands, then the five-step flow reused from the **OrderSteps** component (§5.2) rather than restated — so this page and the homepage can never drift apart. Two explainer panels follow:

- **Buying on a company account** — states plainly that a company buyer's basket goes to their own company admin for approval before NCC sees it, on every order regardless of value, and that a guest basket skips only that step (§4, rule 6). Without this, a company buyer meets an approval gate the site never warned them about.
- **What "available to order" means** — no live inventory is published; the fulfillable quantity is confirmed at NCC review, lines may be reduced or removed, and quantities are never silently increased (§4, rules 2 and 15).

Closes with "Start your basket" and "Upload a bulk order" actions. Copy states no policy that is still open in §13 — no return window, SLA, or payment-timing promise beyond what §4 already fixes.

---

## 7. Architecture — Shopify and the Application Backend

This build uses Shopify itself for everything it natively does well, and a lean custom application backend for the handful of things it doesn't. This is the adopted working architecture — see §13 if the business later wants to revisit it; nothing in §1–§6 changes either way, since those sections specify product behaviour, not implementation.

### 7.1 What Shopify owns

Shopify's B2B feature set — available on every plan, with the exceptions noted — is the system of record for:

- **Catalogue.** Products, collections, images, pricing and variants, via the Storefront API.
- **Companies and buyers.** Company accounts, company locations, and multiple buyer contacts per company map directly to Shopify's native B2B "Companies" objects — this is §2's company admin/buyer model, not a custom schema.
- **Contract/tier pricing.** Company- or catalogue-specific price lists. Capped at 3 active price lists on standard plans, unlimited on Plus — the number of companies needing distinct pricing (Open Question 2) determines whether Plus is required.
- **The confirm-then-invoice flow.** Shopify Draft Orders, built and edited by NCC after admin approval, with `draftOrderInvoiceSend` emailing the customer a secure payment link — no card is ever captured before that point. A close native fit for rule 1 and rule 13.
- **Reorder and bulk order.** Native quick-order lists and reorder-from-history cover most of §6.6 and §6.11 out of the box.
- **Returns**, once an order has gone through Shopify as above: Shopify's native self-serve returns feature (free, all plans) covers request → NCC approve/reject → refund, store credit, or exchange. It requires Shopify's new customer accounts (not legacy accounts, which Shopify has been sunsetting) — a company buyer who wants self-service returns needs a Shopify-backed account, not just an app-side login.
- Deposits/partial payments, per-fulfillment payment requests, checkout extensibility (Shopify Functions), and a dedicated B2B storefront are Plus-only and not required for anything specified in this document.

### 7.2 What the custom application backend owns

Shopify has no native concept of the following, so they're built and owned by the application backend, with row-level security so a company can read only its own data and a sales rep only their assigned companies':

- **The two-stage approval workflow** (rule 6 + rule 13): company admin pre-approval, then NCC admin review-and-approve. Shopify's own spend limits only block a buyer at checkout past a threshold — they don't route every order through two separate approval steps regardless of amount.
- **NCC admin and sales rep accounts**, including email-or-username sign-in and the ID-verification gate on sales rep creation (§6.22). This sits entirely outside Shopify, since NCC's staff console is a separate application, not the Shopify Admin.
- **Quotes** (§6.8, §6.14). Shopify has no native quote object; an NCC admin prices and issues quotes, which become Draft Orders on acceptance.
- **Support/complaint tickets** (§6.18–6.21). Shopify has no native equivalent at all. Built here rather than in a third-party helpdesk app for the initial release (§8), so ticket data lives alongside orders and returns in one place from day one.

### 7.3 Frontend and delivery target

The frontend is a headless TanStack Start application, calling Shopify's Storefront, Customer and Admin APIs as above, with its own thin backend for the items in §7.2. Earlier drafts of this document left open whether "not excluding a Shopify theme deployment" should mean building a second, native Shopify theme alongside the headless app — **resolved for this build: no.** The headless application described throughout §3–§6 is the only build target; a Shopify theme is not being built now and isn't precluded later if ever requested.

**Live hosting, as actually deployed** *(amended — §14 A11)*: the application runs on **Vercel** at **https://headlessncc.vercel.app**, with the application database on **Turso** (hosted libSQL, `DATABASE_URL`/`DATABASE_AUTH_TOKEN`). Getting it to boot on Vercel required a series of changes made by a second contributor NCC brought in for deployment — see §14 A11 for what those changed and what they cost. The most consequential: **catalogue content is now fetched by the browser from a `GET /api/catalogue` endpoint rather than server-rendered**, which has a direct SEO consequence recorded in §9.

### 7.4 Buyer identity across Shopify and the application

A guest buyer's identity is entirely app-owned (a token-gated link, rule 5) and never touches Shopify's own accounts. A company buyer who wants self-service features that are Shopify-native (reorder, native returns) signs in with Shopify's own customer-account flow (a passwordless email code, in Shopify's current design) rather than a separate app-owned password. This means the application backend does not need to build its own buyer authentication system — only the NCC-internal admin/sales-rep authentication in §7.2 is custom.

### 7.5 Search at catalogue scale

Shopify's free Search & Discovery app is the day-one default (§6.3) — it covers standard filtering/faceting into the low thousands of SKUs, and no third-party search app is needed to start. If the confirmed catalogue size (Open Question 1) ends up large enough that facet complexity or response time becomes a problem, Algolia, Klevu or Boost AI Search & Discovery are the names that come up most often for Shopify specifically — an upgrade to revisit later, not a blocker now.

### 7.6 ERP, PIM and accounting

Not part of this build unless Open Question 4 identifies a specific system NCC already runs. Shopify's own metafields/metaobjects cover product attributes beyond its default fields for now.

---

## 8. Third-Party Services

Nothing in this table is required to start the build — §7 specifies a day-one path using only Shopify's native features plus the custom backend in §7.2. This exists so the team knows where to look if a native or custom feature turns out to be insufficient in practice; none of the named vendors are a recommendation to purchase, just the names that recur most often in current comparisons for each category.

| Need | Day-one approach | Upgrade path if ever needed | Applies to |
|---|---|---|---|
| Large-catalogue search | Shopify Search & Discovery (free, native) | Algolia, Klevu, or Boost AI Search & Discovery | §6.3, §7.5 |
| Returns/RMA | Shopify's native self-serve returns | Loop Returns, Return Prime, or AfterShip Returns for deeper RMA logistics | §6.16–6.17 |
| Support/complaints ticketing | Custom-built (§6.18–6.21) | A helpdesk platform (Gorgias, Zendesk, Re:amaze) if ticket volume outgrows the custom build | §6.18–6.21 |
| ERP / accounting sync | None in this build | NetSuite, Cin7, Katana, or the company's existing accounting package, once Open Question 4 is answered | §7.6 |
| PIM | Shopify metafields/metaobjects | Akeneo or Plytix, if product data outgrows Shopify's own fields | §7.6 |
| Formal ID/KYC verification for sales reps | None — internal employee ID with format/uniqueness check | Persona, Onfido, or Trulioo, only if a real identity check turns out to be required | §6.22, §13 |

---

## 9. SEO and AEO

- Unique title (< 60 chars) and description (< 160 chars) per route, plus Open Graph and Twitter card metadata.
- One H1 per page; semantic sectioning; descriptive alt text on every image.
- Structured data: `Organization` and `FAQPage` on home, `ItemList` on collections and search results, `Product` on detail pages, `BreadcrumbList` throughout.
- ⚠️ **Not currently true of the live site** *(amended — §14 A11)*: because catalogue data moved to a client-side fetch to get Vercel working, the HTML served to a crawler contains no products, no prices and no `ItemList` — verified 18 September 2026 against `https://headlessncc.vercel.app/category/wall-chargers` (11 KB of shell, zero product links). Customers see the catalogue normally; search engines do not. This must be resolved before the SEO goals in §1.1 (G4) mean anything.
- AEO: FAQ copy written as complete question-and-answer pairs covering stock policy, payment timing, order amendments, invoicing, VAT, company account setup, bulk ordering, the quote process, returns, and support — the questions an answer engine is most likely to be asked about this business.
- Lazy-loaded imagery, explicit width/height to avoid layout shift, canonical tags, responsive viewport.
- Faceted `/search` and `/category/:slug` URLs use canonical tags back to the unfiltered collection to avoid duplicate-content dilution at large catalogue scale — filter combinations are not each indexed as a separate page. `noindex` on empty-result facet combinations.
- Account, basket, checkout, quote and staff routes are `noindex` — only public catalogue and content pages are indexable. Return and support status routes (`/returns/:id`, `/support/:id` and their staff counterparts) are `noindex` for the same reason; the request forms themselves (`/returns`, `/support`) stay indexable as a legitimate AEO surface.

---

## 10. Accessibility

WCAG 2.2 AA throughout. Visible focus rings on every interactive element, labelled form controls and filters, `aria-current` on pagination, disclosure semantics for FAQ, contrast checked for muted grey on white and for white text on the sky gradient, and full keyboard operability of the basket and staff console. This standard extends to the facet sidebar (checkbox groups properly labelled and grouped, applied-filter chips individually removable by keyboard), the CSV upload widget (accessible file input plus a text-paste alternative, not drag-and-drop only), the account/approval screens (buyer table, approval actions, spend-limit inputs all keyboard-operable with clear status announced to assistive tech on approve/reject), and the return/support forms — status timeline entries (§6.17, §6.19) are announced to assistive tech as they update, not conveyed by colour/icon alone, and file/photo attachment controls have an accessible name and a non-drag-and-drop alternative.

---

## 11. Acceptance Criteria

1. No screen displays live stock numbers or a delivery-date promise.
1a. No customer-facing screen displays a VAT label, a VAT line, or the words "ex VAT" — displayed prices are VAT-inclusive. *(added — §14 A2.)*
1b. Category listings open sorted lowest-price-first, and every sort option actually reaches Shopify rather than being cosmetic. *(added — §14 A3.)*
2. No payment surface is reachable before an order reaches `confirmed`.
3. Every product string on screen resolves from the data adapter, never a component literal.
4. All collections render with correct counts, filters, sorting and pagination at catalogue scale.
5. Colour appears only via semantic tokens; no hard-coded colour utilities.
6. Layouts pass at 375px, 768px, 1024px and 1440px with aligned section widths.
7. Each route ships unique metadata; structured data validates.
8. Zero review, rating or testimonial content anywhere in the product.
9. Staff routes are inaccessible without an authenticated, approved role.
10. No company buyer's basket reaches NCC review without recorded company-admin approval — for every submission, not only those exceeding a spend limit.
11. A company buyer cannot see or use spend limits or order data belonging to a different company, under any UI or API path. *(amended — §14 A1: pricing is uniform, so there is no company-specific price to leak; tenant isolation of orders, users and spend limits is unchanged and still enforced.)*
12. Facet/search URLs never produce indexable duplicate-content pages, and a facet combination with no results never presents placeholder products as real stock.
13. A quote never auto-becomes a paid order; customer acceptance is a distinct, explicit step.
14. Bulk-order upload never silently drops an unmatched row — every row is either added or explained.
15. A return cannot be requested without referencing an existing confirmed order and line.
16. Every support ticket and return request has a status view the customer can return to — none resolves only through an email exchange with no in-product record.
17. New flows (returns, support, bulk-order, quotes, approvals) use the existing component library and state patterns from §5.
18. An NCC admin or sales rep can sign in with either their email or their username — both resolve to the same account.
19. A sales rep account cannot be created or activated without an ID number on file.
20. A sales rep's access is scoped to their assigned company accounts only.
21. Company (buyer) sign-in remains email-only; no username field on that side.
22. Quantity fields on the basket, bulk-order upload and quote request never reject or clamp a value for being "too low" or "too high" — any positive integer is accepted.
23. No order reaches `confirmed`, and no checkout link is reachable, without a single NCC admin approve action — there is no route that skips it.
24. The current live website is unaffected by this build — it ships as a new deployment, not an edit in place.

---

## 12. Out of Scope

- Multi-currency, saved payment methods, real-time live chat, and loyalty pricing outside agreed contract tiers.
- A native Shopify theme deployment of this design (§7.3) — the headless application is the only build target for now.
- Deliberately deferred to a later phase, not this build: PunchOut/cXML integration for enterprise buyers' own procurement systems; multi-warehouse delivery selection at basket level; self-service export of order history (CSV/PDF); any SSO between the application and Shopify accounts beyond the native flow already in §7.4.

---

## 13. Open Questions — Confirm Before or During Build

Everything else in this document — every screen, rule, route and component — is specified and ready to build against as written. These are the only items that need real input from the business; each has an adopted default stated elsewhere in this document so the build isn't blocked while they're outstanding.

**Resolved during build** (kept here, struck through, so the original question and its answer stay traceable — full reasoning in `DECISIONS.md`):

1. ~~**Target catalogue size**~~ ✅ **Answered in part:** the live store holds **321 SKUs across 12 collections** at time of writing. Expected growth is still unstated, which is what §7.5 actually depends on.
2. ~~**Number of companies needing distinct contract pricing**~~ ✅ **Resolved: none.** Uniform list pricing for every customer, so the price-list cap is moot (ADR-005, §14 A1).
3. ~~**Contract/tier pricing model**~~ ✅ **Resolved: not used** (ADR-005, §14 A1).
7. ~~**Sales rep ID verification depth**~~ ✅ **Resolved:** internal employee ID checked for format and uniqueness, plus first successful login as the activation trigger (ADR-007).
8. ~~**Shopify plan tier**~~ ✅ **Resolved: Basic is sufficient.** ADR-006 removed the dependency on Shopify's B2B "Companies" objects, so the Plus-only restriction no longer applies.

**Still open:**
4. **ERP, PIM or accounting system(s), if any, that this build should integrate with** — default is none; §7.6 assumes Shopify's own fields and the application database are sufficient until told otherwise.
5. **Return window and refund-vs-replacement policy per reason** — needed to configure Shopify's native return rules (§7.1) and the return request reason list (§6.16).
6. **Support SLA targets and escalation rules** — needed to configure the support queue's escalation action (§6.21); no default assumed.
9. ~~**Does VAT leave the order model entirely?**~~ ✅ **Resolved 18 September 2026: yes.** NCC confirmed prices are VAT-inclusive, so VAT is no longer collected at approval, stored on new approvals, or shown anywhere. Final total is subtotal + delivery. The `vat_pence` column remains in the schema, unused. Original question retained below for context.
   *Original:* *(new — §14 A2.)* All customer-facing VAT wording is gone and prices are VAT-inclusive, but the confirmed-order breakdown still carries a `VAT` money line fed by an amount the NCC admin types during approval (§6.9). If prices already include VAT, that line double-counts and the input should probably go. Removing it changes order totals arithmetic, not just copy, so it is deliberately unresolved rather than assumed. NCC's invoicing/accounting obligations sit outside this application and should drive the answer.
10. ~~**Screens subcategories — tag mapping.**~~ ✅ **Resolved 18 September 2026:** "Advance" meant the `Colorx LCD` tag, and NCC asked for the category to be labelled **Colorx LCD**. All three collections are created (§14 A6). Two things remain open, both narrower than the original question:
    - **Publish them?** They are unpublished, so customers can't see them. Publishing adds three *top-level* categories beside Screens, because the app has no subcategory nesting — that nesting is unspecified application work.
    - **The 17 `LCD Screen` products** (all unpriced drafts) sit in Screens under no subcategory. No decision taken.

---

## 14. Amendment Log

Every change made to this document since **v3.0 (11 September 2026)**, the version written before any code existed. The purpose of this log is traceability: for each amendment it records what v3.0 originally specified, what the product actually became, why it changed, and who decided. Nothing here is a silent edit — every amended passage in §§1–13 carries an `(amended — §14 A#)` marker pointing back to its entry.

**How to read this:** "Originally specified" is verbatim v3.0 wording. "As built" is the product as it actually is. "Authority" is who made the call — a business decision from NCC, or a technical finding that forced the change.

---

### A1 — Contract and tier pricing removed; pricing is uniform

- **Originally specified (v3.0):** §2 — buyers sign in "for reorder history, contract pricing, and multi-user buying." §4 rule 7 — "Contract/tier pricing is resolved server-side from the signed-in company account, never trusted from client state, and never shown to a user not entitled to it." §6.4 — "Where a company account is signed in, price reflects their contract/tier pricing instead of list price." Plus §6.13, §6.15 and acceptance criterion 11, all of which assumed per-company pricing existed.
- **As built:** every customer sees the same uniform list price, signed in or not. No contract or tier pricing is configured anywhere. `/account/pricing` exists but states plainly that no separate agreement applies. `/staff/accounts` has no pricing administration.
- **Why:** NCC confirmed no company requires distinct pricing, which also removed the Shopify price-list cap as a constraint and, via ADR-006, the dependency on Shopify B2B objects that would have forced a Plus plan.
- **Authority:** NCC business decision, 12 September 2026. See `DECISIONS.md` ADR-005.
- **Still true:** server-side price resolution and cross-tenant isolation of orders, users and spend limits are unchanged and still enforced — there is simply no per-company price left to leak.

### A2 — VAT is never shown to customers; prices are VAT-inclusive

- **Originally specified (v3.0):** §4 rule 3 — "Delivery and VAT are always shown before any payment is requested." §2 — buyers want "ex-VAT trade pricing." §6.1 — "VAT is shown for the first time on the order request and again on the invoice, only after NCC admin approval." §6.5 — "ex-VAT subtotal, an explicit panel stating delivery and VAT are confirmed later." §6.7 — order view shows "delivery, VAT, and the final total." §4 rule 13 — approval confirms "quantities, delivery and VAT."
- **As built:** displayed prices are VAT-inclusive. No VAT label, VAT line or "ex VAT" wording appears on any customer-facing surface — removed from the announcement bar, footer, product cards, product pages, basket, order view, order-submitted, account pricing, FAQ, order steps, homepage and `/how-to-order`. Subtotals read "Subtotal", not "Subtotal (ex VAT)".
- **Why:** NCC stated the prices held in Shopify already include VAT, and that VAT should not be mentioned to customers anywhere.
- **Authority:** NCC business decision, 17 September 2026.
- **Not yet resolved:** the confirmed-order breakdown still contains a `VAT` money line fed by the staff VAT input on `/staff/order/:id`. If prices are genuinely VAT-inclusive this double-counts, but removing it changes totals arithmetic rather than copy, so it was left in place pending a decision — tracked as §13 Q9.
- **Note for whoever revisits this:** this amendment directly reverses a v3.0 rule that existed for a reason (price transparency before payment). The transparency intent is preserved — the customer still agrees a final total including delivery before anything is payable — but anyone reinstating VAT display should read this entry first rather than assuming rule 3 was simply forgotten.

### A3 — Listings default to lowest price first, and sorting actually works

- **Originally specified (v3.0):** §6.2 specified a facet sidebar with a sort control but named no default ordering. §6.3's sort options were assumed to apply equally to collections and search.
- **As built:** category listings open **price-ascending**. The options are Price ↑ (default), Price ↓, A–Z, and Featured. "Relevance" was renamed "Featured" on category pages because Shopify's `ProductCollectionSortKeys` has no relevance member — relevance ranking exists only on `/search` — so the option maps to the collection's own curated order (`COLLECTION_DEFAULT`).
- **Why:** NCC asked for cheapest-first listings, on the basis that trade buyers compare on price.
- **Authority:** NCC business decision, 17 September 2026.
- **Defect found while implementing this:** `getCollectionLive` never passed a sort key to Shopify at all, so **every sort option on every category page had been cosmetic** — the buttons changed the URL and re-rendered, but Shopify returned the same collection-default order regardless. Search was unaffected; only collections were broken. Fixed as part of this amendment and verified against the live Screens collection (prices returned ascending from £9.00). Acceptance criterion 1b was added so this cannot regress unnoticed.

### A4 — `/how-to-order` given a screen specification

- **Originally specified (v3.0):** §3 listed the route as "Ordering workflow explainer." No §6 screen spec was ever written for it.
- **As built:** specified as §6.23 and implemented. Reuses the existing `OrderSteps` component rather than restating the flow, and adds two explainer panels — company-account approval, and what "available to order" means.
- **Why:** the route was linked from the header, the footer and the homepage (twice) but did not exist, so all of those were dead links returning 404.
- **Authority:** gap closed during build, 17 September 2026.
- **Worth recording:** the visual reference site's own copy for this page contradicted this PRD in three ways — it claimed goods ship only "once payment clears" (§4 allows cash on delivery), omitted company-admin approval entirely (§4 rule 6 makes it unconditional), and split NCC review into two steps (§4 rule 13 makes it one atomic action). The reference was followed for layout only; all copy derives from §4. This is the reference site being a visual aid, not a source of business rules, working exactly as intended.

### A5 — Returns are app-authoritative; no Shopify return mutation is called

- **Originally specified (v3.0):** §6.20 — "Refunds run through Shopify's native refund mechanism, since orders live in Shopify as Draft Orders/Orders once confirmed (§7.1) — no separate payment-provider integration is needed for this."
- **As built:** the return's status in this application is authoritative; the refund or replacement is actioned by NCC outside the app. No Shopify return mutation is attempted.
- **Why:** Shopify's `returnApproveRequest` approves an *existing* Shopify `Return` object, created by Shopify's own native return flow. A return raised through this application has no such object, so the call can never succeed. This was confirmed empirically against the live store, not inferred — the mutation returned a real error rejecting the app's own UUID as an invalid Shopify global ID.
- **Authority:** technical finding, forced. See `DECISIONS.md` ADR-034.
- **Open architecture question:** whether NCC wants a real Shopify-side `Return` created at request time (so refunds reconcile inside Shopify) is a business decision nobody has taken. Until then this is a deliberate limitation, not an oversight.

### A6 — Screens subcategories requested (not yet built)

- **Originally specified (v3.0):** no subcategory concept exists anywhere in the document; §3 and §6.2 assume a flat collection list.
- **Requested:** three subcategories under Screens. Originally named **Advance**, **Prime LCD**, **Soft OLED**; NCC then confirmed "Advance" meant the `Colorx LCD` tag and asked for it to be **labelled "Colorx LCD"** instead, to remove the ambiguity.
- **Status:** **created in Shopify, not yet visible to customers** (18 September 2026).
- **As created** — three smart collections, each on a single tag rule, sorted price-ascending to match §6.2's default:

  | Collection | Tag rule | Products |
  |---|---|---|
  | Colorx LCD (`colorx-lcd`) | `Colorx LCD` | 33 |
  | Prime LCD (`prime-lcd`) | `NCC prime` | 35 |
  | Soft OLED (`soft-oled`) | `NCC SOFT OLED` | 22 |

- **Deliberately unpublished:** none is published to any sales channel, so the Storefront API does not return them and nothing changed for customers. Publishing is a separate, explicit step.
- **The leftover 17:** Screens holds 107 products; these three account for 90. The remaining 17 carry the `LCD Screen` tag, are all drafts tagged `needs-price`, and belong to no subcategory. They stay in Screens. NCC has not said whether they need a fourth grouping.
- **Known gap when these are published:** the application has no concept of a subcategory. It renders whatever collections the catalogue adapter returns (§7.1, CLAUDE.md rule 20), so publishing these adds three more **top-level** categories beside Screens rather than nesting them beneath it. Making them true subcategories is application work that has not been specified or built.

### A7 — Quantity can be chosen straight from a product card

- **Originally specified (v3.0):** §5.2 ProductCard — "add control with confirm state." No quantity input; the card added one unit per click. A quantity field existed only on the product detail page (§6.4).
- **As built:** every product card carries a number input (default 1, any positive integer, no maximum), and "Add" adds that quantity.
- **Why:** NCC asked that buyers be able to set the quantity when adding, rather than clicking repeatedly or opening each product. Consistent with §4 rule 12 (no min/max quantity).
- **Authority:** NCC business decision, 17 September 2026.
- **Verified:** set a card to 4 and added it — the basket line showed quantity 4 at £9.00 each, £36.00.

### A8 — Optional sales rep ID on the basket

- **Originally specified (v3.0):** §6.5 — basket submission has "contact fields." Sales rep referral was captured on `/bulk-order`, `/quote` and `/register`, but not on the basket.
- **As built:** guest basket submission shows Email, Name, and **Sales rep ID (optional)**. The ID is stored on the basket and copied onto the order request on submit, so it appears as "Referred by sales rep" on the order view and in the staff console.
- **Why:** NCC asked for it. The data model already supported it (`referringSalesRepId` on baskets and order requests); only the basket form was missing it, making the basket the one ordering path where a referral couldn't be recorded.
- **Authority:** NCC business decision, 17 September 2026.
- **Scope note:** shown to guests only. A signed-in company buyer's referring rep is recorded once, at company registration.
- **Caveat worth knowing:** the ID is self-reported free text. It is *not* checked against real sales rep accounts, so a mistyped or invented ID is stored as-is. Treat it as a referral hint, not a verified attribution.

### A9 — Header category strip: arrows instead of a scrollbar

- **Originally specified (v3.0):** not specified. The implementation used a plain overflowing row, which showed the browser's native horizontal scrollbar.
- **As built:** the native scrollbar is hidden and replaced by left/right arrow buttons that appear only when there is more to scroll that way (none at all on a screen wide enough to show every category).
- **Why:** NCC asked for the sliding bar to be removed in favour of a proper horizontal-scroll control.
- **Authority:** NCC business decision, 17 September 2026.
- **Accessibility:** hiding the scrollbar removes no way of scrolling. Wheel, trackpad, touch and keyboard (tabbing through the links) all still work; the arrows are a convenience duplicating that, so they are hidden from screen readers.

### A10 — Homepage category tiles: three per row on desktop

- **Originally specified (v3.0):** §5.2 CategoryGrid — tile layout not fixed. The implementation showed five per row on desktop.
- **As built:** homepage tiles are 1 / 2 / 3 per row at mobile / tablet / desktop (verified at 375px, 768px and 1457px; desktop tiles are ~403px wide).
- **Why:** NCC wanted larger tiles.
- **Authority:** NCC business decision, 17 September 2026.
- **Scope note:** homepage only. `/categories` still shows five per row. Say if that should match.

### A11 — Deployed to Vercel + Turso by a second contributor; catalogue moved client-side

- **Originally specified (v3.0):** §7.3 named the delivery target only as "a headless TanStack Start application" — no host, no database host, and an assumption throughout §9 that pages are server-rendered with structured data.
- **As deployed:** live on **Vercel** at **https://headlessncc.vercel.app**, application database on **Turso**. NCC brought in a second contributor specifically to get the deployment working after repeated failures; `main` carries roughly twelve of their commits, all deployment fixes — Node runtime selection, keeping the native libSQL driver out of the Linux bundle, Turso client hardening, `NODE_ENV=Preview` handling, Shopify store-domain normalisation, and a new `GET /api/catalogue` endpoint.
- **Why:** the app would not boot on Vercel otherwise (homepage 500s).
- **Authority:** NCC engaged the contributor directly; these are technical fixes, not product decisions.
- **The cost, recorded plainly:** catalogue data is now fetched by the browser instead of rendered on the server. The served HTML has no products, prices or `ItemList` structured data — see §9. This trades away the SEO position §1.1 G4 and §9 were written to win. It is a deployment workaround, not a product decision, and should be revisited rather than accepted as the design.
- **Also added:** `bootstrapFirstNccAdmin` (`server/staff/bootstrap-admin.ts`) — a one-shot way to create the first NCC admin when the staff table has none, since the seed script isn't run against the production database. Subsequent accounts still go through `/staff/team` (§6.22).

### A12 — Live checkout flow: verified working up to approval, blocked after it

Verified against the live site on 18 September 2026 by placing a real guest order (labelled "TEST ORDER - checkout flow check", order `631e9a2e…`, £2.00).

**Confirmed working:** browse → product → add to basket → submit basket with no payment → order created → private token link issued → status page shows "Awaiting NCC Review". `/checkout/:id` correctly refuses to open before approval (307 back to the order view — §4 rule 4 holds). An invalid or missing token returns the generic "We Couldn't Find That Order" page and leaks no order data (§4 rule 5 holds).

**Blocked:** the flow cannot be completed past that point.
1. **No Shopify Draft Order or Order has ever been created** — the store contains zero of each. The confirm → Draft Order → payment-link path in §6.7/§7.1 has never produced anything in production.
2. **The Admin API token was rejected (HTTP 401)** when tested directly against the store, which is consistent with (1).
3. **Approval could not be exercised at all** — the seeded fixture staff accounts do not exist in the live database, and no live staff credentials were available to the build session.

**Net effect:** no customer can currently reach a payment surface on the live site. Everything up to NCC review works; nothing after it has been shown to.

### A13 — Published to production; incomplete listings hidden

**Published (18 September 2026).** PR #1 merged to `main`, which Vercel deploys. Everything in A1–A10 and A12 is now live at https://headlessncc.vercel.app — `/how-to-order` resolves, no "ex VAT" string remains anywhere on the site, listings sort cheapest-first, and VAT is gone from the order model.

**Catalogue rule applied, at NCC's instruction:** *a listing with no image or no price is not shown on the live site.*

- 41 active products had **no image**. All were switched ACTIVE → DRAFT, so the storefront no longer returns them.
- **0** active products lacked a price — the unpriced lines (121 of them) were already drafts and already hidden.
- Nothing was deleted. Adding an image and setting the product back to Active restores it.
- A record of the 41 is on the user's Desktop as `NCC-Hidden-Listings-2026-09-18.xlsx` (no password).

**Live catalogue after the change — 159 products:**

| Category | Live lines | | Category | Live lines |
|---|---|---|---|---|
| Screens | 68 | | Car Chargers | **0** |
| Batteries | 35 | | Screen Protectors | **0** |
| Charging Cables | 24 | | Wireless Chargers | **0** |
| Chargers | 13 | | iPad Digitizers | 0 |
| Power Banks | 10 | | Car Holders | 0 |
| Headphones & Earphones | 9 | | Repair Parts | 0 |

**Consequence worth stating:** **Car Chargers, Screen Protectors and Wireless Chargers are now empty categories** — every product in them lacked an image. They still appear in navigation with zero lines. iPad Digitizers, Car Holders and Repair Parts were already empty before this change. Restoring any of them is a matter of adding product images in Shopify, not a code change.

---

**Amendments still to be reflected here:** none outstanding at 18 September 2026. When the product next diverges from this document, add an entry rather than editing §§1–13 silently.
