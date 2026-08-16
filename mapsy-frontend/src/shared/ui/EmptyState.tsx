import * as styles from './EmptyState.css'

/**
 * 보여줄 것이 없는 화면 — 그리고 어떤 종류의 없음인지.
 *
 * 빈 옷장·조건에 맞는 옷 없음·불러오기 실패가 한 컴포넌트인 것은, 사용자 쪽에서는
 * 셋 다 "빈 화면을 보고 있다"는 같은 순간이기 때문이다.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
}: {
  icon: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  tone?: 'neutral' | 'danger'
}) {
  return (
    <div className={styles.block}>
      <span
        className={tone === 'danger' ? styles.dangerBadge : styles.neutralBadge}
        aria-hidden="true"
      >
        {icon}
      </span>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
