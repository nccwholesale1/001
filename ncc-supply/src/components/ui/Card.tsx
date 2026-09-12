import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/** Generic content card — design system §7 product-card body uses this as its shell. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('surface-card rise-in flex flex-col rounded-xl p-4', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  // eslint-disable-next-line jsx-a11y/heading-has-content -- content always arrives via {...props}.children; jsx-a11y can't see through the spread on this pass-through wrapper.
  return <h3 className={cn('text-base font-semibold leading-snug text-foreground', className)} {...props} />
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-4 flex items-center justify-between', className)} {...props} />
}
