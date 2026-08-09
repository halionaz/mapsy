import { vi } from 'vitest'

/**
 * jsdom implements neither observer, so the two components that use them — the
 * wardrobe's pinned control bar and the sub-screen header — throw on mount
 * under test while working everywhere the app actually runs.
 *
 * Stubbed here rather than guarded inside `useScrolledPast`. Every browser mapsy
 * targets (PRD §9 — iOS Safari 16+, current Android Chrome) has shipped both for
 * years, so a `typeof IntersectionObserver === 'undefined'` branch in the hook
 * would be a branch that exists for exactly one environment, and it is this one.
 * Putting the difference in the test setup keeps it visible and keeps the
 * component honest.
 *
 * The stubs observe nothing and never call back, which leaves every test looking
 * at the un-scrolled state — the correct starting state for a freshly rendered
 * page, and the only one a test without layout could assert on anyway.
 */
class NeverObserves {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

vi.stubGlobal('IntersectionObserver', NeverObserves)
vi.stubGlobal('ResizeObserver', NeverObserves)
