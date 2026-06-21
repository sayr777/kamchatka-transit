import React from 'react';
import WeatherWidget from './WeatherWidget';
import RouteChip from './RouteChip';
import StopChip from './StopChip';
import styles from './TopBar.module.css';

export default function TopBar() {
  return (
    <div className={styles.bar}>
      <WeatherWidget />
      <RouteChip />
      <StopChip />
    </div>
  );
}