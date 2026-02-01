'use client';

import { useEffect, useRef } from 'react';

interface DitheredBackgroundProps {
  className?: string;
}

export function DitheredBackground({ className = '' }: DitheredBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to cover viewport
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawNoise();
    };

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

      return (value / maxValue + 1) / 2; // Normalize to 0-1
    };

    // Ordered dithering matrix (Bayer 4x4)
    const bayerMatrix = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ];

    const drawNoise = () => {
      const width = canvas.width;
      const height = canvas.height;
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      // Base cream color
      const baseR = 255;
      const baseG = 248;
      const baseB = 240;

      // Darker shade for dithering
      const darkR = 235;
      const darkG = 225;
      const darkB = 215;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;

          // Get noise value
          const n = noise(x, y, 42);

          // Get threshold from Bayer matrix
          const threshold = bayerMatrix[y % 4][x % 4] / 16;

          // Apply dithering - creates subtle texture
          const dithered = n > threshold ? 1 : 0;

          // Blend between base and dark based on dither
          const blend = 0.15; // Subtle effect
          const r = baseR - (baseR - darkR) * dithered * blend;
          const g = baseG - (baseG - darkG) * dithered * blend;
          const b = baseB - (baseB - darkB) * dithered * blend;

          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 -z-10 ${className}`}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
