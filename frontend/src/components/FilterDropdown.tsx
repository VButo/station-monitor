'use client'
import { useState, useRef, useEffect } from 'react'

interface FilterOption {
  id: string
  label: string
  checked: boolean
}

interface FilterDropdownProps {
  icon: React.ReactNode
  options: FilterOption[]
  onOptionsChange: (options: FilterOption[]) => void
}

export default function FilterDropdown({ icon, options, onOptionsChange }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleOptionChange = (optionId: string) => {
    const updatedOptions = options.map(option =>
      option.id === optionId ? { ...option, checked: !option.checked } : option
    )
    onOptionsChange(updatedOptions)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        {icon}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
          <div className="py-2">
            {options.map((option) => (
              <label
                key={option.id}
                className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={option.checked}
                  onChange={() => handleOptionChange(option.id)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
