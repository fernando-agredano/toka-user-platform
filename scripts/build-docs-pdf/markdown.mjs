import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import hljs from 'highlight.js';
import { Marked } from 'marked';
import { ROOT } from './sources.mjs';

const MAX_NUMBERED_LEVEL = 4;
const IMAGE_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml' };

const CALLOUTS = [
  { kind: 'decision', label: 'Decisión clave', pattern: /^\**(decisi[oó]n|por qu[eé]|trade-?off)/i },
  { kind: 'warning', label: 'Advertencia', pattern: /^\**(aviso|advertencia|riesgo|no verificado|ojo|atenci[oó]n|cuidado)/i },
];
const INFO_CALLOUT = { kind: 'info', label: 'Nota' };

export const escapeHtml = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const plainText = (tokens) => tokens.map((token) => token.text ?? token.raw ?? '').join('');

const stripLeadingNumber = (tokens) => {
  const [first] = tokens;
  if (first?.type === 'text') first.text = first.text.replace(/^\d+(?:\.\d+)*\.?\s+/, '');
};

const highlightCode = (code, language) =>
  language && hljs.getLanguage(language)
    ? hljs.highlight(code, { language, ignoreIllegals: true }).value
    : escapeHtml(code);

const localImage = (href, baseDir) => {
  const filePath = resolve(baseDir, href);
  const mime = IMAGE_MIME[extname(filePath).toLowerCase()];
  if (!mime || !filePath.startsWith(ROOT) || !existsSync(filePath)) return null;
  return `data:${mime};base64,${readFileSync(filePath).toString('base64')}`;
};

/**
 * Renders one Markdown document. The document's own H1 is dropped (the section
 * separator replaces it) and H2..H5 become numbered levels `label.1`, `label.1.1`, ...
 * Returns the HTML and the level-1 headings used for the table of contents.
 */
export function renderMarkdown(markdown, { label, baseDir, keepNumbers = false, dropFirstH1 = true }) {
  const counters = Array(MAX_NUMBERED_LEVEL).fill(0);
  const toc = [];
  const state = { titleDropped: !dropFirstH1, lastHeading: '', headingSeq: 0 };

  const renderer = {
    heading({ tokens, depth }) {
      if (!state.titleDropped && depth === 1) {
        state.titleDropped = true;
        return '';
      }
      if (!keepNumbers) stripLeadingNumber(tokens);
      const level = Math.min(Math.max(depth - 1, 1), MAX_NUMBERED_LEVEL);
      counters[level - 1] += 1;
      counters.fill(0, level);
      const number = `${label}.${counters.slice(0, level).join('.')}`;
      const title = plainText(tokens);
      const id = `h-${label}-${state.headingSeq++}`;
      state.lastHeading = title;
      if (level === 1) toc.push({ id, number, text: title });
      return `<h${level + 1} id="${id}"><span class="num">${number}</span>${this.parser.parseInline(tokens)}</h${level + 1}>\n`;
    },

    code({ text, lang }) {
      const language = (lang ?? '').trim().split(/\s+/)[0];
      if (language === 'mermaid') {
        const caption = escapeHtml(state.lastHeading || 'Diagrama');
        return `<figure class="figure diagram"><pre class="mermaid">${escapeHtml(text)}</pre><figcaption>Figura @@FIG@@. ${caption}</figcaption></figure>\n`;
      }
      const tag = language ? `<span class="code-label">${escapeHtml(language)}</span>` : '';
      return `<div class="code-block">${tag}<pre><code class="hljs">${highlightCode(text, language)}</code></pre></div>\n`;
    },

    blockquote({ tokens }) {
      const firstLine = tokens[0]?.raw ?? '';
      const callout = CALLOUTS.find(({ pattern }) => pattern.test(firstLine)) ?? INFO_CALLOUT;
      return `<aside class="callout ${callout.kind}"><span class="callout-label">${callout.label}</span>${this.parser.parse(tokens)}</aside>\n`;
    },

    table(token) {
      const cell = (content, tag) =>
        `<${tag}${content.align ? ` style="text-align:${content.align}"` : ''}>${this.parser.parseInline(content.tokens)}</${tag}>`;
      const head = `<tr>${token.header.map((content) => cell(content, 'th')).join('')}</tr>`;
      const body = token.rows.map((row) => `<tr>${row.map((content) => cell(content, 'td')).join('')}</tr>`).join('');
      return `<table><thead>${head}</thead><tbody>${body}</tbody></table>\n`;
    },

    // Raw HTML in the docs is almost always a placeholder such as <hora>, so show it as text.
    html({ text }) {
      if (/^<br\s*\/?>$/i.test(text.trim())) return '<br>';
      return text.trim().startsWith('<!--') ? '' : escapeHtml(text);
    },

    link({ href, tokens }) {
      const inner = this.parser.parseInline(tokens);
      return /^https?:\/\//.test(href) ? `<a href="${escapeHtml(href)}">${inner}</a>` : inner;
    },

    image({ href, text }) {
      const source = /^https?:\/\//.test(href) ? null : localImage(href, baseDir);
      return source ? `<img src="${source}" alt="${escapeHtml(text)}">` : '';
    },
  };

  const html = new Marked({ gfm: true, renderer }).parse(markdown);
  return { html, toc };
}
