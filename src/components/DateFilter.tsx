'use client';

export type DateRange = 'today' | 'week' | 'month' | 'all';

interface DateFilterProps {
  selected: DateRange;
  onChange: (range: DateRange) => void;
}

const ranges: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All' },
];

export function DateFilter({ selected, onChange }: DateFilterProps) {
  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
      {ranges.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            selected === range.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
