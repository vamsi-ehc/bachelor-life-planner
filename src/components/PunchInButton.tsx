export interface PunchInButtonProps {
  done: boolean;
  onToggle: () => void;
}

export function PunchInButton({ done, onToggle }: PunchInButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`px-4 py-2 rounded font-semibold ${done ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}
    >
      {done ? 'Punched in ✓' : 'Punch In'}
    </button>
  );
}
