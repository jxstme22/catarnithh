import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import AsciiBackground from './components/AsciiBackground';
import './Docs.css';

export default function Docs({ art, onBack }) {
  const panelRef = useRef(null);
  const [rect, setRect] = useState(null);

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

  return (
    <>
      {art && <AsciiBackground art={art} excludeRect={rect} />}

      <main className="docs">
        <div className="docs-panel" ref={panelRef}>
          <button
            type="button"
            className="docs-tab docs-tab--back"
            onClick={onBack}
          >
            [back]
          </button>
          <span className="docs-tab docs-tab--title">[docs]</span>

          <div className="docs-content">
            <p>ctarnith — a terminal trading for Pump.Fun's Mayhem mode.</p>
            <p>Docs coming soon.</p>
          </div>
        </div>
      </main>
    </>
  );
}
