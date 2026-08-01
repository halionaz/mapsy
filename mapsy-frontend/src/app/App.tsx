import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import { AppLayout } from './AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { WardrobePage } from '@/features/items/WardrobePage'
import { ItemNewPage } from '@/features/items/ItemNewPage'
import { ItemDetailPage } from '@/features/items/ItemDetailPage'
import { ItemEditPage } from '@/features/items/ItemEditPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

/**
 * The wardrobe is loaded once and then filtered client-side (PRD §8.4), so
 * `staleTime` is long — this tab is the only writer, and mutations patch the
 * cache directly rather than refetching.
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
      // Thumbnails are signed URLs with a finite life (see SIGNED_URL_TTL in
      // api.ts). Leaving focus refetch off meant a PWA left open long enough
      // came back to a grid of broken images with no way to recover short of a
      // manual reload.
      refetchOnWindowFocus: true,
      retry: 2,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* AppLayout is the auth gate: anonymous visitors are sent to /login. */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<WardrobePage />} />
            <Route path="/items/new" element={<ItemNewPage />} />
            <Route path="/items/:id" element={<ItemDetailPage />} />
            <Route path="/items/:id/edit" element={<ItemEditPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
