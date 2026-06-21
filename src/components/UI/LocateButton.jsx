import React from 'react';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import MapView from '../Map/MapView';
import styles from './fab.module.css';
import css from './LocateButton.module.css';
import Tooltip from './Tooltip';

export default function LocateButton() {
  const t = useT();
  const setUserLocation = useAppStore((s) => s.setUserLocation);
  const setChip = useAppStore((s) => s.setChip);

  const handleClick = () => {
    if (!navigator.geolocation) { setChip(t('locate.unavailable')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lon: pos.coords.longitude, lat: pos.coords.latitude };
        setUserLocation(loc);
        MapView.flyTo({ longitude: loc.lon, latitude: loc.lat, zoom: 15.5, transitionDuration: 800 });
      },
      () => setChip(t('locate.denied')),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <Tooltip label={t('locate.title')}>
      <button
        className={`${styles.fab} ${css.locate}`}
        aria-label={t('locate.title')}
        onClick={handleClick}
      >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
        <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="currentColor" opacity=".15"/>
      </svg>
      </button>
    </Tooltip>
  );
}
