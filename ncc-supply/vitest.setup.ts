import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement matchMedia at all. Components that check
// prefers-reduced-motion (e.g. BannerCarousel) need at least a stub so they
// don't throw in tests; defaults to "no preference" (matches: false).
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
