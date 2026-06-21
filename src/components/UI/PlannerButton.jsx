import React from 'react';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import styles from './fab.module.css';
import css from './PlannerButton.module.css';
import Tooltip from './Tooltip';

export default function PlannerButton() {
  const t = useT();
  const open = useAppStore((s) => s.plannerOpen);
  const togglePlanner = useAppStore((s) => s.togglePlanner);
  return (
    <Tooltip label={t('planner.title')}>
      <button
        id="planner-btn"
        className={`${styles.fab} ${css.planner} ${open ? styles.active : ''}`}
        aria-label={t('planner.title')}
        aria-pressed={open}
        onClick={togglePlanner}
      >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="6" cy="19" r="2"/>
        <circle cx="18" cy="5" r="2"/>
        <path d="M6 17V7a2 2 0 0 1 2-2h8"/>
        <path d="m14 7 2-2-2-2"/>
      </svg>
      </button>
    </Tooltip>
  );
}
