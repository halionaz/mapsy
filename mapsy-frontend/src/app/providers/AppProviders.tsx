import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'

/**
 * Everything the screens need to be mounted inside, in one place — so `App`
 * reads as a route table and nothing else.
 *
 * The wardrobe is loaded once and then filtered client-side (PRD §8.4), so
 * `staleTime` is long — this tab is the only writer, and mutations patch the
 * cache directly, refetching only when there was no entry to patch.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 60 * 1000,
      // Longer than staleTime on purpose. The default 5 minutes evicts the
      // wardrobe while the registration form is open — taking and cropping five
      // photos routinely takes longer — and a mutation landing against an
      // evicted entry has nothing to patch.
      gcTime: 60 * 60 * 1000,
      // Thumbnails are signed URLs with a finite life (see
      // SIGNED_URL_TTL_SECONDS in shared/api/storage.ts). Leaving focus refetch
      // off meant a PWA left open long enough came back to a grid of broken
      // images with no way to recover short of a manual reload.
      refetchOnWindowFocus: true,
      retry: 2,
    },
  },
})

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  )
}
