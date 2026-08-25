import MarkdownIt from 'markdown-it';

/**
 * markdown-it 实例（模块级单例）。
 * - html:false —— 转义原始 HTML，防止注入；
 * - linkify:true —— 自动识别 URL；
 * - breaks:true —— 单换行转 <br>，与旧渲染一致。
 */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

// 链接统一新窗口打开
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx];
  const href = String(token.attrGet('href') ?? '');
  // 兜底阻断危险协议（markdown-it 默认已拦截 javascript:/vbscript:/file:/data:）
  if (/^(javascript|vbscript|file):/i.test(href.trim())) {
    token.attrSet('href', '#');
  }
  token.attrSet('target', '_blank');
  token.attrSet('rel', 'noreferrer noopener');
  // markdown-it v14+ 已移除 link_open 的默认渲染规则，
  // 需直接用 renderToken 渲染 <a> 开标签（即无自定义规则时的默认兜底行为）。
  return self.renderToken(tokens, idx, options);
};

/** Markdown 渲染器（markdown-it），用于渲染 Agent 生成的报告 */
export function Markdown({ text }: { text: string }) {
  const html = md.render(text);
  return (
    <div
      className="markdown-body"
      // html:false 已转义原始 HTML，且链接协议已校验，可安全注入
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
