import { DueItem } from '../domains/shared/types';

export function DueNowStrip({ items }: { items: DueItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">Nothing due right now.</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.id} className="text-sm bg-amber-50 border border-amber-200 rounded px-2 py-1">
          {item.label}
        </li>
      ))}
    </ul>
  );
}
