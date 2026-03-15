import OpenAI from 'openai';
import type { Answers, GrantCard } from './match';

function stripCodeFences(s: string) {
  if (!s) return s;
  // ```html ... ```
  const m = s.match(/```(?:html)?([\s\S]*?)```/i);
  if (m) return m[1].trim();
  return s.trim();
}

function ensureFullHtml(html: string) {
  if (/<html[\s\S]*<\/html>/i.test(html)) return html;
  // wrap fragments in a clean document
  return `<!doctype html><html><head><meta charset="utf-8"/></head><body>${html}</body></html>`;
}

export async function polishGrantLetter(
  html: string,
  a: Answers,
  cards: GrantCard[]
) {
  if (!process.env.OPENAI_API_KEY) return html;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const system = `You are editing a grant letter. 
Return RAW HTML ONLY — no Markdown, no backticks, no explanations.
Preserve tags and factual details (program names, amounts, links). Keep 150–220 words before bullets.`;

  const resp = await openai.responses.create({
    model: 'gpt-4o-mini',
    input: [
      { role: 'system', content: system },
      {
        role: 'user',
        content:
          `User answers:\n${JSON.stringify(a)}\nShortlist:\n${JSON.stringify(
            cards
          )}\n` + `Rewrite this HTML, returning RAW HTML ONLY:\n\n${html}`,
      },
    ],
    max_output_tokens: 1200,
    temperature: 0.5,
  });

  let out = resp.output_text || html;
  out = stripCodeFences(out); // remove ```html fences (CommonMark “fenced code blocks”). :contentReference[oaicite:0]{index=0}
  out = ensureFullHtml(out);
  return out || html;
}
