import type { ReactNode } from 'react';
import { avatarUrl } from '../api';

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|!\[[^\]]*\]\([^)]+\))/g;
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
    } else {
      const imgMatch = token.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imgMatch) {
        const src = avatarUrl(imgMatch[2]) ?? imgMatch[2];
        parts.push(
          <figure key={key++} className="news-inline-figure">
            <img src={src} alt={imgMatch[1] || ''} className="news-inline-image" loading="lazy" />
            {imgMatch[1] ? <figcaption className="muted">{imgMatch[1]}</figcaption> : null}
          </figure>
        );
      } else {
        parts.push(<span key={key++}>{token}</span>);
      }
    }
    last = match.index + token.length;
  }

  if (last < text.length) {
    parts.push(<span key={key++}>{text.slice(last)}</span>);
  }
  return parts;
}

interface NewsBodyProps {
  body: string;
  className?: string;
}

export default function NewsBody({ body, className = 'news-body' }: NewsBodyProps) {
  const paragraphs = body.split(/\n{2,}/).filter((p) => p.trim());

  return (
    <div className={className}>
      {paragraphs.map((para, i) => (
        <p key={i}>{renderInline(para.replace(/\n/g, ' '))}</p>
      ))}
    </div>
  );
}
