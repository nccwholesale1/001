import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { Check, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { addBasketLine } from '../../server/basket/server-functions'
import { getCatalogueAdapter } from '../../server/integrations/shopify'
import type { ProductDetail, ProductImage } from '../../server/integrations/shopify/types'
import { Breadcrumbs } from '../../components/ui/Breadcrumbs'
import { Icon } from '../../components/ui/Icon'
import { Container, Section } from '../../components/ui/Layout'
import { cn } from '../../lib/cn'

type AddStatus = 'idle' | 'adding' | 'added' | 'error'
const CONFIRM_DURATION_MS = 1400

/** Real image when one exists (live Shopify data always will); the design system's gradient/mesh placeholder otherwise — never a blank box. */
function GalleryImage({ image, className }: { image: ProductImage; className: string }) {
  const [failed, setFailed] = useState(false)
  if (!image.url || failed) {
    return (
      <div className={cn('sky-gradient grid-mesh flex items-center justify-center', className)} role="img" aria-label={image.altText} />
    )
  }
  return (
    <img
      src={image.url}
      alt={image.altText}
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  )
}

const productSkuSchema = z.string().min(1).max(200)

const getProductData = createServerFn({ method: 'GET' })
  .validator(productSkuSchema.parse)
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
  ssr: false,
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
            description: product.descriptionText,
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
  const [status, setStatus] = useState<AddStatus>('idle')
  const addLine = useServerFn(addBasketLine)
  const router = useRouter()
  const images = product.images.length > 0 ? product.images : [product.thumbnail]

  async function handleAdd() {
    setStatus('adding')
    try {
      await addLine({ data: { sku: product.sku, quantity } })
      setStatus('added')
      router.invalidate()
    } catch {
      setStatus('error')
    } finally {
      setTimeout(() => setStatus('idle'), CONFIRM_DURATION_MS)
    }
  }

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
            {images[0] ? (
              <GalleryImage image={images[0]} className="aspect-square w-full rounded-xl" />
            ) : null}
            {images.length > 1 ? (
              <div className="flex gap-2">
                {images.slice(1, 5).map((image, index) => (
                  <GalleryImage
                    key={image.url || `${image.altText}-${index}`}
                    image={image}
                    className="h-16 w-16 rounded-lg"
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
              <p className="text-sm text-muted-foreground">Available to order</p>
            </div>

            {product.description ? (
              // Sanitized server-side before this ever reaches the client (see
              // integrations/shopify/sanitize-description.ts) — real merchant-authored
              // rich text (paragraphs/lists/emphasis), not raw markup shown as text.
              <div
                className="prose-sm flex flex-col gap-2 text-sm text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
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
                onClick={handleAdd}
                disabled={status === 'adding'}
                aria-label={
                  status === 'added'
                    ? `${product.title} added to basket`
                    : status === 'error'
                      ? `Could not add ${product.title} to basket — try again`
                      : `Add ${product.title} to basket`
                }
                className={
                  status === 'added'
                    ? 'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-secondary px-5 py-3 text-sm font-semibold text-primary'
                    : status === 'error'
                      ? 'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-destructive/40 px-5 py-3 text-sm font-semibold text-destructive'
                      : 'sky-gradient inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-5 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 motion-reduce:hover:translate-y-0'
                }
              >
                <Icon icon={status === 'added' ? Check : status === 'error' ? X : Plus} size="sm" />
                {status === 'added' ? 'Added' : status === 'error' ? 'Retry' : 'Add to Basket'}
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
