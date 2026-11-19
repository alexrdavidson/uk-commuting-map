import type { Story } from '../stories'
import type { Snapshot } from '../data'

export default function StoryList({ stories, heading, snap, emptyText }: { stories: Story[]; heading: string; snap: Snapshot; emptyText?: string }) {
  return (
    <div className="stories">
      <h3 className="list-title">{heading}</h3>
      {stories.length === 0 ? (
        <p className="hint">{emptyText ?? 'No verified first-person account is linked to this place yet.'} <a href="#submit-story" onClick={(e) => { e.preventDefault(); document.dispatchEvent(new CustomEvent('open-submit')) }}>Share yours</a>.</p>
      ) : (
        <ul className="story-list">
          {stories.map((s) => (
            <li key={s.id}>
              <p className="story-route">{s.origin_text} → {s.destination_text}</p>
              <p className="story-meta">{s.mode}{s.duration ? <> · <b>{s.duration}</b> <span className="pill">{s.duration_kind ?? 'self-reported'}</span></> : null}</p>
              <p>{s.summary}</p>
              <p className="story-src">
                <a href={s.url} target="_blank" rel="noopener noreferrer">{s.platform}: {s.author}</a>
                {s.published && <> · published {s.published}</>} · checked {s.checked}
              </p>
              {s.note && <p className="story-note">{s.note}</p>}
              {s.origin_code && s.destination_code && <p className="story-note">Linked to census areas {snap.byCode.get(s.origin_code)?.name} → {snap.byCode.get(s.destination_code)?.name}.</p>}
            </li>
          ))}
          <li className="story-disclaimer">One person's self-reported experience, not a representative statistic or a live estimate. Accounts may describe a different year from the census data.</li>
        </ul>
      )}
    </div>
  )
}
