import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'

import { useAuthListener } from '@/features/auth'
import { Toaster } from '@/shared/ui/Toaster'
import { ErrorBoundary } from '../ErrorBoundary'

/**
 * 화면이 그 안에 마운트되어야 하는 것 전부를 한 곳에 — 그래야 `App`이 라우트 표로만 읽힌다.
 *
 * 옷장은 한 번 불러와 클라이언트에서 거르므로(PRD §8.4) `staleTime`이 길다. 쓰는 것은
 * 이 탭뿐이고, 뮤테이션이 캐시를 직접 기우며 기울 엔트리가 없을 때만 다시 불러온다.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 60 * 1000,
      // 일부러 staleTime보다 길다. 기본 5분은 등록 폼이 열려 있는 동안 옷장을 비우고
      // — 사진 다섯 장을 찍고 자르는 데 그보다 오래 걸린다 — 비워진 엔트리에 도착한
      // 뮤테이션에는 기울 것이 없다.
      gcTime: 60 * 60 * 1000,
      // 썸네일은 수명이 있는 서명 URL이다(shared/api/storage.ts의
      // SIGNED_URL_TTL_SECONDS). 포커스 갱신을 끄면 오래 열어둔 PWA가 깨진 이미지의
      // 격자로 돌아오고, 손으로 새로고침하는 것 말고는 복구할 길이 없다.
      refetchOnWindowFocus: true,
      retry: 2,
    },
  },
})

/** 클라이언트 안쪽이어야 `useQueryClient`가 위의 것을 찾는다. */
function AuthSync() {
  useAuthListener()
  return null
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* 라우터 안에 두어 대체 화면이 화면처럼 배치되고, 화면 바깥에 두어 어느 것이
            던졌든 살아남는다. */}
        <ErrorBoundary>
          {/* 경계 밖에 두면 여기서 던지는 것 — 형식이 틀린 `VITE_SUPABASE_URL`에
              `createClient`가 던지는 경우 — 이 트리 전체를 언마운트해 빈 문서가 된다. */}
          <AuthSync />
          {children}
        </ErrorBoundary>
        {/* 일부러 라우터의 화면 밖에. 성공하면 이동하는 뮤테이션이 띄운 토스트는
            그것을 띄운 화면보다 오래 살아야 한다. */}
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
