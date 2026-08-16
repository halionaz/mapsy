import { Navigate, Route, Routes } from 'react-router'

import { ItemDetailPage } from '@/pages/item-detail'
import { ItemEditPage } from '@/pages/item-edit'
import { ItemNewPage } from '@/pages/item-new'
import { LoginPage } from '@/pages/login'
import { SettingsPage } from '@/pages/settings'
import { WardrobePage } from '@/pages/wardrobe'
import { AppLayout } from './layouts/AppLayout'
import { AppProviders } from './providers/AppProviders'

export function App() {
  return (
    <AppProviders>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* AppLayout이 인증 게이트다 — 로그인하지 않은 방문자는 /login으로 간다. */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<WardrobePage />} />
          <Route path="/items/new" element={<ItemNewPage />} />
          <Route path="/items/:id" element={<ItemDetailPage />} />
          <Route path="/items/:id/edit" element={<ItemEditPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppProviders>
  )
}
