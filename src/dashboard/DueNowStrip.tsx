import { DueItem } from '../domains/shared/types';

export function DueNowStrip({ items }: { items: DueItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">Nothing due right now.</p>;
  }
  return (
    <ul className="flex flex-col gap-2 bg-primary-dim rounded-lg p-3">
      {items.map((item) => (
        <li key={item.id} className="flex justify-between text-sm">
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
