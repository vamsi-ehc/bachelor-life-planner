export type ChipStatus = 'done' | 'in-progress' | 'not-started';

export interface StatusChipProps {
  label: string;
  status: ChipStatus;
  detail?: string;
  onClick?: () => void;
}

const dotColor: Record<ChipStatus, string> = {
  done: 'bg-green-500',
  'in-progress': 'bg-amber-500',
  'not-started': 'bg-gray-400',
};

export function StatusChip({ label, status, detail, onClick }: StatusChipProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-1 border rounded-lg p-3 text-left w-full"
    >
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor[status]}`} data-testid="status-dot" />
        <span className="font-medium">{label}</span>
      </div>
      {detail && <span className="text-sm text-gray-500">{detail}</span>}
    </button>
  );
}
