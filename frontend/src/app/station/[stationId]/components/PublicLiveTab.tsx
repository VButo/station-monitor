'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/utils/api';
import type { CollectorDataKeyValue, Station } from '@/types/station';
import { formatDistanceToNow } from 'date-fns';
import { showDatabaseTime } from '@/utils/timezoneHelpers';

const PERIOD_MS = 5000; // 5s
const TTL_SECONDS = 5;   // cache TTL on backend

const PublicLiveTab: React.FC = () => {
  const params = useParams<{ stationId: string }>();
  const stationId = Number(params?.stationId);

  const [data, setData] = useState<CollectorDataKeyValue[]>([]);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  // Track previous values by key to detect changes
  const prevValuesRef = useRef<Record<string, string>>({});
  // Track whether we've established the initial baseline to avoid first-load highlighting
  const initialBaselineSetRef = useRef<boolean>(false);
  const [highlightKeys, setHighlightKeys] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function scheduleHighlightRemoval(k: string) {
    const existing = timeoutsRef.current[k];
    if (existing) clearTimeout(existing);
    timeoutsRef.current[k] = setTimeout(() => {
      setHighlightKeys(current => {
        const updated = new Set(current);
        updated.delete(k);
        return updated;
      });
      delete timeoutsRef.current[k];
    }, 5000);
  }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const timestampInfo = useMemo(() => {
    const ts = data?.[0]?.station_timestamp ;
    if (!ts) return null;
    try {
      return showDatabaseTime(ts);
    } catch {
      return null;
    }
  }, [data]);

  // Track live "seconds ago" indicator based on the station timestamp
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);
  useEffect(() => {
    if (!timestampInfo) {
      setSecondsAgo(null);
      return;
    }
    const calc = () => {
      const diff = Math.max(0, Math.floor((Date.now() - timestampInfo.dateForCalculations.getTime()) / 1000));
      setSecondsAgo(diff);
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [timestampInfo]);

  useEffect(() => {
    if (!Number.isFinite(stationId)) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const requestAndFetch = async () => {
      try {
        setError(null);
        const station = await api.get<Station>(`/stations/${stationId}`);
        if (cancelled) return;
        // Now fetch live data using station IPs from snapshot
        const data = await api.get<CollectorDataKeyValue[]>(`/live/get_live_data`, {
          params: {
            ip_datalogger_http: station.data.ip_datalogger_http,
            ip: station.data.ip_modem_https.split(':')[0],
            ip_modem_http: station.data.ip_modem_http,
            stationId: stationId,
            ttlSeconds: TTL_SECONDS,
          },
        });
        if (cancelled) return;
        console.log("Live data:", data);
        const next = Array.isArray(data.data) ? data.data : [];
        setData(next);
      } catch {
        if (!cancelled) setError('No public data available...');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (autoRefresh) {
      // Initial fetch
      requestAndFetch();
      // Poll snapshot periodically to keep UI fresh
      timer = setInterval(requestAndFetch, PERIOD_MS);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [stationId, autoRefresh]);

  // Detect changes and schedule highlight fade only for changed values
  useEffect(() => {
    if (!data || data.length === 0) return;
    const nextValues: Record<string, string> = {};
    for (const row of data) {
      nextValues[row.key] = row.value ?? '';
    }
    // If this is the first data load, establish baseline without highlighting
    if (!initialBaselineSetRef.current) {
      prevValuesRef.current = nextValues;
      initialBaselineSetRef.current = true;
      return;
    }

    const changed = new Set<string>();
    for (const k of Object.keys(nextValues)) {
      const prev = prevValuesRef.current[k];
      if (prev !== nextValues[k]) {
        changed.add(k);
      }
    }

    if (changed.size > 0) {
      setHighlightKeys(prev => {
        const nextSet = new Set(prev);
        changed.forEach((k) => {
          nextSet.add(k);
          scheduleHighlightRemoval(k);
        });
        return nextSet;
      });
    }

    // Update baseline after processing changes
    prevValuesRef.current = nextValues;
  }, [data]);

  // Ensure timers are cleaned up on component unmount only
  useEffect(() => {
    return () => {
      for (const k of Object.keys(timeoutsRef.current)) {
        clearTimeout(timeoutsRef.current[k]);
      }
      timeoutsRef.current = {};
    };
  }, []);

  if (loading) {
    return (
      <div style={{ color: '#8593a5', fontStyle: 'italic', padding: '12px 0' }}>Loading live public data…</div>
    );
  }

  if (error) {
    return (
      <div style={{ color: '#e11d48', padding: '12px 0' }}>{error}</div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div>
        <h3 style={{ fontWeight: 600, fontSize: 17, color: '#315284', marginBottom: 2 }}>Public LIVE</h3>
        <div style={{ color: '#8593a5', fontStyle: 'italic', padding: '12px 0' }}>No live public data available.</div>
      </div>
    );
  }

  const timeAgo = timestampInfo
    ? formatDistanceToNow(timestampInfo.dateForCalculations, { addSuffix: true })
    : null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h3 style={{ fontWeight: 600, fontSize: 17, color: '#315284', marginBottom: 2 }}>Public LIVE</h3>
        <label className='no-print' style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#253d61', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)} />
          <span>Auto-refresh</span>
        </label>
      </div>
      {timestampInfo && (
        <div style={{ color: '#8593a5', fontSize: 13, marginBottom: 12 }}>
          <h4>Data timestamp: {timestampInfo.displayWithTimezone}</h4>
          <p className='no-print'>({timeAgo})</p>
        </div>
      )}

      {data.map((row) => (
        <div className="kv-row" key={row.key}>
          <span className="kv-key">{row.key}</span>
          <span className="kv-value">
            <span className={`kv-value-highlight ${highlightKeys.has(row.key) ? 'changed' : ''}`}>{row.value}</span>
          </span>
        </div>
      ))}

      {secondsAgo !== null && (
        <div className="no-print age-badge" aria-live="polite">
          <span className="age-icon" aria-hidden="true">🕒</span>
          <span>{secondsAgo} seconds ago</span>
        </div>
      )}

      <style>{`
        .kv-row {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid #eef1f4;
          padding: 12px 0;
          font-size: 16px;
          background-color: transparent;
          transition: background-color 0.6s ease;
        }
        /* Only highlight the changed value's background, not the whole row */
        .kv-value-highlight.changed {
          display: inline;
          background-color: #fceb94; /* light yellow */
          padding: 0 4px;
          border-radius: 3px;
          transition: background-color 0.6s ease;
        }
        .kv-key {
          font-weight: 500;
          color: #8593a5;
          width: 400px;
          min-width: 400px;
          padding-right: 24px;
          flex-shrink: 0;
        }
        .kv-value {
          color: #253d61;
          font-family: monospace, monospace;
          letter-spacing: 0.3px;
          font-weight: 400;
          flex: 1;
          text-align: left;
          word-break: break-all;
        }
        @media (max-width: 700px) {
          .kv-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
          .kv-key, .kv-value {
            width: 100%;
            text-align: left;
          }
        }
        .age-badge {
          position: fixed;
          right: 16px;
          bottom: 16px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          background: #fdebd1;
          color: #253d61;
          font-size: 13px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.08);
          z-index: 1000;
        }
        .age-icon {
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

export default PublicLiveTab;