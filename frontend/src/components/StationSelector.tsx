"use client"
import React, { useState, useRef, useEffect } from 'react'
import type { Station } from '@/types/station'

interface Props {
  stations: Station[]
  value: number
  onSelect: (id: number) => void
}

export default function StationSelector(props: Readonly<Props>) {
  const { stations, value, onSelect } = props
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const selected = stations.find((s) => s.id === value)
  const lower = query.trim().toLowerCase()
  const filtered = lower ? stations.filter((s) => (s.label || '').toLowerCase().includes(lower)) : stations
  const displayValue = open ? query : (stations.find((s) => s.id === value)?.label ?? '')

  return (
    <div ref={ref} className="relative inline-block">
      <div className="w-80">
        <div className="relative">
          <input
            value={displayValue}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => { setOpen(true); setQuery('') }}
            placeholder={selected ? '' : 'Type to search...'}
            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md bg-white text-gray-700"
          />
          <button
            onClick={() => { setOpen((v) => !v); if (!open) setQuery('') }}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 px-2 py-1 text-gray-400"
            aria-label="Toggle station list"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute mt-2 w-80 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="max-h-56 overflow-auto">
            {filtered.map((s: Station) => (
              <button
                key={s.id}
                onClick={() => { onSelect(s.id); setOpen(false); setQuery('') }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${s.id === value ? 'bg-gray-100' : ''}`}
              >
                <div className="text-sm text-gray-800">{s.label}</div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-3 text-gray-500">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
