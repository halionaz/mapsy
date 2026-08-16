import * as styles from './Field.css'

/**
 * 라벨이 붙은 블록 — 캡션, 힌트, 컨트롤, 그리고 컨트롤이 자신에 대해 하는 말.
 *
 * 실제 `<label>`은 폼 컨트롤 하나를 감쌀 때(`htmlFor`)만 쓴다. 전부를 label로 감싸면
 * 자식이 칩 `<fieldset>`이나 자체 label을 가진 피커일 때 잘못된 HTML이 되고, "카테고리"를
 * 누르면 첫 번째 labelable 자손이 눌린다.
 */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  const caption = (
    <>
      <span className={styles.captionLabel}>{label}</span>
      {required && (
        <span className={styles.requiredMark} aria-hidden="true">
          *
        </span>
      )}
      {hint && <span className={styles.hint}>{hint}</span>}
    </>
  )

  return (
    <div className={styles.block}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={styles.caption}>
          {caption}
        </label>
      ) : (
        <span className={styles.caption}>{caption}</span>
      )}
      {children}
    </div>
  )
}

export function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <span role="alert" className={styles.error}>
      {children}
    </span>
  )
}
