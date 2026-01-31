'use client';

import { useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';

interface CalendarProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  eventDates: Set<string>; // ISO date strings (YYYY-MM-DD)
}

export function Calendar({ selectedDate, onSelectDate, eventDates }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  // Build array of weeks
  const weeks: Date[][] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const handleDateClick = (date: Date) => {
    if (selectedDate && isSameDay(date, selectedDate)) {
      onSelectDate(null); // Deselect if clicking same date
    } else {
      onSelectDate(date);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-1 hover:bg-gray-100 rounded"
        >
          ←
        </button>
        <h3 className="font-semibold text-gray-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-1 hover:bg-gray-100 rounded"
        >
          →
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-center text-xs text-gray-500 font-medium">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((date, i) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          const hasEvents = eventDates.has(dateKey);
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const isCurrentMonth = isSameMonth(date, currentMonth);
          const isTodayDate = isToday(date);

          return (
            <button
              key={i}
              onClick={() => handleDateClick(date)}
              className={`
                relative aspect-square flex items-center justify-center text-sm rounded
                ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                ${isTodayDate ? 'font-bold' : ''}
                ${isSelected ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'}
              `}
            >
              {format(date, 'd')}
              {hasEvents && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Clear selection */}
      {selectedDate && (
        <button
          onClick={() => onSelectDate(null)}
          className="mt-2 w-full text-xs text-gray-500 hover:text-gray-700"
        >
          Clear selection
        </button>
      )}
    </div>
  );
}
