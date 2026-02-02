'use client';

import { useEffect, useRef, useCallback } from 'react';

interface DitheredBackgroundProps {
  className?: string;
}

// Parse hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }
  // Default to cream if parsing fails
  return { r: 255, g: 248, b: 240 };
}

// Darken a color by a percentage
function darkenColor(r: number, g: number, b: number, amount: number): { r: number; g: number; b: number } {
  return {
    r: Math.max(0, Math.floor(r * (1 - amount))),
    g: Math.max(0, Math.floor(g * (1 - amount))),
    b: Math.max(0, Math.floor(b * (1 - amount))),
  };
}

export function DitheredBackground({ className = '' }: DitheredBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawBackground = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get background color from CSS variable
    const bgColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-background')
      .trim() || '#FFF8F0';

    const base = hexToRgb(bgColor);
    const dark = darkenColor(base.r, base.g, base.b, 0.08);

    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Simple Perlin-like noise using multiple octaves of sine waves
    const noise = (x: number, y: number, seed: number = 0): number => {
      let value = 0;
      let amplitude = 1;
      let frequency = 0.005;
      let maxValue = 0;

      for (let i = 0; i < 4; i++) {
        value += amplitude * (
          Math.sin(x * frequency + seed) *
          Math.cos(y * frequency * 1.3 + seed * 0.7) +
          Math.sin((x + y) * frequency * 0.7 + seed * 1.3)
        );
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
      }

      return (value / maxValue + 1) / 2;
    };

    // Ordered dithering matrix (Bayer 4x4)
    const bayerMatrix = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const n = noise(x, y, 42);
        const threshold = bayerMatrix[y % 4][x % 4] / 16;
        const dithered = n > threshold ? 1 : 0;
        const blend = 0.15;

        data[i] = base.r - (base.r - dark.r) * dithered * blend;
        data[i + 1] = base.g - (base.g - dark.g) * dithered * blend;
        data[i + 2] = base.b - (base.b - dark.b) * dithered * blend;
        data[i + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawBackground();
    };

    resize();
    window.addEventListener('resize', resize);

    // Listen for color scheme changes via CSS variable mutations
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'style') {
          drawBackground();
          break;
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style'],
    });

    return () => {
      window.removeEventListener('resize', resize);
      observer.disconnect();
    };
  }, [drawBackground]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 -z-10 ${className}`}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
