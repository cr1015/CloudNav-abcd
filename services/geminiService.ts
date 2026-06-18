import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AIConfig } from "../types";

/**
 * 规范化 OpenAI 兼容接口的请求地址，兼容用户填写的多种形式：
 *   · 已含 /chat/completions    → 原样使用
 *   · 含版本段 /v1、/v4 等       → 追加 /chat/completions（如 deepseek /v1、智谱 /v4）
 *   · 纯域名（无版本段）         → 追加 /v1/chat/completions（如 api.openai.com）
 *   · 为空                       → 使用 OpenAI 官方默认地址
 * 修复点：原实现对纯域名会拼成 缺 /v1 的非法路径，导致 404。
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
 * 失败统一返回空串（而非错误提示文字），避免上层把错误文字误当成生成内容写入描述框。
 */
const callOpenAICompatible = async (config: AIConfig, systemPrompt: string, userPrompt: string): Promise<string> => {
    try {
        const endpoint = normalizeOpenAIBaseUrl(config.baseUrl);
        // 模型缺省，与设置面板 placeholder 保持一致（原实现缺省为空，会触发 400）
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
 * 生成链接描述。
 * 成功返回描述文本；失败（含未配置 key、API 报错、网络异常）一律返回空串，
 * 由调用方决定如何提示用户，避免把错误文字写进描述框。
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
    if (config.provider === 'gemini') {
        const ai = new GoogleGenAI({ apiKey: config.apiKey });
        // Use user defined model or fallback
        const modelName = config.model || 'gemini-2.5-flash';

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: modelName,
            contents: `I have a website bookmark. ${prompt}`,
        });
        return response.text ? response.text.trim() : "";
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
        if (config.provider === 'gemini') {
            const ai = new GoogleGenAI({ apiKey: config.apiKey });
            const modelName = config.model || 'gemini-2.5-flash';

            const response: GenerateContentResponse = await ai.models.generateContent({
                model: modelName,
                contents: `Task: Categorize this website.\n${prompt}`,
            });
            return response.text ? response.text.trim() : null;
        } else {
            // OpenAI 兼容
            return await callOpenAICompatible(
                config,
                "You are an intelligent classification assistant. You only output the category ID.",
                prompt
            ) || null;
        }
    } catch (e) {
        console.error(e);
        return null;
    }
}
