import { useMemo, useState } from 'react'
import { LogOut, PackageOpen } from 'lucide-react'
import { css } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import { ItemCard, useWardrobe } from '@/entities/item'
import { signOut, useSession } from '@/features/auth'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { ScreenHeader } from '@/shared/ui/ScreenHeader'
import { toaster } from '@/shared/ui/toast'

/**
 * 설정 (PRD §6.4) — account, disposed garments, sign out.
 *
 * 처분한 옷 is a section here rather than its own route because it is the same
 * grid over the same already-loaded collection with one predicate changed; a
 * screen for it would be a second copy of the wardrobe page whose only
 * difference is a `status` value.
 */
export function SettingsPage() {
  const session = useSession()
  const { data } = useWardrobe()
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const user = session.status === 'authenticated' ? session.session.user : null
  const email = user?.email ?? null
  const disposed = useMemo(
    () => (data ?? []).filter((item) => item.status === 'disposed'),
    [data],
  )

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      // No navigation: the session listener drops `AppLayout` back to its gate,
      // which is what sends anyone unauthenticated to /login.
    } catch {
      toaster.create({ title: '로그아웃하지 못했어요.', type: 'error' })
      setSigningOut(false)
      setConfirmingSignOut(false)
    }
  }

  return (
    <ScreenHeader title="설정">
      <div className={vstack({ gap: '8', alignItems: 'stretch' })}>
        <section className={vstack({ gap: '3', alignItems: 'stretch' })}>
          <h2 className={sectionTitle}>계정</h2>
          <div className={card}>
            <div className={hstack({ gap: '3' })}>
              <span className={avatar} aria-hidden="true">
                {(email ?? 'm').slice(0, 1).toUpperCase()}
              </span>
              <div className={css({ minWidth: 0 })}>
                <p className={css({ textStyle: 'bodyStrong', truncate: true })}>
                  {email ?? '미리보기 모드'}
                </p>
                <p className={css({ textStyle: 'caption', color: 'fg.muted' })}>
                  {email ? 'Google 계정으로 로그인됨' : 'Supabase 환경변수가 없어요'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={vstack({ gap: '3', alignItems: 'stretch' })}>
          <h2 className={sectionTitle}>
            처분한 옷
            <span className={css({ ml: '2', color: 'fg.subtle' })}>{disposed.length}</span>
          </h2>

          {disposed.length === 0 ? (
            <p className={emptyNote}>
              <PackageOpen size={15} aria-hidden="true" />
              처분한 옷이 아직 없어요.
            </p>
          ) : (
            <ul className={grid}>
              {disposed.map((item) => (
                <li key={item.id}>
                  <ItemCard item={item} />
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
            icon={<LogOut size={16} />}
            onClick={() => setConfirmingSignOut(true)}
            disabled={signingOut}
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
        pending={signingOut}
        onConfirm={() => void handleSignOut()}
      />
    </ScreenHeader>
  )
}

const sectionTitle = css({ textStyle: 'subheading', color: 'fg' })

const card = css({
  p: '4',
  rounded: 'field',
  bg: 'bg.elevated',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'border.subtle',
})

const avatar = css({
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  width: '11',
  height: '11',
  rounded: 'full',
  bg: 'accent',
  color: 'accent.fg',
  textStyle: 'heading',
})

const emptyNote = hstack({
  gap: '2',
  px: '4',
  py: '4',
  rounded: 'field',
  bg: 'bg.subtle',
  color: 'fg.muted',
  textStyle: 'caption',
})

// Same three tracks as the wardrobe grid, for the same reason — see the note on
// `minmax(0, 1fr)` in WardrobePage.
const grid = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  '& > li': { minWidth: 0 },
  gap: '3',
  listStyle: 'none',
  p: '0',
  m: '0',
})
