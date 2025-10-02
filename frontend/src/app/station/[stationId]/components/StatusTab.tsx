import React from 'react';
import type { CollectorDataKeyValue } from '@/types/station';
import { formatDistanceToNow } from 'date-fns';
import { showDatabaseTimeAsUTC1 } from '@/utils/timezoneHelpers';

interface StatusTabProps {
  statusData: CollectorDataKeyValue[];
}

const StatusTab: React.FC<StatusTabProps> = ({ statusData }) => {
  if (statusData.length === 0) {
    return <div style={{ color: '#8593a5', fontStyle: 'italic', padding: '12px 0' }}>No status data available.</div>;
  }
  // Get the latest timestamp from the data (assuming all rows have the same timestamp, or use the first)
  const timestamp = statusData[0].station_timestamp;
  const timestampInfo = showDatabaseTimeAsUTC1(timestamp);
  const timeAgo = formatDistanceToNow(timestampInfo.dateForCalculations, {
      addSuffix: true // adds "ago" or "in X time"
    });
  return (
    <div>
      <h3 style={{ fontWeight: 600, fontSize: 17, color: '#315284', marginBottom: 2 }}>Status Table</h3>
      {timestamp && (
        <div style={{ color: '#8593a5', fontSize: 13, marginBottom: 12 }}>
          <h4>Data timestamp: {timestampInfo.displayWithTimezone}</h4>
            ({timeAgo})
        </div>
      )}
      {statusData.map((row, idx) => (
        <div className="kv-row" key={row.key + idx}>
          <span className="kv-key">{row.key}</span>
          <span className="kv-value">{row.value}</span>
        </div>
      ))}
      <style>{`
        .kv-row {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid #eef1f4;
          padding: 12px 0;
          font-size: 16px;
        }
        .kv-key {
          font-weight: 500;
          color: #8593a5;
          width: 50%;
        }
        .kv-value {
          color: #253d61;
          font-family: monospace, monospace;
          letter-spacing: 0.3px;
          font-weight: 400;
          width: 50%;
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
      `}</style>
    </div>
  );
};

export default StatusTab;
