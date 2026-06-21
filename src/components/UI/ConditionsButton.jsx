import React from 'react';
import { useT } from '../../i18n';
import styles from './fab.module.css';
import css from './ConditionsButton.module.css';
import Tooltip from './Tooltip';

export default function ConditionsButton({ onOpen }) {
  const t = useT();

  return (
    <Tooltip label={t('panel.tab.conditions')}>
      <button
        id="conditions-btn"
        className={`${styles.fab} ${css.conditions}`}
        aria-label={t('panel.tab.conditions')}
        onClick={() => onOpen?.()}
      >
        <span className={css.icon} aria-hidden="true">♿</span>
      </button>
    </Tooltip>
  );
}