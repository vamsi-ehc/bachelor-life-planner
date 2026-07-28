export interface PunchInButtonProps {
  done: boolean;
  onToggle: () => void;
}

export function PunchInButton({ done, onToggle }: PunchInButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`px-4 py-2.5 rounded-lg font-display font-semibold ${done ? 'bg-ok text-white' : 'bg-primary text-white hover:bg-primary-dark'}`}
    >
      {done ? 'Punched in ✓' : 'Punch In'}
    </button>
  );
}
