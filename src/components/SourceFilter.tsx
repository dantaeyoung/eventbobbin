'use client';

import { Source } from '@/lib/types';

interface SourceFilterProps {
  sources: Source[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function SourceFilter({ sources, selected, onChange }: SourceFilterProps) {
  const handleToggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const handleAll = () => {
    onChange([]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={handleAll}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          selected.length === 0
            ? 'bg-gray-900 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        All Sources
      </button>
      {sources.map((source) => (
        <button
          key={source.id}
          onClick={() => handleToggle(source.id)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selected.includes(source.id)
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {source.name}
        </button>
      ))}
    </div>
  );
}
