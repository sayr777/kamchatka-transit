import React from 'react';
import { useAppStore } from '../../store/appStore';
import styles from './Chip.module.css';

export default function Chip() {
  const chip = useAppStore((s) => s.chip);
  return chip ? <div className={styles.chip}>{chip}</div> : null;
}
