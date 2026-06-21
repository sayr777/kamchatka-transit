import React from 'react';
import styles from './Tooltip.module.css';

const SIDE_CLASS = {
  left: styles.sideLeft,
  bottom: styles.sideBottom,
  top: styles.sideTop,
};

export default function Tooltip({ label, side = 'left', children, className = '' }) {
  if (!label) return children;

  const sideClass = SIDE_CLASS[side] || styles.sideLeft;

  return (
    <span className={`${styles.host} ${sideClass} ${className}`.trim()}>
      {children}
      <span className={styles.tip} role="tooltip">{label}</span>
    </span>
  );
}