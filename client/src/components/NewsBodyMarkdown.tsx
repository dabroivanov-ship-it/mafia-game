import type { ReactNode } from 'react';
import { avatarUrl } from '../api';

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re =
    /(\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|\+\+[^+]+\+\+|`[^`]+`|\[[^\]]+\]\([^)]+\)|!\[[^\]]*\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<span key={key++}>{text.slice(last, match.index)}</span>);
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('~~')) {
      parts.push(<s key={key++}>{token.slice(2, -2)}</s>);
    } else if (token.startsWith('++')) {
      parts.push(<u key={key++}>{token.slice(2, -2)}</u>);
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={key++} className="news-inline-code">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('![')) {
      const imgMatch = token.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imgMatch) {
        const src = avatarUrl(imgMatch[2]) ?? imgMatch[2];
        parts.push(
          <figure key={key++} className="news-inline-figure">
            <img src={src} alt={imgMatch[1] || ''} className="news-inline-image" loading="lazy" />
            {imgMatch[1] ? <figcaption className="muted">{imgMatch[1]}</figcaption> : null}
          </figure>
        );
      }
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        parts.push(
          <a key={key++} href={linkMatch[2]} target="_blank" rel="noreferrer noopener">
            {linkMatch[1]}
          </a>
        );
      }
    } else {
      parts.push(<span key={key++}>{token}</span>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) {
    parts.push(<span key={key++}>{text.slice(last)}</span>);
  }
  return parts;
}

function renderBlock(block: string, key: number): ReactNode {
  const trimmed = block.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(':::center') && trimmed.endsWith(':::')) {
    const inner = trimmed.replace(/^:::center\s*/, '').replace(/\s*:::$/, '');
    return (
      <p key={key} className="news-align-center">
        {renderInline(inner.replace(/\n/g, ' '))}
      </p>
    );
  }

  if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
    const code = trimmed.slice(3, -3).replace(/^\n/, '');
    return (
      <pre key={key} className="news-code-block">
        <code>{code}</code>
      </pre>
    );
  }

  const lines = trimmed.split('\n');
  if (lines.every((l) => /^-\s+/.test(l.trim()))) {
    return (
      <ul key={key} className="news-list">
        {lines.map((line, i) => (
          <li key={i}>{renderInline(line.trim().replace(/^-\s+/, ''))}</li>
        ))}
      </ul>
    );
  }

  if (lines.every((l) => /^\d+\.\s+/.test(l.trim()))) {
    return (
      <ol key={key} className="news-list">
        {lines.map((line, i) => (
          <li key={i}>{renderInline(line.trim().replace(/^\d+\.\s+/, ''))}</li>
        ))}
      </ol>
    );
  }

  if (lines.every((l) => /^>\s?/.test(l))) {
    return (
      <blockquote key={key} className="news-blockquote">
        {lines.map((line, i) => (
          <p key={i}>{renderInline(line.replace(/^>\s?/, ''))}</p>
        ))}
      </blockquote>
    );
  }

  const first = lines[0];
  if (first.startsWith('### ')) return <h3 key={key}>{renderInline(first.slice(4))}</h3>;
  if (first.startsWith('## ')) return <h2 key={key}>{renderInline(first.slice(3))}</h2>;
  if (first.startsWith('# ')) return <h1 key={key}>{renderInline(first.slice(2))}</h1>;

  return <p key={key}>{renderInline(trimmed.replace(/\n/g, ' '))}</p>;
}

interface NewsBodyMarkdownProps {
  body: string;
  className?: string;
}

/** Legacy markdown renderer for older news posts. */
export default function NewsBodyMarkdown({ body, className = 'news-body' }: NewsBodyMarkdownProps) {
  const blocks = body.split(/\n{2,}/).filter((p) => p.trim());
  return (
    <div className={className}>
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}
