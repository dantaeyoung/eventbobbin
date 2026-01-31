'use client';

import { Source } from '@/lib/types';
import { getTagColor, getTagColorSelected } from '@/lib/tagColors';

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
    <div className="flex flex-wrap gap-1.5">
      {sortedTags.map((tag) => {
        const isSelected = selected.includes(tag);
        const colors = isSelected ? getTagColorSelected(tag) : getTagColor(tag);
        return (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            style={{
              backgroundColor: colors.bg,
              color: colors.text,
            }}
            className={`px-2.5 py-1 text-xs rounded-full transition-all font-medium ${
              isSelected ? 'shadow-sm ring-2 ring-offset-1 ring-gray-400' : 'hover:opacity-80'
            }`}
          >
            {tag}
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
        >
          Clear
        </button>
      )}
    </div>
  );
}
