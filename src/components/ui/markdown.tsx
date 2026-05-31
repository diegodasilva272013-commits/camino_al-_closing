import { Fragment, type JSX } from 'react';

/**
 * Renderer markdown minimalista (sin deps externas).
 * Soporta:
 *  - **bold**, *italic* (o _italic_), `code`
 *  - [text](https://url) — solo http/https
 *  - listas con "- " o "* "
 *  - separación por líneas en blanco -> párrafos
 * Auto-escapa HTML. URLs no http(s) son ignoradas.
 */

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function renderInline(text: string, keyBase: string): JSX.Element[] {
  // Strategy: tokenize via regex with named groups, fallback to plain text.
  const safe = escape(text);
  const tokens: Array<{ kind: string; value: string; href?: string }> = [];
  const regex =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|`([^`]+)`/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(safe)) !== null) {
    if (m.index > cursor) {
      tokens.push({ kind: 'text', value: safe.slice(cursor, m.index) });
    }
    if (m[1] !== undefined && m[2] !== undefined) {
      tokens.push({ kind: 'link', value: m[1], href: m[2] });
    } else if (m[3] !== undefined) {
      tokens.push({ kind: 'bold', value: m[3] });
    } else if (m[4] !== undefined) {
      tokens.push({ kind: 'italic', value: m[4] });
    } else if (m[5] !== undefined) {
      tokens.push({ kind: 'italic', value: m[5] });
    } else if (m[6] !== undefined) {
      tokens.push({ kind: 'code', value: m[6] });
    }
    cursor = regex.lastIndex;
  }
  if (cursor < safe.length) {
    tokens.push({ kind: 'text', value: safe.slice(cursor) });
  }

  return tokens.map((t, i) => {
    const k = `${keyBase}-${i}`;
    if (t.kind === 'link' && t.href && isSafeUrl(t.href)) {
      return (
        <a
          key={k}
          href={t.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-gold underline hover:opacity-80"
        >
          <span dangerouslySetInnerHTML={{ __html: t.value }} />
        </a>
      );
    }
    if (t.kind === 'bold') {
      return (
        <strong key={k} dangerouslySetInnerHTML={{ __html: t.value }} />
      );
    }
    if (t.kind === 'italic') {
      return <em key={k} dangerouslySetInnerHTML={{ __html: t.value }} />;
    }
    if (t.kind === 'code') {
      return (
        <code
          key={k}
          className="rounded bg-white/10 px-1 py-0.5 text-[0.85em]"
          dangerouslySetInnerHTML={{ __html: t.value }}
        />
      );
    }
    return <Fragment key={k}><span dangerouslySetInnerHTML={{ __html: t.value }} /></Fragment>;
  });
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  if (!source) return null;
  // Split paragraphs by blank lines, preserving single newlines within paragraphs.
  const blocks = source.split(/\n\s*\n/);
  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        const isList = lines.every((l) => /^\s*[-*]\s+/.test(l));
        if (isList) {
          return (
            <ul key={bi} className="list-disc space-y-0.5 pl-5">
              {lines.map((l, i) => (
                <li key={i}>{renderInline(l.replace(/^\s*[-*]\s+/, ''), `${bi}-${i}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className={bi > 0 ? 'mt-2' : undefined}>
            {lines.map((l, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {renderInline(l, `${bi}-${i}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
