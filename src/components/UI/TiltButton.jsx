import React, { useRef } from 'react';
import { useAppStore } from '../../store/appStore';
import MapView from '../Map/MapView';
import styles from './fab.module.css';
import css from './TiltButton.module.css';

const LONG_PRESS_MS = 500;

export default function TiltButton() {
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
      // Долгое нажатие → сброс ориентации на север + 2D
      const v = useAppStore.getState().viewState;
      MapView.flyTo({ ...v, bearing: 0, pitch: 0, transitionDuration: 700 });
      useAppStore.getState().setChip('Ориентация сброшена');
    }, LONG_PRESS_MS);
  };

  const onEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!firedRef.current) {
      // Короткое нажатие → переключить 3D/2D
      const v = useAppStore.getState().viewState;
      MapView.flyTo({ ...v, pitch: is3d ? 0 : 45, transitionDuration: 500 });
    }
    firedRef.current = false;
  };

  const label = is3d ? '2D' : isRotated ? '↑N' : '3D';

  return (
    <button
      className={`${styles.fab} ${css.tilt}`}
      title="3D/2D · удержи для сброса ориентации"
      onPointerDown={onStart}
      onPointerUp={onEnd}
      onPointerLeave={onEnd}
    >
      {label}
    </button>
  );
}
