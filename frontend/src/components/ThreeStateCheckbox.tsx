import { useRef, useEffect } from 'react';

interface ThreeStateCheckboxProps {
  state: 'all' | 'some' | 'none';
  onChange: (checked: boolean) => void;
  className?: string;
}

export default function ThreeStateCheckbox({ state, onChange, className = '' }: Readonly<ThreeStateCheckboxProps>) {
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      // Don't use browser's indeterminate state, we'll handle it visually
      checkboxRef.current.indeterminate = false;
    }
  }, [state]);

  const getTitle = () => {
    if (state === 'all') return 'All items selected';
    if (state === 'some') return 'Some items selected';
    return 'No items selected';
  };

  return (
    <div className="relative inline-block">
      <input
        ref={checkboxRef}
        type="checkbox"
        checked={state === 'all' || state === 'some'}
        onChange={(e) => onChange(e.target.checked)}
        className={`rounded border-gray-300 transition-opacity duration-200 ${className}`}
        style={{
          opacity: state === 'some' ? 0.5 : 1,
        }}
        title={getTitle()}
      />
      {/* Custom checkmark overlay for 'some' state */}
      {state === 'some' && (
        <div 
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
          style={{
            opacity: 0.5,
            color: '#3b82f6', // Blue color for the checkmark
            fontSize: '12px',
            fontWeight: 'bold',
          }}
        >
          ✓
        </div>
      )}
    </div>
  );
}