import { useMemo, useRef, useState } from 'react'
import type { Area } from '../data'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

export default function Search({ areas, onPick }: { areas: Area[]; onPick: (code: string) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const index = useMemo(() => areas.flatMap((a) => [a.name, a.census_name, ...a.aliases].map((n) => ({ key: norm(n), shown: n, a }))), [areas])
  const results = useMemo(() => {
    const k = norm(q)
    if (!k) return []
    const seen = new Set<string>()
    const scored = index
      .map((e) => ({ e, s: e.key === k ? 0 : e.key.startsWith(k) ? 1 : e.key.includes(' ' + k) ? 2 : e.key.includes(k) ? 3 : 9 }))
      .filter((x) => x.s < 9)
      .sort((x, y) => x.s - y.s || y.e.a.jobs_filled - x.e.a.jobs_filled)
    const out: { a: Area; via?: string }[] = []
    for (const { e } of scored) {
      if (seen.has(e.a.code)) continue
      seen.add(e.a.code)
      out.push({ a: e.a, via: norm(e.shown) !== norm(e.a.name) ? e.shown : undefined })
      if (out.length >= 8) break
    }
    return out
  }, [q, index])

  const pick = (code: string) => { onPick(code); setQ(''); setOpen(false); inputRef.current?.blur() }
  return (
    <div className="search" role="search">
      <label htmlFor="search-input" className="sr-only">Search for a town, city or census area</label>
      <input
        id="search-input" ref={inputRef} type="search" placeholder="Search a town, city or census area…" value={q} autoComplete="off"
        role="combobox" aria-expanded={open && results.length > 0} aria-controls="search-list" aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `opt-${results[active].a.code}` : undefined}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { setActive((a) => Math.min(a + 1, results.length - 1)); e.preventDefault() }
          else if (e.key === 'ArrowUp') { setActive((a) => Math.max(a - 1, 0)); e.preventDefault() }
          else if (e.key === 'Enter' && results[active]) pick(results[active].a.code)
          else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && q && (
        <ul id="search-list" role="listbox" className="search-list">
          {results.length === 0 && <li className="empty">No census area matches “{q}”. Search covers the 404 local authority areas used in the 2011 tables and some common town names.</li>}
          {results.map((r, i) => (
            <li key={r.a.code} id={`opt-${r.a.code}`} role="option" aria-selected={i === active}
              className={i === active ? 'active' : ''} onMouseDown={(e) => { e.preventDefault(); pick(r.a.code) }}>
              <span>{r.a.name}</span>
              <small>{r.via ? `${r.via} · ` : ''}{r.a.nation}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
