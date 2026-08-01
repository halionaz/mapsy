import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import { AppLayout } from './AppLayout'
import { LoginPage } from '../features/auth/LoginPage'
import { WardrobePage } from '../features/items/WardrobePage'
import { ItemNewPage } from '../features/items/ItemNewPage'
import { ItemDetailPage } from '../features/items/ItemDetailPage'
import { ItemEditPage } from '../features/items/ItemEditPage'
import { SettingsPage } from '../features/settings/SettingsPage'

/**
 * The wardrobe is loaded once and then filtered client-side (PRD §8.4), so the
 * cache should hold it rather than refetch on every focus. `staleTime` is long
 * because the only writer is this tab.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
})

export function App() {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
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
    </StrictMode>
  )
}
