import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/account/pricing')({
  head: () => ({ meta: [{ title: 'Pricing · NCC Supply' }] }),
  component: AccountPricingRoute,
})

/**
 * ADR-005 already resolved PRD Open Question 3 to uniform list pricing —
 * there is no contract/tier price list to show here. This states that
 * plainly rather than fabricating a per-SKU table for a pricing model the
 * product doesn't have.
 */
function AccountPricingRoute() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-foreground">Pricing</h1>
      <div className="surface-card rounded-xl p-5">
        <p className="text-sm text-foreground">
          Your company doesn't have a separate contract or tier pricing agreement — every product
          is priced at the same standard trade list price shown on its product page.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          If your company has agreed different pricing with NCC, contact your account manager and
          it will be reflected here.
        </p>
      </div>
      <a href="/categories" className="text-sm font-medium text-primary hover:underline">
        Browse the catalogue
      </a>
    </div>
  )
}
