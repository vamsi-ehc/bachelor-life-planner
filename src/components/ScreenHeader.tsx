import { useNavigate } from 'react-router-dom';

export function ScreenHeader({ label }: { label: string }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 font-mono text-xs text-muted">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Back"
          className="hover:text-ink"
        >
          ←
        </button>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1">
          <button type="button" onClick={() => navigate('/')} className="hover:text-ink hover:underline">
            Home
          </button>
          <span>/</span>
          <span className="text-ink">{label}</span>
        </nav>
      </div>
      <h1 className="text-xl font-semibold">{label}</h1>
    </div>
  );
}
