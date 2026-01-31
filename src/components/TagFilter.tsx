'use client';

import { Source } from '@/lib/types';

interface TagFilterProps {
  sources: Source[];
  selected: string[];
  onChange: (tags: string[]) => void;
}

export function TagFilter({ sources, selected, onChange }: TagFilterProps) {
  // Extract unique tags from all sources
  const allTags = new Set<string>();
  sources.forEach((source) => {
    if (source.tags) {
      source.tags.split(',').forEach((tag) => {
        const trimmed = tag.trim().toLowerCase();
        if (trimmed) allTags.add(trimmed);
      });
    }
  });

  const sortedTags = Array.from(allTags).sort();

  if (sortedTags.length === 0) return null;

  const toggleTag = (tag: string) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  };

  return (
    <div className="flex flex-wrap gap-1">
      {sortedTags.map((tag) => (
        <button
          key={tag}
          onClick={() => toggleTag(tag)}
          className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
            selected.includes(tag)
              ? 'bg-blue-500 text-white'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`}
        >
          {tag}
        </button>
      ))}
      {selected.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700"
        >
          Clear
        </button>
      )}
    </div>
  );
}
