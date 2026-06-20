import React from 'react';
import { useAppStore } from '../../store/appStore';
import styles from './fab.module.css';
import css from './PlannerButton.module.css';

export default function PlannerButton() {
  const open = useAppStore((s) => s.plannerOpen);
  const setPlannerOpen = useAppStore((s) => s.setPlannerOpen);
  return (
    <button
      id="planner-btn"
      className={`${styles.fab} ${css.planner} ${open ? styles.active : ''}`}
      title="Планировщик"
      onClick={() => setPlannerOpen(!open)}
    >⇄</button>
  );
}
