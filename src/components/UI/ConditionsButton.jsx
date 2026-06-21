import React from 'react';
import { useT } from '../../i18n';
import styles from './fab.module.css';
import css from './ConditionsButton.module.css';
import Tooltip from './Tooltip';

export default function ConditionsButton({ active = false, onToggle }) {
  const t = useT();

  return (
    <Tooltip label={t('panel.tab.conditions')}>
      <button
        id="conditions-btn"
        className={`${styles.fab} ${css.conditions} ${active ? styles.active : ''}`}
        aria-label={t('panel.tab.conditions')}
        aria-pressed={active}
        onClick={() => onToggle?.()}
      >
        <span className={css.icon} aria-hidden="true">♿</span>
      </button>
    </Tooltip>
  );
}