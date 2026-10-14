import styles from "./Logo.module.css";

/** HIMVEDA mark: two contour lines forming a ridge, with the origin point in marigold. */
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 48 L26 20 L34 31 L40 24 L58 48" />
        <path d="M17 48 L27 35 L33 42" opacity=".5" />
      </g>
      <circle cx="26" cy="20" r="5" fill="var(--marigold)" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={styles.logo} data-compact={compact || undefined}>
      <Mark className={styles.mark} />
      <span className={styles.word}>HIMVEDA</span>
    </span>
  );
}
