// 文字图标生成工具：自制图标与加载兜底共用同一套 SVG 生成逻辑

// 自制文字图标：预设背景色
export const ICON_PRESET_COLORS = [
  '#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6',
  '#ec4899', '#06b6d4', '#6366f1', '#f43f5e', '#14b8a6',
  '#0ea5e9', '#84cc16', '#f97316', '#64748b', '#111827',
];

// 兜底图标背景色（紫色）
export const FALLBACK_BG = '#8b5cf6';

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 根据背景色亮度自动选文字颜色（黑/白），保证可读对比
export const pickContrastFg = (hex: string): string => {
  const h = hex.replace('#', '');
  if (h.length < 6) return '#ffffff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return '#ffffff';
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150 ? '#111827' : '#ffffff';
};

// 生成文字图标（SVG data URI），1-3 个字符，中英文均可
export const makeTextIcon = (rawText: string, bg: string): string => {
  const chars = [...rawText.trim()].slice(0, 3);
  if (chars.length === 0) return '';
  const text = escapeXml(chars.join(''));
  const fontSize = chars.length >= 3 ? 40 : chars.length === 2 ? 56 : 76;
  const fg = pickContrastFg(bg);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">` +
    `<rect width="128" height="128" rx="28" fill="${bg}"/>` +
    `<text x="50%" y="50%" dy="0.35em" font-family="'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Segoe UI',Roboto,Arial,sans-serif" font-size="${fontSize}" font-weight="700" fill="${fg}" text-anchor="middle">${text}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// 兜底图标：紫色背景 + 标题前 3 个字符（图标获取不到或加载失败时使用）
export const makeFallbackIcon = (title: string): string => {
  const text = [...(title || '').trim()].slice(0, 3).join('');
  return makeTextIcon(text || '?', FALLBACK_BG);
};
