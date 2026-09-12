import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { getCatalogueAdapter } from '../../server/integrations/shopify'
import type { ProductDetail } from '../../server/integrations/shopify/types'
import { Breadcrumbs } from '../../components/ui/Breadcrumbs'
import { Icon } from '../../components/ui/Icon'
import { Container, Section } from '../../components/ui/Layout'

const getProductData = createServerFn({ method: 'GET' })
  .validator((sku: string) => sku)
  .handler(async ({ data: sku }): Promise<ProductDetail | null> => {
    try {
      return await getCatalogueAdapter().getProduct(sku)
    } catch (error) {
      console.error('[product] failed to load product', error)
      return null
    }
  })

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

export const Route = createFileRoute('/product/$sku')({
  loader: async ({ params }) => {
    const product = await getProductData({ data: params.sku })
    if (!product) throw notFound()
    return product
  },
  head: ({ loaderData: product }) => {
    if (!product) return {}
    return {
      meta: [
        { title: `${product.title} · NCC Supply` },
        {
          name: 'description',
          content: `${product.title} — SKU ${product.sku}. Available to order.`,
        },
      ],
      links: [{ rel: 'canonical', href: `/product/${product.sku}` }],
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.title,
            sku: product.sku,
            description: product.description,
            image: product.images.map((image) => image.url),
            offers: {
              '@type': 'Offer',
              priceCurrency: product.price.currencyCode,
              price: (product.price.amountPence / 100).toFixed(2),
              availability: 'https://schema.org/PreOrder',
            },
          }),
        },
      ],
    }
  },
  component: ProductRoute,
})

function ProductRoute() {
  const product = Route.useLoaderData()
  const [quantity, setQuantity] = useState(1)
  const images = product.images.length > 0 ? product.images : [product.thumbnail]

  return (
    <Section>
      <Container className="flex flex-col gap-6">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: product.collectionTitle, href: `/category/${product.collectionHandle}` },
            { label: product.title },
          ]}
        />

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div
              className="sky-gradient grid-mesh flex aspect-square items-center justify-center rounded-xl"
              role="img"
              aria-label={images[0]?.altText}
            />
            {images.length > 1 ? (
              <div className="flex gap-2">
                {images.slice(1, 5).map((image) => (
                  <div
                    key={image.url || image.altText}
                    className="sky-gradient grid-mesh h-16 w-16 rounded-lg"
                    role="img"
                    aria-label={image.altText}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            <span className="w-fit text-xs font-semibold uppercase tracking-wide text-primary">
              {product.collectionTitle}
            </span>
            <h1 className="text-3xl font-semibold text-foreground">{product.title}</h1>
            <span className="text-sm text-muted-foreground">SKU {product.sku}</span>

            <div>
              <span className="font-display text-3xl font-semibold text-foreground">
                {formatPrice(product.price.amountPence)}
              </span>
              <p className="text-sm text-muted-foreground">ex VAT · Available to order</p>
            </div>

            {product.description ? (
              <p className="text-sm text-muted-foreground">{product.description}</p>
            ) : null}

            {product.specs.length > 0 ? (
              <dl className="flex flex-col gap-1 border-t border-border pt-4 text-sm">
                {product.specs.map((spec) => (
                  <div key={spec.label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{spec.label}</dt>
                    <dd className="text-foreground">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <div className="flex items-center gap-3 border-t border-border pt-4">
              <label className="flex items-center gap-2 text-sm">
                <span className="sr-only">Quantity</span>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                  className="w-20 rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <button
                type="button"
                disabled
                aria-label={`Add ${product.title} to basket — coming soon`}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground/60"
              >
                <Icon icon={Plus} size="sm" />
                Add to Basket
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Adding to basket is not checkout — no payment is taken until NCC confirms your order.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  )
}
