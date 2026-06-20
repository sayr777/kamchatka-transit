import React from 'react';
import { useAppStore } from '../../store/appStore';
import MapView from '../Map/MapView';
import styles from './fab.module.css';
import css from './Compass.module.css';

export default function Compass() {
  const bearing = useAppStore((s) => s.viewState.bearing ?? 0);
  const norm = ((bearing % 360) + 360) % 360;
  const active = Math.abs(norm) > 1 && Math.abs(norm - 360) > 1;

  const handleClick = () => {
    const v = useAppStore.getState().viewState;
    MapView.flyTo({ ...v, bearing: 0, pitch: 0, transitionDuration: 650 });
  };

  return (
    <button
      className={`${styles.fab} ${active ? styles.active : ''} ${css.compass}`}
      title="Компас"
      onClick={handleClick}
    >
      <span className={css.face}>
        <span className={css.needle} style={{ transform: `rotate(${-norm}deg)` }}>N</span>
      </span>
    </button>
  );
}
