import { useRef, useEffect } from 'react';

interface ThreeStateCheckboxProps {
  state: 'all' | 'some' | 'none';
  onChange: (checked: boolean) => void;
  className?: string;
}

export default function ThreeStateCheckbox({ state, onChange, className = '' }: ThreeStateCheckboxProps) {
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = state === 'some';
    }
  }, [state]);

  const getTitle = () => {
    if (state === 'all') return 'All items selected';
    if (state === 'some') return 'Some items selected';
    return 'No items selected';
  };

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      checked={state === 'all'}
      onChange={(e) => onChange(e.target.checked)}
      className={`rounded border-gray-300 transition-opacity duration-200 ${className}`}
      style={{
        opacity: state === 'some' ? 0.6 : 1,
        filter: state === 'some' ? 'saturate(0.7)' : 'none',
      }}
      title={getTitle()}
    />
  );
}