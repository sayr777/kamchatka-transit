import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

const SIDE_CLASS = {
  left: styles.sideLeft,
  bottom: styles.sideBottom,
  top: styles.sideTop,
};

function canUseHover() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export default function Tooltip({ label, side = 'left', children, className = '' }) {
  const hostRef = useRef(null);
  const tipId = useId();
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const hoverRef = useRef(canUseHover());

  const updatePosition = useCallback(() => {
    const el = hostRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = side === 'left' ? 10 : 8;
    if (side === 'left') {
      setCoords({ top: rect.top + rect.height / 2, left: rect.left - gap });
    } else if (side === 'bottom') {
      setCoords({ top: rect.bottom + gap, left: rect.left + rect.width / 2 });
    } else {
      setCoords({ top: rect.top - gap, left: rect.left + rect.width / 2 });
    }
  }, [side]);

  const show = useCallback(() => {
    updatePosition();
    setVisible(true);
  }, [updatePosition]);

  const hide = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!visible) return undefined;
    const onScrollOrResize = () => hide();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [visible, hide]);

  if (!label) return children;

  const sideClass = SIDE_CLASS[side] || styles.sideLeft;

  return (
    <>
      <span
        ref={hostRef}
        className={`${styles.host} ${sideClass} ${className}`.trim()}
        onMouseEnter={() => { if (hoverRef.current) show(); }}
        onMouseLeave={() => {
          if (!hoverRef.current) return;
          requestAnimationFrame(() => {
            if (hostRef.current?.contains(document.activeElement)) return;
            hide();
          });
        }}
        onFocus={show}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) hide();
        }}
      >
        {children}
      </span>
      {visible && createPortal(
        <span
          id={tipId}
          className={`${styles.tip} ${styles.tipFixed} ${sideClass}`}
          style={{ top: coords.top, left: coords.left }}
          role="tooltip"
        >
          {label}
        </span>,
        document.body,
      )}
    </>
  );
}