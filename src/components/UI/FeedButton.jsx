import React from 'react';
import { useAppStore } from '../../store/appStore';
import styles from './fab.module.css';
import css from './FeedButton.module.css';

export default function FeedButton() {
  const setSplash = useAppStore((s) => s.setSplash);
  return (
    <button
      id="feed-btn"
      className={`${styles.fab} ${css.feed}`}
      title="Сменить язык"
      onClick={() => setSplash(true)}
    >🌐</button>
  );
}
