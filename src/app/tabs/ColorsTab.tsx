'use client';

import { useState, useEffect } from 'react';
import {
  ColorScheme,
  COLOR_SCHEMES,
  getStoredSchemeId,
  setStoredSchemeId,
  getCustomScheme,
  setCustomScheme,
  applyColorScheme,
  getSchemeById,
} from '@/lib/colorSchemes';

export function ColorsTab() {
  const [currentSchemeId, setCurrentSchemeId] = useState<string>('classic-blue');
  const [customColors, setCustomColors] = useState<ColorScheme['colors'] | null>(null);

  useEffect(() => {
    const storedId = getStoredSchemeId();
    setCurrentSchemeId(storedId);

    const custom = getCustomScheme();
    if (custom) {
      setCustomColors(custom.colors);
    }
  }, []);

  const handleSchemeChange = (schemeId: string) => {
    setCurrentSchemeId(schemeId);
    setStoredSchemeId(schemeId);
    const scheme = getSchemeById(schemeId);
    applyColorScheme(scheme);
  };

  const handleCustomColorChange = (key: keyof ColorScheme['colors'], value: string) => {
    const baseColors = customColors || getSchemeById('classic-blue').colors;
    const newColors = { ...baseColors, [key]: value };
    setCustomColors(newColors);

    const customScheme: ColorScheme = {
      id: 'custom',
      name: 'Custom',
      colors: newColors,
    };
    setCustomScheme(customScheme);

    if (currentSchemeId === 'custom') {
      applyColorScheme(customScheme);
    }
  };

  const currentScheme = getSchemeById(currentSchemeId);

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Color Scheme</h2>
        <p className="text-gray-600 mb-6">
          Choose a color scheme for the app, or create your own custom theme.
        </p>

        {/* Preset schemes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {COLOR_SCHEMES.map((scheme) => (
            <button
              key={scheme.id}
              onClick={() => handleSchemeChange(scheme.id)}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                currentSchemeId === scheme.id
                  ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-2'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex gap-1 mb-2">
                <div
                  className="w-6 h-6 rounded"
                  style={{ backgroundColor: scheme.colors.accent }}
                />
                <div
                  className="w-6 h-6 rounded"
                  style={{ backgroundColor: scheme.colors.accentLight }}
                />
                <div
                  className="w-6 h-6 rounded border"
                  style={{ backgroundColor: scheme.colors.background, borderColor: scheme.colors.cardStroke }}
                />
              </div>
              <div className="text-sm font-medium" style={{ color: scheme.colors.text }}>
                {scheme.name}
              </div>
            </button>
          ))}

          {/* Custom scheme option */}
          <button
            onClick={() => handleSchemeChange('custom')}
            className={`p-3 rounded-lg border-2 transition-all text-left ${
              currentSchemeId === 'custom'
                ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-2'
                : 'border-dashed border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="flex gap-1 mb-2">
              {customColors ? (
                <>
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: customColors.accent }} />
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: customColors.accentLight }} />
                  <div className="w-6 h-6 rounded border" style={{ backgroundColor: customColors.background, borderColor: customColors.cardStroke }} />
                </>
              ) : (
                <>
                  <div className="w-6 h-6 rounded bg-gradient-to-br from-pink-400 via-purple-400 to-blue-400" />
                  <div className="w-6 h-6 rounded bg-gradient-to-br from-green-400 via-yellow-400 to-orange-400" />
                  <div className="w-6 h-6 rounded border border-gray-300 bg-white flex items-center justify-center text-gray-400 text-xs">+</div>
                </>
              )}
            </div>
            <div className="text-sm font-medium text-gray-700">Custom</div>
          </button>
        </div>

        {/* Custom color editor */}
        {currentSchemeId === 'custom' && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Customize Colors</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { key: 'accent', label: 'Accent' },
                { key: 'accentLight', label: 'Container' },
                { key: 'accentStroke', label: 'Container Border' },
                { key: 'background', label: 'Background' },
                { key: 'cardBg', label: 'Card' },
                { key: 'cardStroke', label: 'Card Border' },
                { key: 'text', label: 'Text' },
                { key: 'textMuted', label: 'Muted Text' },
              ].map(({ key, label }) => {
                const colors = customColors || getSchemeById('classic-blue').colors;
                return (
                  <div key={key}>
                    <label className="block text-xs text-gray-600 mb-1">{label}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={colors[key as keyof ColorScheme['colors']]}
                        onChange={(e) => handleCustomColorChange(key as keyof ColorScheme['colors'], e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                      />
                      <input
                        type="text"
                        value={colors[key as keyof ColorScheme['colors']]}
                        onChange={(e) => handleCustomColorChange(key as keyof ColorScheme['colors'], e.target.value)}
                        className="flex-1 px-2 py-1 text-xs font-mono border border-gray-300 rounded"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="p-4 rounded-lg" style={{ backgroundColor: currentScheme.colors.background }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: currentScheme.colors.text }}>Preview</h3>
          <div className="p-3 rounded-lg" style={{ backgroundColor: currentScheme.colors.accentLight, border: `2px solid ${currentScheme.colors.accentStroke}` }}>
            <div className="text-sm font-bold mb-2" style={{ color: currentScheme.colors.accent }}>
              Saturday, Feb 1
            </div>
            <div className="p-3 rounded" style={{ backgroundColor: currentScheme.colors.cardBg, border: `1px solid ${currentScheme.colors.cardStroke}` }}>
              <div className="font-medium" style={{ color: currentScheme.colors.text }}>Sample Event Title</div>
              <div className="text-sm" style={{ color: currentScheme.colors.textMuted }}>Sample description text here</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
