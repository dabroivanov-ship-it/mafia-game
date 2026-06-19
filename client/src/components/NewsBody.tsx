import DOMPurify from 'dompurify';
import { avatarUrl } from '../api';
import NewsBodyMarkdown from './NewsBodyMarkdown';
import { isNewsHtmlBody } from './newsBodyUtils';

export { isEmptyNewsBody, isNewsHtmlBody } from './newsBodyUtils';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'a',
  'img',
];

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class', 'target', 'rel', 'style'];

function sanitizeNewsHtml(html: string): string {
  const safe = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });

  const doc = new DOMParser().parseFromString(safe, 'text/html');
  doc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (src) img.setAttribute('src', avatarUrl(src) ?? src);
  });
  doc.querySelectorAll('a').forEach((a) => {
    a.setAttribute('rel', 'noopener noreferrer');
    if (!a.getAttribute('target')) a.setAttribute('target', '_blank');
  });
  return doc.body.innerHTML;
}

interface NewsBodyProps {
  body: string;
  className?: string;
}

export default function NewsBody({ body, className = 'news-body' }: NewsBodyProps) {
  if (isNewsHtmlBody(body)) {
    const html = sanitizeNewsHtml(body);
    return <div className={`${className} news-body-html`} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return <NewsBodyMarkdown body={body} className={className} />;
}
