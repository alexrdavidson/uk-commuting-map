import { useEffect, useRef, useState } from 'react'

const EMAIL = import.meta.env.VITE_SUBMIT_EMAIL as string | undefined
const FORM = import.meta.env.VITE_SUBMIT_FORM_URL as string | undefined

export default function SubmitStory({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [v, setV] = useState({ url: '', from: '', to: '', mode: '', duration: '', kind: 'door to door', consent: false })
  const [copied, setCopied] = useState(false)
  useEffect(() => { ref.current?.focus() }, [])
  const text = `Commute story submission\nPublic post URL: ${v.url}\nFrom (as stated): ${v.from}\nTo (as stated): ${v.to}\nMethod: ${v.mode}\nDuration (if stated): ${v.duration} (${v.kind})\nI confirm this is my own public post and I'm happy for it to be linked: ${v.consent ? 'yes' : 'no'}`
  const valid = /^https?:\/\//.test(v.url) && v.from && v.to && v.mode && v.consent
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal narrow" role="dialog" aria-modal="true" aria-labelledby="submit-title" tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn close" onClick={onClose} aria-label="Close">×</button>
        <h2 id="submit-title">Share your commute story</h2>
        <p>Have you publicly posted about your own journey to work (a blog post, video or public social post)? Send a link. Nothing is published until it's been reviewed. We only link to your public post,
          and only use the places, method and time you stated yourself. Please don't send home addresses or private details.</p>
        <form onSubmit={(e) => e.preventDefault()} className="submit-form">
          <label>Link to your public post<input type="url" required value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} placeholder="https://" /></label>
          <label>From (town or area, as in your post)<input value={v.from} onChange={(e) => setV({ ...v, from: e.target.value })} /></label>
          <label>To (town or area, as in your post)<input value={v.to} onChange={(e) => setV({ ...v, to: e.target.value })} /></label>
          <label>Method of travel<input value={v.mode} onChange={(e) => setV({ ...v, mode: e.target.value })} placeholder="e.g. train and walk" /></label>
          <label>Journey time, if your post states one<input value={v.duration} onChange={(e) => setV({ ...v, duration: e.target.value })} placeholder="e.g. 55 minutes" /></label>
          <label>That time is<select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
            <option>door to door</option><option>station to station</option><option>moving time</option><option>elapsed time</option></select></label>
          <label className="check"><input type="checkbox" checked={v.consent} onChange={(e) => setV({ ...v, consent: e.target.checked })} /> This is my own public post and I'm happy for it to be linked.</label>
        </form>
        <div className="gm-buttons">
          {EMAIL && <a className={`btn ${valid ? '' : 'disabled'}`} aria-disabled={!valid} href={valid ? `mailto:${EMAIL}?subject=${encodeURIComponent('Commute story submission')}&body=${encodeURIComponent(text)}` : undefined}>Send by email</a>}
          {FORM && <a className="btn" href={FORM} target="_blank" rel="noopener noreferrer">Open submission form</a>}
          <button className="btn" disabled={!valid} onClick={() => { navigator.clipboard?.writeText(text).then(() => setCopied(true)).catch(() => setCopied(false)) }}>{copied ? 'Copied' : 'Copy submission text'}</button>
        </div>
        {!EMAIL && !FORM && <p className="note">This copy of the site doesn't have a submission address set up yet. You can copy your submission text, and the site owner can add an address (see README).</p>}
        {EMAIL && <p className="hint">Email: {EMAIL}</p>}
      </div>
    </div>
  )
}
