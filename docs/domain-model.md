# NCC Supply — Domain Model

Entities required by the PRD, each tagged with its owning system. "Shopify" means the data lives in Shopify and is read/written via Storefront, Customer Account, or Admin API. "App DB" means it has no Shopify equivalent and is owned by the custom backend (PRD §7.2). Status transitions are drawn from PRD §4's numbered rules and the relevant §6 screen specs.

---

## Company
**Owner:** App DB entirely (revised 2026-09-12, DECISIONS.md ADR-006 — no Shopify B2B "Companies" object; the only reason to use it was contract pricing, which this build doesn't have).
Fields of interest: name, locations (free-text, not a Shopify B2B location object), assigned NCC sales rep (§6.15/§6.22).
No status machine of its own; existence + active buyers define it. Pricing shown to every buyer is the same standard list price (DECISIONS.md ADR-005) — a company record carries no price-list reference.

## Buyer (company buyer user)
**Owner:** Shopify **plain new customer account** (identity only — email/passwordless sign-in, no B2B company link) + **App DB** for company membership, role, spend limit, active/pending-invite/removed status (§6.12).
**Status:** `invited` → `active` → `removed`. Removing a user does not alter their historical orders (§6.12).

## Company admin
**Owner:** Same buyer entity, distinguished by role = admin. A company may have more than one admin (§2).

## Staff user (NCC admin / sales rep)
**Owner:** App DB entirely (§7.2) — outside Shopify Admin.
Fields: name, email, username (sign-in accepts either, §2/§6.22), role (`ncc_admin` | `sales_rep`), for sales reps: employee ID (required before activation) and assigned company book.
**Status:** `pending_id_verification` (sales rep only, blocks activation) → `active` → `deactivated`. Per DECISIONS.md ADR-007, the `pending_id_verification` → `active` transition fires automatically on the sales rep's first successful email-based sign-in (proof of email ownership), once the admin has already put a valid, unique employee ID on file — not a separate manual admin action.

## Sales rep assignment
**Owner:** App DB. Many-to-many staff↔company, owned/edited only from `/staff/team` (§6.22), shown read-only on `/staff/accounts` (§6.15).

## Basket
**Owner:** App DB (guest) or App DB keyed to Shopify customer (company buyer) — never a Shopify cart/checkout object, since no payment happens here.
Fields: lines (product/variant ref, quantity — any positive integer, no min/max per §4 rule 12), contact details.
**Status:** `open` → `submitted` (terminal for the basket; becomes an Order Request).

## Order request
**Owner:** App DB, with a Shopify Draft Order reference attached once one exists.
**Status machine** (§4 flow diagram + rules 6, 13, 15):
```
draft (basket) 
  → awaiting_company_approval   [company buyer only, unconditional — rule 6]
  → awaiting_ncc_review          [guest: direct; company: after admin approval]
  → confirmed                    [single atomic NCC-admin action — rule 13]
  → cancelled                    [alternative terminal state, with reason]
```
Quantities may only be reduced/removed between `awaiting_ncc_review` and `confirmed`, never increased (rule 2/15). `confirmed` is the only state from which `/checkout/:id` is reachable (rule 4).

## Approval (company-side)
**Owner:** App DB. One record per order request that required it. Fields: approver (company admin), decision, timestamp. Spend limit is informational context only, never a gate (§6.12).

## Approval (NCC-side)
**Owner:** App DB, atomically written together with the order request's `confirmed` transition (rule 13/14): confirmed quantities per line, delivery, VAT, final total, invoice-link field, internal notes.

## Shopify Draft Order / Order reference
**Owner:** Shopify. Created/updated only after NCC approval (§7.1). The app DB order request stores the Shopify Draft Order ID/Order ID as a reference, not a duplicate of its data — Shopify remains system of record for the financial document itself.

## Quote
**Owner:** App DB (no native Shopify quote object, §7.2) → becomes a Shopify Draft Order only on acceptance, re-entering the standard order-request flow at `awaiting_ncc_review` (§6.8, never skipping approval).
**Status:** `requested` → `quoted` → `accepted` | `expired`.

## Return
**Owner:** App DB for the request/status record; Shopify native return/refund mechanism once actioned (§7.1, requires Shopify new customer accounts for self-serve on the company-account path).
Must reference an existing `confirmed` order and specific line(s) — never a cold-start return (rule 9, §6.16).
**Status:** `requested` → `under_review` → `approved` | `rejected` → (`refunded` | `replacement_sent`, if approved).

## Support ticket
**Owner:** App DB entirely (§7.2, no Shopify equivalent).
Fields: category, optional order/return reference, message thread, optional attachment (private storage, expiring authorized access).
**Status:** `open` → `awaiting_ncc` ⇄ `awaiting_customer` → `resolved` | `escalated`.

## Token
**Owner:** App DB. Strong, unguessable, hashed at rest (raw token never stored), expiring or revocable, scoped to exactly one of: order, quote, return, support ticket (rule 16). Enumeration-resistant lookup.

## Audit event
**Owner:** App DB, immutable/append-only. Written for: every approval (company- and NCC-side), every status change on order/quote/return/support, every pricing change, every staff account/role/assignment change (rule 17/24's evidentiary trail; §6.15's "either route stays open, both logged the same way").

---

## Cross-cutting rule

No entity's status transition is valid without the actor holding the matching role for that transition (CLAUDE.md rule 17). This is enforced in the App DB's authorization helpers (Phase 2), not left to UI-level gating.
