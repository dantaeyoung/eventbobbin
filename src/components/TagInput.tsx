'use client';

import { useState, useRef, useEffect } from 'react';

interface TagInputProps {
  value: string;
  onChange: (value: string) => void;
  allTags: string[];
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function TagInput({
  value,
  onChange,
  allTags,
  placeholder,
  className,
  autoFocus,
}: TagInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get the current tag being typed (after last comma)
  const getCurrentTag = () => {
    const parts = value.slice(0, cursorPosition).split(',');
    return parts[parts.length - 1].trim().toLowerCase();
  };

  const currentTag = getCurrentTag();

  // Filter suggestions based on current tag
  const suggestions = currentTag.length > 0
    ? allTags.filter(
        (tag) =>
          tag.toLowerCase().includes(currentTag) &&
          !value.toLowerCase().split(',').map((t) => t.trim()).includes(tag.toLowerCase())
      )
    : [];

  const handleSelect = (tag: string) => {
    // Replace current partial tag with selected tag
    const parts = value.split(',');
    const beforeCursor = value.slice(0, cursorPosition).split(',');
    const afterCursor = value.slice(cursorPosition).split(',');

    // Replace the last part before cursor
    beforeCursor[beforeCursor.length - 1] = ' ' + tag;

    // Combine, removing empty parts and trimming
    const newParts = [...beforeCursor.slice(0, -1), tag];
    if (afterCursor.length > 1) {
      newParts.push(...afterCursor.slice(1));
    }

    const newValue = newParts.map((t) => t.trim()).filter(Boolean).join(', ') + ', ';
    onChange(newValue);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
    if (e.key === 'Tab' && suggestions.length > 0 && showSuggestions) {
      e.preventDefault();
      handleSelect(suggestions[0]);
    }
  };

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setCursorPosition(e.target.selectionStart || 0);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        onKeyDown={handleKeyDown}
        onSelect={(e) => setCursorPosition((e.target as HTMLInputElement).selectionStart || 0)}
        placeholder={placeholder}
        className={className}
        autoFocus={autoFocus}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 max-h-32 overflow-y-auto">
          {suggestions.slice(0, 6).map((tag) => (
            <button
              key={tag}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(tag);
              }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                {tag}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
