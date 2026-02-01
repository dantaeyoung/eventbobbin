'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

export function Tooltip({ text, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, position: 'top' as 'top' | 'bottom' });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const tooltipHeight = 32; // approximate height

      // Check if tooltip would go off the top of the viewport
      const showBelow = rect.top - tooltipHeight - 8 < 0;

      setCoords({
        top: showBelow ? rect.bottom + 6 : rect.top - 6,
        left: rect.left + rect.width / 2,
        position: showBelow ? 'bottom' : 'top',
      });
    }
  }, [isVisible]);

  const tooltip = isVisible && mounted ? createPortal(
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        top: coords.position === 'top' ? 'auto' : coords.top,
        bottom: coords.position === 'top' ? `calc(100vh - ${coords.top}px)` : 'auto',
        left: coords.left,
        transform: 'translateX(-50%)',
        zIndex: 99999,
      }}
      className="px-2 py-1 text-xs text-white bg-gray-800 rounded shadow-lg whitespace-nowrap"
    >
      {text}
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-4 border-transparent
          ${coords.position === 'top' ? 'top-full border-t-gray-800' : 'bottom-full border-b-gray-800'}`}
      />
    </div>,
    document.body
  ) : null;

  return (
    <span
      ref={triggerRef}
      className="inline-flex items-center cursor-help"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {tooltip}
    </span>
  );
}
