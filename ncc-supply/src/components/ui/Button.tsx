import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/**
 * Variants and sizing per docs/NCC-Supply-Design-System.md §7 "Buttons".
 * Primary uses the sky-gradient utility; never a hardcoded colour class.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none',
  {
    variants: {
      variant: {
        primary:
          'sky-gradient px-5 py-3 hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 motion-reduce:hover:translate-y-0',
        secondary:
          'border border-border bg-transparent px-5 py-3 text-foreground hover:bg-secondary',
        tertiary:
          'px-0 py-0 text-foreground/80 underline-offset-4 hover:underline',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant }), className)}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
