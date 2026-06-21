import React, { useRef } from 'react';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import MapView from '../Map/MapView';
import styles from './fab.module.css';
import css from './TiltButton.module.css';
import Tooltip from './Tooltip';

const LONG_PRESS_MS = 500;

export default function TiltButton() {
  const t = useT();
  const pitch = useAppStore((s) => s.viewState.pitch ?? 0);
  const bearing = useAppStore((s) => s.viewState.bearing ?? 0);
  const is3d = pitch > 5;
  const isRotated = Math.abs(bearing) > 1;
  const timerRef = useRef(null);
  const firedRef = useRef(false);

  const onStart = (e) => {
    e.preventDefault();
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      const v = useAppStore.getState().viewState;
      MapView.flyTo({ ...v, bearing: 0, pitch: 0, transitionDuration: 700 });
      useAppStore.getState().setChip(t('tilt.reset'));
    }, LONG_PRESS_MS);
  };

  const onEnd = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (!firedRef.current) {
      const v = useAppStore.getState().viewState;
      MapView.flyTo({ ...v, pitch: is3d ? 0 : 45, transitionDuration: 500 });
    }
    firedRef.current = false;
  };

  const label = is3d ? '2D' : isRotated ? '↑N' : '3D';

  return (
    <Tooltip label={t('tilt.title')}>
      <button
        className={`${styles.fab} ${css.tilt}`}
        aria-label={t('tilt.title')}
        onPointerDown={onStart}
        onPointerUp={onEnd}
        onPointerLeave={onEnd}
      >
        <span aria-hidden="true" style={{ fontFamily: 'var(--head)', fontSize: 13, fontWeight: 700, letterSpacing: '-.01em' }}>
          {label}
        </span>
      </button>
    </Tooltip>
  );
}
