import { AIConfig } from "../types";

/**
 * 规范化 OpenAI 兼容接口的请求地址，兼容用户填写的多种形式：
 *   · 已含 /chat/completions    → 原样使用
 *   · 含版本段 /v1、/v4 等       → 追加 /chat/completions（如 deepseek /v1、智谱 /v4）
 *   · 纯域名（无版本段）         → 追加 /v1/chat/completions（如 api.openai.com）
 *   · 为空                       → 使用 OpenAI 官方默认地址
 */
const normalizeOpenAIBaseUrl = (raw: string): string => {
    const baseUrl = (raw || '').trim().replace(/\/+$/, '');
    if (!baseUrl) return 'https://api.openai.com/v1/chat/completions';
    if (/\/chat\/completions$/.test(baseUrl)) return baseUrl;
    if (/\/v\d+(?=\/?$)/.test(baseUrl)) return baseUrl + '/chat/completions';
    return baseUrl + '/v1/chat/completions';
};

/**
 * 调用 OpenAI 兼容 API。
 * 失败统一返回空串，避免上层把错误文字误当成生成内容写入描述框。
 * API Key 仅随此请求发往用户配置的 endpoint，不经过任何第三方。
 */
const callOpenAICompatible = async (config: AIConfig, systemPrompt: string, userPrompt: string): Promise<string> => {
    try {
        const endpoint = normalizeOpenAIBaseUrl(config.baseUrl);
        const model = config.model || 'gpt-3.5-turbo';

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            console.error(`OpenAI API Error [${response.status}] ${endpoint}:`, errText);
            return "";
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || "";
    } catch (e) {
        console.error("OpenAI Call Failed", e);
        return "";
    }
};

/**
 * 调用 Anthropic Messages API（浏览器直连）。
 * 通过 anthropic-dangerous-direct-browser-access 头开启官方支持的浏览器跨域直连。
 * API Key 仅随此请求发往 api.anthropic.com，不经过任何第三方/中间服务器。
 */
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const callAnthropic = async (config: AIConfig, systemPrompt: string, userPrompt: string): Promise<string> => {
    try {
        const model = config.model || 'claude-3-5-haiku-20241022';

        const response = await fetch(ANTHROPIC_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01',
                // 官方支持的浏览器直连开关；否则浏览器跨域请求会被拒绝
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model,
                max_tokens: 120,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }]
            })
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            console.error(`Anthropic API Error [${response.status}]:`, errText);
            return "";
        }

        const data = await response.json();
        return data.content?.[0]?.text?.trim() || "";
    } catch (e) {
        console.error("Anthropic Call Failed", e);
        return "";
    }
};

/**
 * 生成链接描述。成功返回文本；失败一律返回空串，由调用方决定如何提示。
 */
export const generateLinkDescription = async (title: string, url: string, config: AIConfig): Promise<string> => {
  if (!config.apiKey) {
    return "";
  }

  const prompt = `
      Title: ${title}
      URL: ${url}
      Please write a very short description (max 15 words) in Chinese (Simplified) that explains what this website is for. Return ONLY the description text. No quotes.
  `;

  try {
    if (config.provider === 'anthropic') {
        return await callAnthropic(
            config,
            "You are a helpful assistant that summarizes website bookmarks.",
            prompt
        );
    } else {
        // OpenAI 兼容
        return await callOpenAICompatible(
            config,
            "You are a helpful assistant that summarizes website bookmarks.",
            prompt
        );
    }
  } catch (error) {
    console.error("AI generation error:", error);
    return "";
  }
};

/**
 * 推荐分类。成功返回分类 id，失败返回 null。
 */
export const suggestCategory = async (title: string, url: string, categories: {id: string, name: string}[], config: AIConfig): Promise<string | null> => {
    if (!config.apiKey) return null;

    const catList = categories.map(c => `${c.id}: ${c.name}`).join('\n');
    const prompt = `
        Website: "${title}" (${url})

        Available Categories:
        ${catList}

        Return ONLY the 'id' of the best matching category. If unsure, return 'common'.
    `;

    try {
        const result = config.provider === 'anthropic'
            ? await callAnthropic(
                config,
                "You are an intelligent classification assistant. You only output the category ID.",
                prompt
            )
            : await callOpenAICompatible(
                config,
                "You are an intelligent classification assistant. You only output the category ID.",
                prompt
            );
        return result || null;
    } catch (e) {
        console.error(e);
        return null;
    }
}
