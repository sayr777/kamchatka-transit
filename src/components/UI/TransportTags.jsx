import React from 'react';
import styles from './TransportTags.module.css';

export default function TransportTags({ tags }) {
  if (!tags?.length) return null;
  return (
    <div className={styles.row}>
      {tags.map((tag) => (
        <span key={tag.key} className={styles.tag} title={tag.label}>
          <span className={styles.icon} aria-hidden="true">{tag.icon}</span>
          <span className={styles.text}>{tag.label}</span>
        </span>
      ))}
    </div>
  );
}