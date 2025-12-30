import React from 'react';

interface TimelineCellProps {
  value: number[] | 'Loading' | 'Error';
  timestamps?: string[];
  BarWidth?: number;
  maxBarHeight?: number;
  maxBars?: number; // default 24
}

const MIN_BAR_HEIGHT = 4;
const MAX_BAR_HEIGHT = 34; // px
const BAR_WIDTH = 7; // px

function getColor(value: number): string {
  if (value <= 10) return 'rgb(255,0,0)';
  
  const maxGreen = 190;
  const red = value < 50 ? 255 : Math.floor(255 - (value - 50) * 5.1);
  const green = value > 50 ? maxGreen : Math.floor((value / 50) * maxGreen);
  return `rgb(${red}, ${green}, 0)`;
}

const TimelineCell: React.FC<TimelineCellProps> = ({ value, timestamps, BarWidth, maxBarHeight, maxBars = 24 }) => {
  if (value === 'Error') {
    return <div style={{ color: 'darkred' }}>Error</div>;
  }
  if (value === 'Loading') {
    return <div style={{ fontStyle: 'italic', color: 'gray' }}>Loading...</div>;
  }

  if (Array.isArray(value)) {
    const target = Math.max(1, maxBars);
    const padded = [
      ...value,
  ...new Array(Math.max(0, target - value.length)).fill(0)
    ].slice(-target);

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          height: maxBarHeight ? `${maxBarHeight}px` : `${MAX_BAR_HEIGHT}px`,
          minWidth: '200px',
          width: '100%',
          gap: '1px',
        }}
      >
        {padded.map((v, idx) => {
            const barHeight =
            Math.max(MIN_BAR_HEIGHT, ((v || 0) / 100) * (maxBarHeight ? maxBarHeight - MIN_BAR_HEIGHT : MAX_BAR_HEIGHT - MIN_BAR_HEIGHT));

            const barColor = getColor(v || 0);
            const timestamp = timestamps?.[idx]
                ? new Date(timestamps[idx]).toLocaleString()
                : 'Unknown time';
            return (
                <div
                    key={timestamps?.[idx] ? `${timestamps[idx]}-${v}` : `bar-${v}-${idx}`}
                    style={{
                    width: BarWidth ? `${BarWidth}px` : `${BAR_WIDTH}px`,
                    marginLeft: '1px',
                    height: `${barHeight}px`,
                    background: barColor,
                    borderRadius: 1,
                    opacity: v === null ? 0.25 : 1,
                    transition: 'height .2s',
                }}
                title={`${timestamp}: ${v === null ? 'n/a' : v.toFixed(0) + '%'}`}
                />
            );
        })}
      </div>
    );
  }
  return null;
};

export default TimelineCell;
