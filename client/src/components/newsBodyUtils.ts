export function isNewsHtmlBody(body: string): boolean {
  return body.trim().startsWith('<');
}

export function isEmptyNewsBody(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return true;

  if (isNewsHtmlBody(trimmed)) {
    const div = document.createElement('div');
    div.innerHTML = trimmed;
    const hasMedia = !!div.querySelector('img, video, iframe');
    const text = (div.textContent || '').replace(/\u00a0/g, ' ').trim();
    return !text && !hasMedia;
  }

  return !trimmed;
}
