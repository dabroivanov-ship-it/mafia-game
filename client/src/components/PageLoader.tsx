interface PageLoaderProps {
  label?: string;
  compact?: boolean;
}

export default function PageLoader({ label = 'Загрузка…', compact = false }: PageLoaderProps) {
  return (
    <div
      className={`page-loader${compact ? ' page-loader-compact' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="page-loader-spinner" aria-hidden />
      <p>{label}</p>
    </div>
  );
}
