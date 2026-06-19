import { useEffect, useRef } from 'react';
import './AsciiBackground.css';

export default function AsciiBackground({
  art,
  glitch = false,
  flashlightOff = false,
  excludeRect = null,
  recolor = false,
  recolorOrigin = null,
}) {
  const maskGroupRef = useRef(null);
  const circleRef = useRef(null);
  const maskLayerRef = useRef(null);
  const pointerRef = useRef({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
  const glitchRef = useRef(glitch);

  useEffect(() => {
    glitchRef.current = glitch;
  }, [glitch]);

  useEffect(() => {
    const group = maskGroupRef.current;
    if (!group) return;

    const update = (x, y) => {
      pointerRef.current = { x, y };
      if (!glitchRef.current) {
        group.setAttribute('transform', `translate(${x}, ${y})`);
      }
    };

    const onMove = (e) => update(e.clientX, e.clientY);
    const onLeave = () => update(-9999, -9999);

    update(pointerRef.current.x, pointerRef.current.y);

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  useEffect(() => {
    const layer = maskLayerRef.current;
    if (!layer) return;
    layer.classList.toggle('ascii-mask-layer--off', flashlightOff && !glitch);
  }, [flashlightOff, glitch]);

  useEffect(() => {
    const group = maskGroupRef.current;
    const circle = circleRef.current;
    const layer = maskLayerRef.current;
    if (!group || !circle || !layer) return;

    if (!glitch) {
      layer.classList.remove('ascii-mask-layer--glitch');
      circle.setAttribute('r', '380');
      const { x, y } = pointerRef.current;
      group.setAttribute('transform', `translate(${x}, ${y})`);
      return;
    }

    layer.classList.add('ascii-mask-layer--glitch');

    let timeoutId;

    const tick = () => {
      const { x, y } = pointerRef.current;
      const off = Math.random() < 0.1;
      const jitterX = (Math.random() - 0.5) * 90;
      const jitterY = (Math.random() - 0.5) * 90;
      const radius = off ? 0 : 320 + Math.random() * 120;

      group.setAttribute(
        'transform',
        off ? 'translate(-9999, -9999)' : `translate(${x + jitterX}, ${y + jitterY})`,
      );
      circle.setAttribute('r', String(radius));

      timeoutId = window.setTimeout(tick, 170 + Math.random() * 210);
    };

    tick();

    return () => {
      window.clearTimeout(timeoutId);
      layer.classList.remove('ascii-mask-layer--glitch');
      circle.setAttribute('r', '380');
      const { x, y } = pointerRef.current;
      group.setAttribute('transform', `translate(${x}, ${y})`);
    };
  }, [glitch]);

  if (!art) return null;

  return (
    <div className="ascii-bg" aria-hidden="true">
      <svg className="ascii-mask-defs" width="0" height="0">
        <defs>
          <radialGradient id="spotlightGradient">
            <stop offset="0%" stopColor="white" />
            <stop offset="100%" stopColor="black" />
          </radialGradient>

          <mask id="spotlightMask" maskContentUnits="userSpaceOnUse">
            <g ref={maskGroupRef}>
              <circle ref={circleRef} r="380" fill="url(#spotlightGradient)" />
            </g>
            {excludeRect && (
              <rect
                x={excludeRect.x}
                y={excludeRect.y}
                width={excludeRect.width}
                height={excludeRect.height}
                fill="black"
              />
            )}
          </mask>
        </defs>
      </svg>

      <pre className="ascii-art ascii-art--faint">{art}</pre>

      <div ref={maskLayerRef} className="ascii-mask-layer">
        <pre className="ascii-art ascii-art--bright">{art}</pre>
      </div>

      <div
        className={`ascii-recolor-layer ${recolor ? 'ascii-recolor-layer--on' : ''}`}
        style={{
          '--rc-x': `${recolorOrigin ? recolorOrigin.x : window.innerWidth / 2}px`,
          '--rc-y': `${recolorOrigin ? recolorOrigin.y : window.innerHeight / 2}px`,
        }}
      >
        <pre className="ascii-art ascii-art--orange">{art}</pre>
      </div>
    </div>
  );
}
