import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import AsciiBackground from './components/AsciiBackground';
import changelog from '../changelog.md?raw';
import docsEn from '../docs.md?raw';
import docsId from '../docs.id.md?raw';
import './Docs.css';

const DOCS = {
  en: docsEn,
  id: docsId,
};

const LANG_LABELS = {
  en: 'EN',
  id: 'ID',
};

const VIEW_LABELS = {
  docs: 'docs',
  changelog: 'changelog',
};

function parseInline(text) {
  const parts = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('`')) {
      parts.push({ type: 'code', text: token.slice(1, -1) });
    } else {
      parts.push({ type: 'strong', text: token.slice(2, -2) });
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function renderInline(text, keyPrefix) {
  return parseInline(text).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (typeof part === 'string') return part;
    if (part.type === 'code') return <code key={key}>{part.text}</code>;
    return <strong key={key}>{part.text}</strong>;
  });
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function parseMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      const language = fence[1] || '';
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ type: 'code', language, text: code.join('\n') });
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        text: heading[2].trim(),
      });
      index += 1;
      continue;
    }

    if (
      line.trim().startsWith('|') &&
      index + 1 < lines.length &&
      isTableSeparator(lines[index + 1])
    ) {
      const header = splitTableRow(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length) {
        if (/^\s*[-*]\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\s*[-*]\s+/, '').trim());
          index += 1;
          continue;
        }

        if (/^\s{2,}\S/.test(lines[index]) && items.length) {
          items[items.length - 1] = `${items[items.length - 1]} ${lines[index].trim()}`;
          index += 1;
          continue;
        }

        break;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length) {
        if (/^\s*\d+\.\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\s*\d+\.\s+/, '').trim());
          index += 1;
          continue;
        }

        if (/^\s{2,}\S/.test(lines[index]) && items.length) {
          items[items.length - 1] = `${items[items.length - 1]} ${lines[index].trim()}`;
          index += 1;
          continue;
        }

        break;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^```/.test(lines[index]) &&
      !/^(#{1,4})\s+/.test(lines[index]) &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index]) &&
      !(lines[index].trim().startsWith('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1]))
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
}

function MarkdownDoc({ markdown }) {
  const blocks = parseMarkdown(markdown);
  const contentBlocks = blocks[0]?.type === 'heading' && blocks[0].level === 1
    ? blocks.slice(1)
    : blocks;

  return (
    <article className="docs-markdown">
      {contentBlocks.map((block, blockIndex) => {
        if (block.type === 'heading') {
          const Heading = `h${Math.min(block.level + 1, 4)}`;
          return (
            <Heading key={`heading-${blockIndex}`}>
              {renderInline(block.text, `heading-${blockIndex}`)}
            </Heading>
          );
        }

        if (block.type === 'paragraph') {
          return (
            <p key={`paragraph-${blockIndex}`}>
              {renderInline(block.text, `paragraph-${blockIndex}`)}
            </p>
          );
        }

        if (block.type === 'list') {
          const List = block.ordered ? 'ol' : 'ul';
          return (
            <List key={`list-${blockIndex}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`list-${blockIndex}-${itemIndex}`}>
                  {renderInline(item, `list-${blockIndex}-${itemIndex}`)}
                </li>
              ))}
            </List>
          );
        }

        if (block.type === 'table') {
          return (
            <div className="docs-table-wrap" key={`table-${blockIndex}`}>
              <table>
                <thead>
                  <tr>
                    {block.header.map((cell, cellIndex) => (
                      <th key={`table-${blockIndex}-h-${cellIndex}`}>
                        {renderInline(cell, `table-${blockIndex}-h-${cellIndex}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`table-${blockIndex}-r-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`table-${blockIndex}-r-${rowIndex}-${cellIndex}`}>
                          {renderInline(cell, `table-${blockIndex}-r-${rowIndex}-${cellIndex}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <pre
            className={block.language ? `language-${block.language}` : undefined}
            key={`code-${blockIndex}`}
          >
            {block.language && <span className="docs-code-lang">{block.language}</span>}
            <code>{block.text}</code>
          </pre>
        );
      })}
    </article>
  );
}

export default function Docs({ art, onBack }) {
  const panelRef = useRef(null);
  const modalRef = useRef(null);
  const expandButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [rect, setRect] = useState(null);
  const [language, setLanguage] = useState('en');
  const [activeView, setActiveView] = useState('docs');
  const [expanded, setExpanded] = useState(false);
  const markdown = activeView === 'docs' ? DOCS[language] : changelog;
  const title = activeView === 'docs' ? 'docs/' : 'changelog/';

  useLayoutEffect(() => {
    const measure = () => {
      const el = panelRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ x: r.left, y: r.top, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [art]);

  // Re-measure once the art has rendered (panel size can shift with layout).
  useEffect(() => {
    const id = window.setTimeout(() => {
      const el = panelRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ x: r.left, y: r.top, width: r.width, height: r.height });
    }, 0);
    return () => window.clearTimeout(id);
  }, [art]);

  useEffect(() => {
    if (!expanded) return undefined;

    closeButtonRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setExpanded(false);
        expandButtonRef.current?.focus();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = modalRef.current?.querySelectorAll('button');
      if (!focusable?.length) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded]);

  useEffect(() => {
    document.querySelectorAll('.docs-content').forEach((node) => {
      node.scrollTop = 0;
    });
  }, [activeView, language]);

  const closeExpanded = () => {
    setExpanded(false);
    expandButtonRef.current?.focus();
  };

  const renderSurface = (isExpanded = false) => (
    <>
      <button
        type="button"
        className="docs-tab docs-tab--back"
        onClick={onBack}
      >
        [back]
      </button>

      <div className="docs-actions" aria-label="Documentation controls">
        <div className="docs-view-tabs" aria-label="Content">
          <button
            type="button"
            className="docs-control"
            onClick={() => setActiveView(activeView === 'docs' ? 'changelog' : 'docs')}
          >
            [{VIEW_LABELS[activeView === 'docs' ? 'changelog' : 'docs']}]
          </button>
        </div>
        {activeView === 'docs' && (
          <div className="docs-language" aria-label="Language">
            {Object.keys(DOCS).map((lang) => (
              <button
                type="button"
                key={lang}
                className={`docs-control ${language === lang ? 'docs-control--active' : ''}`}
                onClick={() => setLanguage(lang)}
                aria-pressed={language === lang}
              >
                [{LANG_LABELS[lang]}]
              </button>
            ))}
          </div>
        )}
        {isExpanded ? (
          <button
            type="button"
            ref={closeButtonRef}
            className="docs-control"
            onClick={closeExpanded}
          >
            [close]
          </button>
        ) : (
          <button
            type="button"
            ref={expandButtonRef}
            className="docs-control"
            onClick={() => setExpanded(true)}
          >
            [expand]
          </button>
        )}
      </div>

      <div className="docs-content">
        <h1 className="docs-title">{title}</h1>
        <MarkdownDoc markdown={markdown} />
      </div>
    </>
  );

  return (
    <>
      {art && <AsciiBackground art={art} excludeRect={rect} />}

      <main className="docs" aria-hidden={expanded}>
        <div className="docs-panel" ref={panelRef}>
          {renderSurface(false)}
        </div>
      </main>

      {expanded && (
        <div
          className="docs-modal"
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={activeView === 'docs' ? 'Documentation' : 'Changelog'}
        >
          <div className="docs-panel docs-panel--expanded">
            {renderSurface(true)}
          </div>
        </div>
      )}
    </>
  );
}
