import React, { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import MapView from '../Map/MapView';
import {
  formatPlannerDistance,
  formatPlannerDuration,
  plannerBoundsFromResult,
  plannerPointTitle,
} from '../../utils/planner';
import styles from './PlannerPanel.module.css';
import Tooltip from '../UI/Tooltip';

function pointMeta(point, t, lang) {
  if (!point) return '';
  if (point.source === 'user') return t('planner.fromMyLocation');
  if (point.nearStopName) {
    const dist = point.nearDistanceMeters
      ? ` · ${formatPlannerDistance(point.nearDistanceMeters, lang)}`
      : '';
    return `${t('planner.nearStop')} ${point.nearStopName}${dist}`;
  }
  return `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`;
}

function PointRow({ target, badgeClass, badgeLetter, point, pickMode, onPick, t, lang }) {
  const pending = pickMode === target ? ` ${styles.pointPending}` : '';
  return (
    <button type="button" className={`${styles.point}${pending}`} onClick={() => onPick(target)}>
      <div className={`${styles.badge} ${badgeClass}`}>{badgeLetter}</div>
      <div className={styles.pointCopy}>
        <div className={styles.pointLabel}>{t(target === 'from' ? 'planner.pickFrom' : 'planner.pickTo')}</div>
        <div className={styles.pointValue}>
          {point ? plannerPointTitle(point, t('planner.pointOnMap')) : t('planner.pickHint')}
        </div>
        <div className={styles.pointMeta}>
          {point
            ? pointMeta(point, t, lang)
            : t(target === 'from' ? 'planner.pickStart' : 'planner.pickEnd')}
        </div>
      </div>
    </button>
  );
}

export default function PlannerPanel() {
  const t = useT();
  const lang = useAppStore((s) => s.lang);
  const open = useAppStore((s) => s.plannerOpen);
  const from = useAppStore((s) => s.plannerFrom);
  const to = useAppStore((s) => s.plannerTo);
  const result = useAppStore((s) => s.plannerResult);
  const errorKey = useAppStore((s) => s.plannerError);
  const pickMode = useAppStore((s) => s.plannerPickMode);
  const adjacency = useAppStore((s) => s.plannerAdjacency);
  const setPlannerOpen = useAppStore((s) => s.setPlannerOpen);
  const setPlannerPickMode = useAppStore((s) => s.setPlannerPickMode);
  const usePlannerMyLocation = useAppStore((s) => s.usePlannerMyLocation);
  const clearPlanner = useAppStore((s) => s.clearPlanner);
  const runPlanner = useAppStore((s) => s.runPlanner);

  const handleBuild = useCallback(() => {
    runPlanner();
  }, [runPlanner]);

  const lastFlownRef = useRef(null);
  useEffect(() => {
    if (!result || result === lastFlownRef.current) return;
    lastFlownRef.current = result;
    const bounds = plannerBoundsFromResult(result);
    if (bounds) MapView.flyTo({ ...bounds, transitionDuration: 850 });
  }, [result]);

  if (!open) return null;

  const buildDisabled = !(from && to && adjacency?.size);
  const pillText = result ? `${result.transfers} · ${t('planner.transfers')}` : t('planner.title');
  const pillClass = result?.transfers ? `${styles.pill} ${styles.pillTransfer}` : styles.pill;

  return (
    <section className={styles.panel} aria-label={t('planner.title')}>
      <Tooltip label={t('planner.close')} side="bottom" className={styles.closeWrap}>
        <button
          type="button"
          className={styles.closeBtn}
          aria-label={t('planner.close')}
          onClick={() => setPlannerOpen(false)}
        >
          ×
        </button>
      </Tooltip>
      <div className={styles.head}>
        <div>
          <div className={styles.title}>{t('planner.title')}</div>
          <div className={styles.subtitle}>{t('planner.subtitle')}</div>
        </div>
        <div className={pillClass}>{pillText}</div>
      </div>

      <div className={styles.points}>
        <PointRow
          target="from"
          badgeClass={styles.badgeFrom}
          badgeLetter="A"
          point={from}
          pickMode={pickMode}
          onPick={setPlannerPickMode}
          t={t}
          lang={lang}
        />
        <PointRow
          target="to"
          badgeClass={styles.badgeTo}
          badgeLetter="B"
          point={to}
          pickMode={pickMode}
          onPick={setPlannerPickMode}
          t={t}
          lang={lang}
        />
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={usePlannerMyLocation}>
          {t('planner.useMyLocation')}
        </button>
        <button type="button" className={styles.action} onClick={clearPlanner}>
          {t('planner.clear')}
        </button>
        <button type="button" className={styles.buildBtn} disabled={buildDisabled} onClick={handleBuild}>
          {t('planner.build')}
        </button>
      </div>

      {pickMode && !errorKey && (
        <div className={styles.status}>{t('planner.pickHint')}</div>
      )}
      {errorKey && (
        <div className={`${styles.status} ${styles.statusError}`}>{t(errorKey)}</div>
      )}

      {result && (
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <div className={styles.summaryLabel}>{t('planner.totalTime')}</div>
            <div className={styles.summaryValue}>{formatPlannerDuration(result.totalTimeMin, lang)}</div>
          </div>
          <div className={styles.summaryItem}>
            <div className={styles.summaryLabel}>{t('planner.transfers')}</div>
            <div className={styles.summaryValue}>{String(result.transfers)}</div>
          </div>
          <div className={styles.summaryItem}>
            <div className={styles.summaryLabel}>{t('planner.walk')}</div>
            <div className={styles.summaryValue}>{formatPlannerDuration(result.totalWalkMin, lang)}</div>
          </div>
        </div>
      )}

      {result?.legs?.length ? (
        <div className={styles.legs}>
          {result.legs.map((leg, i) => {
            if (leg.type === 'walk') {
              return (
                <div key={i} className={styles.leg}>
                  <div className={styles.legTop}>
                    <div className={styles.legMode}>{t('planner.walk')}</div>
                    <div className={styles.legTime}>{formatPlannerDuration(leg.durationMin, lang)}</div>
                  </div>
                  <div className={styles.legCopy}>
                    <strong>{leg.fromName || t('planner.pointOnMap')}</strong>
                    {' → '}
                    <strong>{leg.toName || t('planner.pointOnMap')}</strong>
                    <br />
                    {formatPlannerDistance(leg.distanceMeters || 0, lang)}
                  </div>
                </div>
              );
            }
            const waitCopy = leg.waitMin
              ? `${t('planner.wait')} ${formatPlannerDuration(leg.waitMin, lang)} · `
              : '';
            const segCopy = leg.stopCount > 1
              ? ` · ${t('planner.segments', { n: leg.stopCount })}`
              : '';
            return (
              <div key={i} className={styles.leg}>
                <div className={styles.legTop}>
                  <div className={styles.legMode}>{t('planner.transit')}</div>
                  <div className={styles.legTime}>{formatPlannerDuration(leg.durationMin, lang)}</div>
                </div>
                <div className={styles.legRoute} style={{ background: leg.color || '#e84525' }}>
                  № {leg.routeShort || leg.routeId || '—'}
                </div>
                <div className={styles.legCopy}>
                  <strong>{leg.fromName}</strong>
                  {' → '}
                  <strong>{leg.toName}</strong>
                  <br />
                  {waitCopy}
                  {leg.headsign || ''}
                  {segCopy}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !result && (
          <div className={styles.empty}>
            {(from || to) ? t('planner.ready') : t('planner.noPoints')}
          </div>
        )
      )}
    </section>
  );
}