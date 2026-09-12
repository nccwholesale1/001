# NCC Supply — Route × Role Permissions Matrix

Roles: **Guest** (no account), **Buyer** (company buyer user), **Company Admin**, **Sales Rep** (NCC internal, read-only, scoped to assigned companies), **NCC Admin** (NCC internal, full).

Legend: **Full** = normal read/write for that role's own scope · **Read-only** · **Own data only** = scoped to the signed-in company/assignment · **Token-gated** = reachable only with a valid token for that specific resource · **—** = not reachable, must not be linked or guessable.

| Route | Guest | Buyer | Company Admin | Sales Rep | NCC Admin |
|---|---|---|---|---|---|
| `/` | Full | Full | Full | Full | Full |
| `/categories` | Full | Full | Full | Full | Full |
| `/category/:slug` | Full | Full | Full | Full | Full |
| `/search` | Full | Full | Full | Full | Full |
| `/product/:sku` | Full (list price) | Full (contract price) | Full (contract price) | — (internal role, no storefront pricing need) | — |
| `/basket` | Full | Full | Full | — | — |
| `/bulk-order` | Full | Full | Full | — | — |
| `/order-submitted` | Full (own session) | Full | Full | — | — |
| `/order/:id?token=` | Token-gated | Own data only | Own data only (all company orders) | Read-only, assigned companies only | Full |
| `/checkout/:id?token=` | Token-gated, only if `confirmed` | Own data only, only if `confirmed` | Own data only, only if `confirmed` | — | — |
| `/quote` | Full | Full | Full | — | — |
| `/quote/:id?token=` | Token-gated | Own data only | Own data only | Read-only, assigned companies only | Full (pricing/issue) |
| `/returns` | Full (with order context) | Full | Full | — | — |
| `/returns/:id?token=` | Token-gated | Own data only | Own data only | Read-only, assigned companies only | Full (approve/reject) |
| `/account/returns` | — | Own data only | Own data only (all company) | Read-only, assigned companies only | — (uses `/staff/returns`) |
| `/support` | Full | Full | Full | — | — |
| `/support/:id?token=` | Token-gated | Own data only | Own data only | Read-only, assigned companies only | Full (reply/escalate) |
| `/how-to-order` | Full | Full | Full | Full | Full |
| `/contact` | Full | Full | Full | Full | Full |
| `/auth` | Full (entry point) | Full | Full | Full (email-or-username) | Full (email-or-username) |
| `/register` | Full (invite acceptance / company registration) | Full (invite acceptance) | Full | — | — |
| `/account` | — | Own data only | Own data only | — | — |
| `/account/orders` | — | Own orders only | All company orders | — | — |
| `/account/users` | — | — (admin-only) | Full, own company only | — | — |
| `/account/pricing` | — | Read-only, own company | Read-only, own company | — | — |
| `/staff/orders` | — | — | — | Read-only, assigned companies only | Full |
| `/staff/order/:id` | — | — | — | Read-only, assigned companies only | Full (approve/cancel) |
| `/staff/quotes` | — | — | — | Read-only, assigned companies only | Full (price/issue) |
| `/staff/accounts` | — | — | — | Read-only, assigned companies only | Full |
| `/staff/returns` | — | — | — | Read-only, assigned companies only | Full |
| `/staff/support` | — | — | — | Read-only, assigned companies only | Full |
| `/staff/team` | — | — | — | — | Full (NCC admin only, no other role reaches this even read-only) |

## Notes carried from the PRD

- No staff route or link is ever exposed in public navigation/footer (PRD §5.2 Footer spec, §6.22).
- Company (buyer) sign-in is email-only; NCC admin/sales rep sign-in accepts email **or** username in one field, both resolving to the same account (PRD §2, acceptance criteria 18/21).
- A sales rep can never approve orders, price quotes, or edit spend limits, regardless of company assignment (PRD §2) — the "Read-only" cells above are not a UI convention, they are the authorization boundary itself (CLAUDE.md rule 17).
- Guest token-gated routes must resist enumeration and never leak the existence of other customers' resources (PRD rule 5, CLAUDE.md rule 16).
