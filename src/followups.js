import { h, clear } from './lib.js'

export const STAGES = [
  ['new', 'New', '#e2f4ff', '#2c5f7c'], ['contacted', 'Contacted', '#eef1f3', '#4a3328'], ['quoted', 'Quoted', '#f4ecd9', '#8a6a2f'],
  ['follow_up', 'Following up', '#fbf1dc', '#9a6a14'], ['hot', 'Hot lead', '#fbeef2', '#a4455f'], ['cold', 'Gone quiet', '#e9ecee', '#6b5c52'],
]
const stageOf = (k) => STAGES.find(s => s[0] === k) || STAGES[0]

export function dueLabel(iso) {
  if (!iso) return 'No date'
  const d = new Date(iso), now = new Date()
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000)
  const time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase()
  if (days < 0) return days === -1 ? 'Yesterday' : Math.abs(days) + ' days overdue'
  if (d < now) return 'Overdue today'
  if (days === 0) return 'Today ' + time
  if (days === 1) return 'Tomorrow ' + time
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

export async function loadFollow(sb, vendorId) {
  const [n, t] = await Promise.all([
    sb.from('lead_nurture').select('couple_id, stage').eq('vendor_id', vendorId),
    sb.from('lead_followups').select('couple_id, due_at, done').eq('vendor_id', vendorId).eq('done', false),
  ])
  if (n.error || t.error) return {}
  const out = {}, now = Date.now()
  ;(n.data || []).forEach(r => { out[r.couple_id] = { stage: r.stage || 'new', open: 0, nextDue: null, due: false, overdue: false } })
  ;(t.data || []).forEach(r => {
    const o = out[r.couple_id] || (out[r.couple_id] = { stage: 'new', open: 0, nextDue: null, due: false, overdue: false })
    o.open++; if (r.due_at && (!o.nextDue || r.due_at < o.nextDue)) o.nextDue = r.due_at
  })
  Object.values(out).forEach(o => { if (o.nextDue) { const t = new Date(o.nextDue).getTime(); o.overdue = t < now; o.due = t <= now + 86400000 } })
  return out
}

const chip = (txt, bg, fg) => h('span', { style: { display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '11.5px', fontWeight: '600', background: bg, color: fg, marginRight: '6px' } }, txt)
export function followChips(info) {
  if (!info || (info.stage === 'new' && !info.open)) return null
  const st = stageOf(info.stage)
  return h('div', { style: { marginTop: '6px' } },
    info.stage !== 'new' ? chip(st[1], st[2], st[3]) : null,
    info.open ? chip(info.nextDue ? dueLabel(info.nextDue) : info.open + ' to do', info.overdue ? '#fbeceb' : info.due ? '#fbf1dc' : '#eef1f3', info.overdue ? '#b8372f' : info.due ? '#9a6a14' : '#4a3328') : null)
}

function presetDates() {
  const at = (days, hr) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hr || 9, 0, 0, 0); return d }
  const now = new Date()
  return [['Later today', now.getHours() < 16 ? at(0, 17) : new Date(now.getTime() + 2 * 3600000)], ['Tomorrow', at(1)], ['In 3 days', at(3)], ['Next week', at(7)], ['In 2 weeks', at(14)], ['No date', null]]
}
const ymdLocal = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')

export async function followPanel(C, host, lead) {
  const vid = C.vendor.id, cid = lead.coupleId
  clear(host)
  host.appendChild(h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'Follow up')))
  const body = h('div'); host.appendChild(body)
  const [n, t] = await Promise.all([
    C.sb.from('lead_nurture').select('stage, note, last_contacted_at').eq('vendor_id', vid).eq('couple_id', cid).maybeSingle(),
    C.sb.from('lead_followups').select('id, title, due_at, done, done_at').eq('vendor_id', vid).eq('couple_id', cid).order('done').order('due_at', { ascending: true, nullsFirst: false }),
  ])
  if (n.error || t.error) { body.appendChild(h('p', { class: 'muted small' }, 'Follow-ups are not available yet.')); return }
  let stage = (n.data && n.data.stage) || 'new', note = (n.data && n.data.note) || '', last = n.data && n.data.last_contacted_at
  let tasks = t.data || [], noteSaved = note, showDone = false, when = 1, pick = null

  const upsert = async (patch) => {
    const { error } = await C.sb.from('lead_nurture').upsert({ vendor_id: vid, couple_id: cid, stage, note, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'vendor_id,couple_id' })
    if (error) C.toast(C.err(error), true)
  }
  const ago = (iso) => { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago' }

  const draw = () => {
    clear(body)
    // stage
    body.appendChild(h('div', { class: 'eyebrow', style: { marginBottom: '8px' } }, 'Where are they at?'))
    body.appendChild(h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } }, STAGES.map(([k, label, bg, fg]) =>
      h('button', { type: 'button', style: { border: 0, cursor: 'pointer', padding: '8px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: '600', background: stage === k ? fg : bg, color: stage === k ? '#fff' : fg }, onclick: () => { stage = k; upsert({ stage: k }); draw() } }, label))))
    body.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0 20px' } },
      h('span', { class: 'muted small' }, last ? 'Last contacted ' + ago(last) : 'Not contacted yet'),
      h('button', { class: 'linkbtn', onclick: () => { last = new Date().toISOString(); if (stage === 'new') stage = 'contacted'; upsert({ last_contacted_at: last, stage }); draw() } }, 'I just contacted them')))
    // tasks
    const open = tasks.filter(x => !x.done), done = tasks.filter(x => x.done)
    body.appendChild(h('div', { class: 'eyebrow', style: { marginBottom: '8px' } }, 'Reminders and tasks'))
    if (!open.length) body.appendChild(h('p', { class: 'muted small' }, 'Nothing planned. Add a reminder so this lead does not go cold.'))
    open.forEach(x => {
      const over = x.due_at && new Date(x.due_at) < new Date()
      const cb = h('input', { type: 'checkbox', 'aria-label': 'Mark done' })
      cb.addEventListener('change', async () => {
        x.done = true; x.done_at = new Date().toISOString(); draw()
        const { error } = await C.sb.from('lead_followups').update({ done: true, done_at: x.done_at }).eq('id', x.id)
        if (error) { C.toast(C.err(error), true); x.done = false; draw() }
      })
      body.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', border: '1px solid #c8d6de', borderRadius: '12px', marginBottom: '8px', background: '#fff' } },
        cb, h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { style: { fontWeight: '600', fontSize: '14.5px' } }, x.title), h('div', { class: 'small', style: { color: over ? '#b8372f' : '#6b5c52' } }, dueLabel(x.due_at))),
        h('button', { class: 'linkbtn', 'aria-label': 'Remove', onclick: async () => { tasks = tasks.filter(y => y.id !== x.id); draw(); await C.sb.from('lead_followups').delete().eq('id', x.id) } }, 'Remove')))
    })
    // add
    const title = h('input', { class: 'input', placeholder: 'e.g. Call about the quote', maxlength: '140' })
    const dt = h('input', { class: 'input', type: 'date', 'aria-label': 'Due date', style: { maxWidth: '170px' } })
    const tm = h('input', { class: 'input', type: 'time', value: '09:00', 'aria-label': 'Due time', style: { maxWidth: '130px' } })
    const ps = presetDates()
    const setPre = (i) => { when = i; const d = ps[i][1]; dt.value = d ? ymdLocal(d) : ''; if (d) tm.value = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); pre.querySelectorAll('button').forEach((b, j) => { b.style.background = j === i ? '#352219' : '#e2f4ff'; b.style.color = j === i ? '#fff' : '#2c5f7c' }) }
    const pre = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '10px 0' } }, ps.map(([label], i) => h('button', { type: 'button', style: { border: 0, cursor: 'pointer', padding: '7px 13px', borderRadius: '999px', fontSize: '13px', fontWeight: '600', background: '#e2f4ff', color: '#2c5f7c' }, onclick: () => setPre(i) }, label)))
    const add = async () => {
      const v = title.value.trim(); if (!v) return
      let due = null; if (dt.value) { due = new Date(dt.value + 'T' + (tm.value || '09:00')).toISOString() }
      const { data, error } = await C.sb.from('lead_followups').insert({ vendor_id: vid, couple_id: cid, title: v, due_at: due }).select('id, title, due_at, done, done_at').single()
      if (error) { C.toast(C.err(error), true); return }
      tasks = [...tasks, data].sort((a, b) => ((a.due_at || '9') < (b.due_at || '9') ? -1 : 1)); draw(); C.toast('Reminder added')
    }
    title.addEventListener('keydown', (e) => { if (e.key === 'Enter') add() })
    body.appendChild(h('div', { style: { border: '1px solid #c8d6de', borderRadius: '12px', padding: '14px', background: '#fff', marginTop: '6px' } },
      title, pre, h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' } }, dt, tm),
      h('button', { class: 'btn sm', type: 'button', onclick: add }, 'Add reminder'),
      h('div', { class: 'tiny muted', style: { marginTop: '8px' } }, 'We send a notification to your phone when it is due.')))
    setPre(when)
    // notes
    body.appendChild(h('div', { class: 'eyebrow', style: { margin: '22px 0 8px' } }, 'Private notes'))
    const ta = h('textarea', { class: 'input', rows: '4', placeholder: 'Budget, what they loved, what they asked for. Only you see this.', maxlength: '2000', style: { width: '100%', resize: 'vertical' } }, note)
    ta.addEventListener('input', () => { note = ta.value })
    ta.addEventListener('blur', () => { if (note !== noteSaved) { noteSaved = note; upsert({ note }) } })
    body.appendChild(ta)
    if (done.length) {
      body.appendChild(h('button', { class: 'linkbtn', style: { marginTop: '16px' }, onclick: () => { showDone = !showDone; draw() } }, (showDone ? 'Hide ' : 'Show ') + done.length + ' completed'))
      if (showDone) done.forEach(x => body.appendChild(h('div', { class: 'muted small', style: { textDecoration: 'line-through', padding: '6px 0' } }, x.title)))
    }
  }
  draw()
}
