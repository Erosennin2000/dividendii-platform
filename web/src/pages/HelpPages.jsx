// Help, support tickets, Learn and Legal. All sample content until the team
// writes the real articles and lessons.

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, formatDateTime } from '../api.js'
import { useLoad } from '../session.jsx'
import { Card, Empty, ErrorNote, Field, KV, Loading, PageHead, Pill, Row, SampleChip, SampleNote, Tabs } from '../components/ui.jsx'
import { useDebounced } from '../components/ui.jsx'

export function Help() {
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const help = useLoad(() => api.extras.help(dq), [dq])
  const [open, setOpen] = useState(null)
  const d = help.data

  return (
    <div className="stack">
      <PageHead title={<>Help <SampleChip /></>} sub="Answers in plain words. If you cannot find yours, write to us.">
        <Link className="btn btn-primary" to="/help/tickets">Write to us</Link>
      </PageHead>
      <input type="search" placeholder="Search help" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search help" />
      {help.loading && !d ? <Loading rows={4} /> : (
        <div className="split">
          <Card title={q ? 'Answers' : 'Popular questions'}>
            {(d?.articles || []).length === 0 && <Empty title="Nothing matches">Try fewer words, or write to us.</Empty>}
            {(d?.articles || []).map((a) => (
              <div key={a.id} className="list-row" style={{ display: 'block' }}>
                <button className="linkbtn" onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>{a.title}</button>
                {open === a.id && <p className="small" style={{ marginTop: 8 }}>{a.body}</p>}
              </div>
            ))}
          </Card>
          <div className="stack">
            <Card title="Topics">{(d?.topics || []).map((t) => <Row key={t.title} title={t.title} sub={t.note} />)}</Card>
            <Card title="Contact">
              <KV k="Email" v={d?.contact.email} />
              <p className="xs muted">{d?.contact.reply}</p>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

export function Tickets() {
  const list = useLoad(() => api.extras.tickets())
  const [sel, setSel] = useState(null)
  const [form, setForm] = useState({ subject: '', message: '' })
  const [reply, setReply] = useState('')
  const [err, setErr] = useState(null)
  const tickets = list.data || []
  const open = tickets.find((t) => t.id === sel) || null

  async function create() {
    setErr(null)
    try { const r = await api.extras.newTicket(form); setForm({ subject: '', message: '' }); setSel(r.data.id); list.reload() } catch (e) { setErr(e) }
  }
  async function send() {
    setErr(null)
    try { await api.extras.replyTicket(open.id, reply); setReply(''); list.reload() } catch (e) { setErr(e) }
  }

  return (
    <div className="stack">
      <PageHead title={<>Your requests <SampleChip /></>} sub="Everything you have sent us, and what we said." back={{ to: '/help', label: 'Help' }} />
      <div className="split">
        <Card title="Requests">
          {list.loading ? <Loading rows={3} /> : tickets.length === 0 ? <Empty title="No requests yet">Write to us from the form.</Empty> : tickets.map((t) => (
            <button key={t.id} className="list-row" style={{ width: '100%', textAlign: 'left', background: sel === t.id ? 'var(--panel)' : 'none', border: 0 }} onClick={() => setSel(t.id)}>
              <div className="grow"><div style={{ fontWeight: 600, color: 'var(--ink)' }}>{t.subject}</div><div className="xs muted">{t.id} · {formatDateTime(t.updated_at)}</div></div>
              <Pill kind={t.status === 'open' ? 'warn' : 'good'}>{t.status === 'open' ? 'Open' : 'Answered'}</Pill>
            </button>
          ))}
        </Card>
        <div className="stack">
          {open ? (
            <Card title={open.subject}>
              {open.messages.map((m, i) => (
                <div key={i} className="list-row" style={{ display: 'block' }}>
                  <div className="xs muted">{m.from === 'you' ? 'You' : 'Dividendii'} · {formatDateTime(m.at)}</div>
                  <div className="small">{m.text}</div>
                </div>
              ))}
              <Field label="Reply"><textarea rows="3" value={reply} onChange={(e) => setReply(e.target.value)} /></Field>
              <button className="btn btn-primary" disabled={!reply.trim()} onClick={send}>Send reply</button>
            </Card>
          ) : (
            <Card title="New request">
              <Field label="Subject"><input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
              <Field label="What do you need?"><textarea rows="5" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
              <button className="btn btn-primary" disabled={!form.subject.trim() || !form.message.trim()} onClick={create}>Send</button>
            </Card>
          )}
          <ErrorNote error={err} />
          <SampleNote>Requests stay in memory on the test server. Real ones need a support inbox or help desk.</SampleNote>
        </div>
      </div>
    </div>
  )
}

export function Learn() {
  const learn = useLoad(() => api.extras.learn())
  const [track, setTrack] = useState('All')
  const d = learn.data
  const tracks = ['All', ...new Set((d?.lessons || []).map((l) => l.track))]
  const lessons = (d?.lessons || []).filter((l) => track === 'All' || l.track === track)
  const done = (d?.lessons || []).filter((l) => l.done).length

  return (
    <div className="stack">
      <PageHead title={<>Learn <SampleChip /></>} sub="Short lessons, in plain words." />
      {learn.loading ? <Loading rows={4} /> : (
        <div className="split">
          <div className="stack">
            <Tabs value={track} onChange={setTrack} label="Track" options={tracks.map((t) => ({ value: t, label: t }))} />
            <Card title="Lessons">
              {lessons.map((l) => <Row key={l.id} icon={l.done ? 'check' : 'book'} tone={l.done ? 'up' : ''} title={l.title} sub={`${l.track} · ${l.minutes} min`} right={l.done ? <Pill kind="good">Done</Pill> : null} />)}
              <SampleNote>Lesson text is still to be written.</SampleNote>
            </Card>
          </div>
          <div className="stack">
            <Card title="Your progress">
              <div className="progress"><span style={{ width: `${(done / Math.max(1, d.lessons.length)) * 100}%` }} /></div>
              <p className="small muted mt-sm">{done} of {d.lessons.length} lessons done</p>
            </Card>
            <Card title="Words you will see">{d.glossary.map((g) => <KV key={g.term} k={g.term} v={<span className="small" style={{ fontWeight: 400 }}>{g.meaning}</span>} />)}</Card>
          </div>
        </div>
      )}
    </div>
  )
}

export function Legal() {
  const legal = useLoad(() => api.extras.legal())
  const d = legal.data
  return (
    <div className="stack">
      <PageHead title="Legal" sub="The documents behind your account." />
      {legal.loading ? <Loading rows={4} /> : (
        <div className="split">
          <Card title="Documents">{d.documents.map((x) => <Row key={x.title} icon="doc" title={x.title} sub={x.note} />)}<SampleNote>Legal text is not written yet. Each document needs your lawyer's final wording.</SampleNote></Card>
          <div className="stack">
            <Card title="About Dividendii">{d.company.map(([k, v]) => <KV key={k} k={k} v={v} />)}</Card>
            <Card title="This app"><KV k="Version" v={d.app.version} /><KV k="Released" v={d.app.released} /></Card>
          </div>
        </div>
      )}
    </div>
  )
}
