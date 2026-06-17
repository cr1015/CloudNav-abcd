// 高清图标抓取端点：真正访问书签站点，解析 HTML 中最高清的图标链接
// 优先级：SVG 矢量 > apple-touch-icon(180) > 大尺寸 favicon > favicon.ico > Google 服务回退
// 解决 gstatic size=256 对多数站点只是放大低清图标导致发虚的问题

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
};

// 处理 OPTIONS 预检
export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

interface IconCandidate {
  href: string;
  score: number;
}

// 从 HTML 中提取 <link> 图标候选并打分
function extractIconCandidates(html: string): IconCandidate[] {
  const candidates: IconCandidate[] = [];
  const linkTags = html.match(/<link\b[^>]*>/gi) || [];

  const getAttr = (tag: string, name: string): string | null => {
    const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
    return m ? m[1] : null;
  };

  for (const tag of linkTags) {
    const rel = (getAttr(tag, 'rel') || '').toLowerCase();
    // 只关心图标类 link
    if (!/icon|apple-touch|mask-icon|fluid-icon|shortcut/.test(rel)) continue;

    const href = getAttr(tag, 'href');
    if (!href || href.startsWith('data:')) continue;

    const sizes = (getAttr(tag, 'sizes') || '').toLowerCase();
    const type = (getAttr(tag, 'type') || '').toLowerCase();
    const isSvg = type === 'image/svg+xml' || href.toLowerCase().endsWith('.svg') || sizes === 'any';

    // 计算面积（缺省按常见规格估值）
    let area: number;
    if (sizes === 'any') {
      area = 1000000; // 矢量，理论上无限清晰
    } else {
      const m = sizes.match(/(\d+)\s*[x×]\s*(\d+)/);
      if (m) {
        area = parseInt(m[1], 10) * parseInt(m[2], 10);
      } else if (rel.includes('apple-touch')) {
        area = 180 * 180; // apple-touch-icon 标准尺寸
      } else if (rel.includes('mask-icon')) {
        area = 500 * 500;
      } else {
        area = 32 * 32; // 普通 favicon
      }
    }

    // 综合评分：矢量最高，apple-touch 次之，再按面积
    let score = area;
    if (isSvg) score += 50_000_000;
    if (rel.includes('apple-touch')) score += 200_000;
    if (rel === 'icon' || rel.includes('shortcut')) score += 50_000;

    candidates.push({ href, score });
  }

  return candidates;
}

// 取得分最高的图标，解析为绝对 URL
function pickBestIcon(html: string, baseUrl: URL): string | null {
  const candidates = extractIconCandidates(html);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  try {
    return new URL(candidates[0].href, baseUrl).href;
  } catch {
    return null;
  }
}

export const onRequestGet = async (context: { request: Request }) => {
  const { request } = context;
  const u = new URL(request.url);
  const target = u.searchParams.get('url');

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  if (!target) {
    return json({ error: 'url 参数必填' }, 400);
  }

  // 解析目标 URL
  let targetUrl: URL;
  try {
    targetUrl = new URL(target.startsWith('http') ? target : 'https://' + target);
  } catch {
    return json({ icon: null, source: 'invalid-url' });
  }
  const domain = targetUrl.hostname;

  // Google 服务高清回退
  const gstaticFallback = `https://t3.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=256&url=https://${domain}`;

  // 1) 抓取站点 HTML，解析最高清图标
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(targetUrl.href, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const html = await res.text();
      const best = pickBestIcon(html, targetUrl);
      if (best) {
        return json({ icon: best, source: 'site' });
      }
    }
  } catch {
    // 抓取失败，进入回退
  }

  // 2) 尝试站点根 favicon.ico
  try {
    const favRes = await fetch(`https://${domain}/favicon.ico`, {
      method: 'GET',
      redirect: 'follow',
    });
    if (favRes.ok) {
      return json({ icon: `https://${domain}/favicon.ico`, source: 'favicon-ico' });
    }
  } catch {
    // 忽略
  }

  // 3) 最终回退：Google 高清 favicon 服务
  return json({ icon: gstaticFallback, source: 'gstatic' });
};
