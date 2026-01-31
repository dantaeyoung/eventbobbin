// Generate a consistent pastel color based on tag string
export function getTagColor(tag: string): { bg: string; text: string } {
  const colors = [
    { bg: '#e8d5f2', text: '#6b5b7a' }, // lavender
    { bg: '#d5e8f2', text: '#5b6b7a' }, // light blue
    { bg: '#f2e8d5', text: '#7a6b5b' }, // cream
    { bg: '#d5f2e8', text: '#5b7a6b' }, // mint
    { bg: '#f2d5e8', text: '#7a5b6b' }, // pink
    { bg: '#e8f2d5', text: '#6b7a5b' }, // lime
    { bg: '#d5d5f2', text: '#5b5b7a' }, // periwinkle
    { bg: '#f2d5d5', text: '#7a5b5b' }, // rose
  ];
  let hash = 0;
  const normalizedTag = tag.trim().toLowerCase();
  for (let i = 0; i < normalizedTag.length; i++) {
    hash = normalizedTag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Get darker version of color for selected state
export function getTagColorSelected(tag: string): { bg: string; text: string } {
  const colors = [
    { bg: '#c9a8db', text: '#ffffff' }, // lavender selected
    { bg: '#a8c9db', text: '#ffffff' }, // light blue selected
    { bg: '#dbc9a8', text: '#ffffff' }, // cream selected
    { bg: '#a8dbc9', text: '#ffffff' }, // mint selected
    { bg: '#dba8c9', text: '#ffffff' }, // pink selected
    { bg: '#c9dba8', text: '#ffffff' }, // lime selected
    { bg: '#a8a8db', text: '#ffffff' }, // periwinkle selected
    { bg: '#dba8a8', text: '#ffffff' }, // rose selected
  ];
  let hash = 0;
  const normalizedTag = tag.trim().toLowerCase();
  for (let i = 0; i < normalizedTag.length; i++) {
    hash = normalizedTag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
