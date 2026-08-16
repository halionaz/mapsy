import { useMemo, useState } from 'react'
import { LogOut, PackageOpen } from 'lucide-react'

import { ItemCard, useWardrobe } from '@/entities/item'
import { attachWears, useWears } from '@/entities/wear'
import { useSession, useSignOut } from '@/features/auth'
import { formatDayAgo } from '@/shared/lib/format'
import { useToday } from '@/shared/lib/useToday'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { ScreenHeader } from '@/shared/ui/ScreenHeader'
import { toaster } from '@/shared/ui/toast'
import * as styles from './SettingsPage.css'

/**
 * 설정 (PRD §6.4) — 계정, 처분한 옷, 로그아웃.
 *
 * 처분한 옷이 별도 라우트가 아니라 여기의 한 구획인 것은, 이미 불러온 같은 컬렉션 위에서
 * 술어 하나만 바꾼 같은 격자이기 때문이다. 화면을 따로 두면 `status` 값 하나만 다른
 * 옷장 화면의 사본이 된다.
 */
export function SettingsPage() {
  const session = useSession()
  const { data } = useWardrobe()
  const { data: wearData } = useWears()
  const today = useToday()
  const signOut = useSignOut()
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)

  const user = session.status === 'authenticated' ? session.session.user : null
  const email = user?.email ?? null

  // 착용 이력을 여기서도 붙인다. 옷장보다 이 화면에서 값이 크다 — 카드의 줄이 그 옷을
  // 놓아주기 전 마지막으로 입은 때로 읽힌다.
  //
  // 합치기 전에 거른다. 이 화면이 그리는 몇 벌에만 요약이 붙는다.
  const disposed = useMemo(
    () =>
      attachWears(
        (data ?? []).filter((item) => item.status === 'disposed'),
        wearData ?? [],
      ),
    [data, wearData],
  )

  function handleSignOut() {
    signOut.mutate(undefined, {
      // 성공해도 이동하지 않는다. 세션 리스너가 `AppLayout`을 게이트로 되돌리고,
      // 인증되지 않은 방문을 /login으로 보내는 것이 그쪽이다.
      onError: () => {
        toaster.create({ title: '로그아웃하지 못했어요.', type: 'error' })
        setConfirmingSignOut(false)
      },
    })
  }

  return (
    <ScreenHeader title="설정">
      <div className={styles.page}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>계정</h2>
          <div className={styles.card}>
            <div className={styles.account}>
              <span className={styles.avatar} aria-hidden="true">
                {(email ?? 'm').slice(0, 1).toUpperCase()}
              </span>
              <div className={styles.accountText}>
                <p className={styles.email}>{email ?? '미리보기 모드'}</p>
                <p className={styles.emailNote}>
                  {email ? 'Google 계정으로 로그인됨' : 'Supabase 환경변수가 없어요'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            처분한 옷<span className={styles.count}>{disposed.length}</span>
          </h2>

          {disposed.length === 0 ? (
            <p className={styles.emptyNote}>
              <PackageOpen size={15} aria-hidden="true" />
              처분한 옷이 아직 없어요.
            </p>
          ) : (
            <ul className={styles.grid}>
              {disposed.map((item) => (
                <li key={item.id}>
                  <ItemCard
                    item={item}
                    wornLabel={item.lastWornOn ? formatDayAgo(item.lastWornOn, today) : null}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {email && (
          <Button
            variant="outline"
            shape="block"
            full
            icon={<LogOut />}
            onClick={() => setConfirmingSignOut(true)}
            disabled={signOut.isPending}
          >
            로그아웃
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmingSignOut}
        onOpenChange={setConfirmingSignOut}
        title="로그아웃할까요?"
        description="다시 로그인하면 옷장은 그대로 있어요."
        confirmLabel="로그아웃"
        pending={signOut.isPending}
        onConfirm={handleSignOut}
      />
    </ScreenHeader>
  )
}
