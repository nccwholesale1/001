import { Disclosure } from './Disclosure'

export interface FaqItem {
  question: string
  answer: string
}

/**
 * Content grounded only in confirmed PRD facts (§4 rules) — no return
 * window, SLA, or other still-open policy number is stated (DECISIONS.md
 * "Still awaiting business confirmation").
 */
export const HOME_FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Do I need an account to order?',
    answer:
      'No — order as a guest via a private, secure link, or set up a company account for reorder history, contract pricing, and multi-user buying.',
  },
  {
    question: 'When do I pay?',
    answer:
      'Never at basket submission — no card details are ever collected there. NCC reviews your order first, confirming quantities, delivery and VAT, and only then is a payment link or invoice available.',
  },
  {
    question: 'Is there a minimum order quantity?',
    answer: 'No minimum or maximum on any line — order any quantity, from a single unit upward.',
  },
  {
    question: 'Can I track my order without an account?',
    answer:
      'Yes — every guest order gets its own private, secure status link, no sign-in required.',
  },
  {
    question: 'What if something needs to be returned?',
    answer:
      'Returns are requested against a confirmed order from your order or account status page, and NCC reviews every request.',
  },
  {
    question: 'How do I get help?',
    answer:
      'Use the Help / Report an issue link in the header from anywhere on the site — with or without an account.',
  },
]

export interface FaqProps {
  items?: FaqItem[]
}

export function FAQ({ items = HOME_FAQ_ITEMS }: FaqProps) {
  return (
    <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Disclosure key={item.question} summary={item.question}>
          {item.answer}
        </Disclosure>
      ))}
    </div>
  )
}
