import { h, clear, icon, field, fmtDate, fmtMoney, ago, initial, today, img } from './lib.js'
import { loadLeads, ensureConversation, loadAnswers } from './data.js'
import { openWeddingDay } from './weddingday.js'

const TABS = [['leads', 'Leads'], ['upcoming', 'Upcoming'], ['completed', 'Completed']]

export async function renderLeads(C, view, parts) {
  if (parts[0]) return renderDetail(C, view, parts[0])
  view.appendChild(h('div', { class: 'pagehead' }, h('div', { class: 'eyebrow' }, 'Couples'), h('h1', { class: 'h1' }, 'Leads'),
    h('p', null, 'Couples who saved your profile, and the weddings you have booked.')))
  const host = h('div'); view.appendChild(host)
  host.appendChild(h('div', null, [1, 2, 3, 4].map(() => h('div', { class: 'skel' }))))
  let all = []
  try { all = await loadLeads(C.sb, C.vendor.id) } catch (e) { clear(host); host.appendChild(h('div', { class: 'empty' }, h('h2', { class: 'h3' }, 'Could not load leads'), h('p', null, C.err(e)))); return }
  let tab = 'leads'
  try { const s = sessionStorage.getItem('ap-leadtab'); if (s) tab = s } catch (e) { /* ignore */ }

  const draw = () => {
    clear(host)
    const counts = {}; TABS.forEach(([k]) => { counts[k] = all.filter(l => l.tab === k).length })
    host.appendChild(h('div', { class: 'seg', role: 'tablist' }, TABS.map(([k, label]) =>
      h('button', { role: 'tab', 'aria-selected': String(tab === k), onclick: () => { tab = k; try { sessionStorage.setItem('ap-leadtab', k) } catch (e) { /* ignore */ } draw() } },
        label, h('span', { class: 'c' }, String(counts[k]))))))
    const rows = all.filter(l => l.tab === tab)
    if (!rows.length) {
      const msg = { leads: ['No open leads', 'New couples appear here as soon as they save your profile.'], upcoming: ['Nothing booked yet', 'Confirmed weddings stay here until the day has passed.'], completed: ['No completed weddings', 'Finished weddings move here automatically.'] }[tab]
      host.appendChild(h('div', { class: 'empty' }, h('h2', { class: 'h3' }, msg[0]), h('p', null, msg[1])))
      return
    }
    host.appendChild(h('div', { class: 'list' }, rows.map(l =>
      h('button', { class: 'item' + (l.unread ? ' unread' : ''), onclick: () => C.go('leads/' + l.coupleId) },
        h('div', { class: 'avatar' }, l.avatar ? h('img', { src: img(l.avatar, 120), alt: '', loading: 'lazy' }) : initial(l.coupleName)),
        h('div', { class: 'body' },
          h('div', { class: 't' }, l.coupleName + (l.partnerName ? ' & ' + l.partnerName : '')),
          h('div', { class: 's' }, l.preview || [fmtDate(l.weddingDate), l.location].filter(Boolean).join('  ·  '))),
        h('div', { class: 'meta' },
          l.isNew ? h('span', { class: 'tag new' }, 'New') : (l.unread ? h('span', { class: 'tag new' }, String(l.unread)) : null),
          h('div', null, ago(l.lastAt || l.createdAt)))))))
  }
  draw()
}

async function renderDetail(C, view, coupleId) {
  const back = h('button', { class: 'linkbtn', onclick: () => C.go('leads') }, '← All leads')
  view.appendChild(back)
  const host = h('div'); view.appendChild(host)
  host.appendChild(h('div', { class: 'spin' }))
  let all = []
  try { all = await loadLeads(C.sb, C.vendor.id) } catch (e) { clear(host); host.appendChild(h('p', { class: 'muted' }, C.err(e))); return }
  const lead = all.find(l => l.coupleId === coupleId)
  clear(host)
  if (!lead) { host.appendChild(h('div', { class: 'empty' }, h('h2', { class: 'h3' }, 'Lead not found'), h('p', null, 'This couple may have been removed from your list.'))); return }

  const names = lead.coupleName + (lead.partnerName ? ' & ' + lead.partnerName : '')
  host.appendChild(h('div', { class: 'pagehead', style: { display: 'flex', gap: '16px', alignItems: 'center', marginTop: '10px' } },
    h('div', { class: 'avatar lg' }, lead.avatar ? h('img', { src: img(lead.avatar, 200), alt: '' }) : initial(lead.coupleName)),
    h('div', { style: { minWidth: 0 } }, h('div', { class: 'eyebrow' }, lead.tab === 'leads' ? 'Lead' : lead.tab === 'upcoming' ? 'Upcoming wedding' : 'Completed'),
      h('h1', { class: 'h1', style: { fontSize: '30px', overflowWrap: 'anywhere' } }, names))))

  const kv = []
  const add = (k, v) => { if (v) kv.push(h('div', null, h('span', { class: 'k' }, k), h('span', { class: 'v' }, v))) }
  add('Wedding date', lead.weddingDate ? fmtDate(lead.weddingDate) : 'Not set yet')
  add('Location', lead.location)
  add('Guests', lead.guests ? String(lead.guests) : '')
  add('Budget', lead.budget ? fmtMoney(lead.budget) : '')
  add('Styles', Array.isArray(lead.styles) ? lead.styles.map(s => String(s).replace(/_/g, ' ')).join(', ') : '')
  add('Saved you', fmtDate(lead.createdAt) )
  host.appendChild(h('div', { class: 'kv' }, kv))

  // primary actions
  const msgBtn = h('button', { class: 'btn' }, icon('chat'), 'Message')
  msgBtn.addEventListener('click', async () => {
    msgBtn.disabled = true
    try { const conv = await ensureConversation(C.sb, C.vendor.id, lead); C.go('messages/' + conv.id) }
    catch (e) { msgBtn.disabled = false; C.toast(C.err(e), true) }
  })
  host.appendChild(h('div', { class: 'sp24' }))
  const wdBtn = h('button', { class: 'btn ghost' }, 'Wedding day questionnaire')
  wdBtn.addEventListener('click', () => openWeddingDay(C, lead, names))
  const actionsRow = h('div', { class: 'actions' }, msgBtn, wdBtn)
  host.appendChild(actionsRow)
  // "View runsheet" only appears when a runsheet exists that this vendor is on
  C.sb.from('runsheet_participants').select('runsheet_id, runsheets!inner(couple_id)').eq('vendor_id', C.vendor.id).eq('runsheets.couple_id', lead.coupleId).limit(1)
    .then(r => { if (r.data && r.data.length) actionsRow.appendChild(h('button', { class: 'btn ghost', onclick: () => C.go('runsheet/' + lead.coupleId) }, 'View runsheet')) })

  // booking
  const bookHost = h('div', { class: 'sec' }); host.appendChild(bookHost)
  bookingPanel(C, bookHost, lead)

  // answers
  const ansHost = h('div', { class: 'sec' }); host.appendChild(ansHost)
  ansHost.appendChild(h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'About their day')))
  const ansBody = h('div', { class: 'answers' }, h('div', { class: 'spin' })); ansHost.appendChild(ansBody)
  loadAnswers(C.sb, C.vendor.id, lead.coupleId).then(rows => {
    clear(ansBody)
    if (!rows.length) ansBody.appendChild(h('p', { class: 'muted' }, 'This couple has not filled in their questionnaire yet.'))
    else rows.forEach(r => ansBody.appendChild(h('div', { class: 'a' }, h('div', { class: 'q' }, r.label), h('div', { class: 'r' }, r.value))))
  }).catch(() => { clear(ansBody); ansBody.appendChild(h('p', { class: 'muted' }, 'Could not load their answers.')) })

  // status moves
  const moveHost = h('div', { class: 'sec' }); host.appendChild(moveHost)
  moveHost.appendChild(h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'Manage')))
  const setStatus = async (status, label) => {
    const { error } = await C.sb.from('matches').update({ vendor_status: status, vendor_status_updated_at: new Date().toISOString() }).eq('id', lead.matchId)
    if (error) { C.toast(C.err(error), true); return }
    C.toast(label); C.go('leads')
  }
  const rows = []
  if (lead.tab === 'leads') rows.push(['Mark as upcoming', 'Move this couple to your upcoming weddings.', () => setStatus('upcoming', 'Moved to upcoming')])
  if (lead.tab === 'upcoming') rows.push(['Mark as completed', 'The wedding has happened.', () => setStatus('completed', 'Marked as completed')])
  if (!lead.isBooked && lead.tab !== 'leads') rows.push(['Move back to leads', 'Treat this couple as an open lead again.', () => setStatus('new', 'Moved back to leads')])
  rows.forEach(([t, s, fn]) => moveHost.appendChild(h('div', { class: 'pill-row' }, h('div', null, h('div', { class: 'l1' }, t), h('div', { class: 'l2' }, s)), h('button', { class: 'btn ghost sm', onclick: fn }, 'Do it'))))
  moveHost.appendChild(h('div', { class: 'pill-row' },
    h('div', null, h('div', { class: 'l1' }, 'Remove from my list'), h('div', { class: 'l2' }, 'Hides this couple from your leads. Messages are kept.')),
    h('button', { class: 'btn danger sm', onclick: () => {
      const s = C.sheet({ title: 'Remove this lead?', body: h('p', { class: 'muted' }, names + ' will be hidden from your lists. They can still message you.'),
        footer: [h('button', { class: 'btn ghost', onclick: () => s.close() }, 'Keep'),
          h('button', { class: 'btn', onclick: async () => {
            const { error } = await C.sb.from('matches').update({ vendor_hidden: true, vendor_hidden_at: new Date().toISOString() }).eq('id', lead.matchId)
            s.close()
            if (error) { C.toast(C.err(error), true); return }
            C.toast('Removed'); C.go('leads')
          } }, 'Remove')] })
    } }, 'Remove')))
}

/* ---------------- booking ---------------- */
async function callBooking(C, body) {
  const { data, error } = await C.sb.functions.invoke('booking-flow', { body })
  if (error) {
    let msg = error.message
    try { const j = await error.context.json(); if (j && j.error) msg = j.error } catch (e) { /* keep default */ }
    throw new Error(msg)
  }
  if (data && data.error) throw new Error(data.error)
  return data
}

function bookingPanel(C, host, lead) {
  const base = { couple_id: lead.coupleId, vendor_id: C.vendor.id }
  const render = (st) => {
    clear(host)
    host.appendChild(h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'Booking')))
    const bk = st.booking, op = st.open_proposal
    const line = (k, v) => v ? h('div', null, h('span', { class: 'k' }, k), h('span', { class: 'v' }, v)) : null
    if (bk) {
      host.appendChild(h('div', { class: 'kv' },
        line('Status', 'Confirmed'), line('Date', fmtDate(bk.event_date)), line('Total', bk.total_amount != null ? fmtMoney(bk.total_amount) : ''),
        line('Deposit', bk.deposit_amount != null ? fmtMoney(bk.deposit_amount) : '')))
      host.appendChild(h('div', { class: 'sp16' }))
      host.appendChild(h('button', { class: 'linkbtn bad', onclick: () => cancelSheet(C, base, render) }, 'Cancel this booking'))
      return
    }
    if (op) {
      const mine = op.proposed_by === 'vendor'
      host.appendChild(h('div', { class: 'panel' },
        h('div', { class: 'eyebrow' }, mine ? 'Waiting for the couple' : 'Proposal from the couple'),
        h('div', { class: 'sp8' }),
        h('div', { class: 'kv', style: { borderTop: 0 } },
          line('Date', fmtDate(op.event_date)), line('Package', op.package_name), line('Price', op.price != null ? fmtMoney(op.price) : ''),
          line('Deposit', op.deposit_amount != null ? fmtMoney(op.deposit_amount) : ''), line('Note', op.notes)),
        h('div', { class: 'sp16' }),
        mine
          ? h('div', { class: 'actions' }, h('button', { class: 'btn ghost sm', onclick: () => run('decline', { proposal_id: op.id }, 'Proposal withdrawn') }, 'Withdraw'),
              h('button', { class: 'btn sm', onclick: () => formSheet(C, base, st, render, lead) }, 'Change it'))
          : h('div', { class: 'actions' },
              h('button', { class: 'btn sm', onclick: () => run('accept', { proposal_id: op.id }, 'Booking confirmed') }, 'Accept'),
              h('button', { class: 'btn ghost sm', onclick: () => formSheet(C, base, st, render, lead) }, 'Suggest changes'),
              h('button', { class: 'btn danger sm', onclick: () => declineSheet(C, base, op, render) }, 'Decline'))))
      return
    }
    host.appendChild(h('p', { class: 'muted' }, 'Agree a date, package and price with this couple. They confirm it in the app and the date is locked in your calendar.'))
    host.appendChild(h('div', { class: 'sp16' }))
    host.appendChild(h('button', { class: 'btn', onclick: () => formSheet(C, base, st, render, lead) }, 'Send a booking proposal'))
  }
  const run = async (action, extra, okMsg) => {
    try { const st = await callBooking(C, { action, ...base, ...(extra || {}) }); render(st); C.toast(okMsg) }
    catch (e) { C.toast(C.err(e), true) }
  }
  host.appendChild(h('div', { class: 'spin' }))
  callBooking(C, { action: 'get', ...base }).then(render).catch(e => { clear(host); host.appendChild(h('p', { class: 'muted' }, 'Could not load booking details. ' + C.err(e))) })
}

function formSheet(C, base, st, render, lead) {
  const prev = st.open_proposal || st.booking || {}
  const date = h('input', { class: 'input', type: 'date', min: today(), value: (prev.event_date || lead.weddingDate || '').slice(0, 10) })
  const pkgs = st.packages || []
  const pkg = h('select', { class: 'select' }, h('option', { value: '' }, 'Custom or no package'), pkgs.map(p => h('option', { value: p.id }, p.name + (p.price != null ? '  (' + fmtMoney(p.price) + ')' : ''))))
  const price = h('input', { class: 'input', type: 'number', inputmode: 'decimal', min: '0', step: '1', placeholder: '0', value: prev.price != null ? prev.price : (prev.total_amount != null ? prev.total_amount : '') })
  const dep = h('input', { class: 'input', type: 'number', inputmode: 'decimal', min: '0', step: '1', placeholder: '0', value: prev.deposit_amount != null ? prev.deposit_amount : '' })
  const notes = h('textarea', { class: 'textarea', maxlength: '600', placeholder: 'Anything the couple should know, like timings or what is included.' }, prev.notes || '')
  if (prev.package_id) pkg.value = prev.package_id
  pkg.addEventListener('change', () => {
    const p = pkgs.find(x => x.id === pkg.value); if (!p) return
    if (p.price != null) price.value = p.price
    if (p.deposit_value != null && p.price != null) {
      const pct = /percent/i.test(p.deposit_type || '')
      dep.value = pct ? Math.round(p.price * p.deposit_value) / 100 : p.deposit_value
    }
  })
  const err = h('div', { class: 'err', style: { color: 'var(--bad)', fontSize: '14px' } })
  const send = h('button', { class: 'btn' }, 'Send proposal')
  const s = C.sheet({ title: st.open_proposal ? 'Update proposal' : 'Booking proposal',
    body: h('div', null, field('Wedding date', date), field('Package', pkg),
      h('div', { class: 'row2' }, field('Price (AUD)', price), field('Deposit (AUD)', dep)), field('Note', notes), err),
    footer: [h('button', { class: 'btn ghost', onclick: () => s.close() }, 'Cancel'), send] })
  send.addEventListener('click', async () => {
    err.textContent = ''
    if (!date.value) { err.textContent = 'Choose the wedding date.'; return }
    send.disabled = true; send.textContent = 'Sending'
    try {
      const sel = pkgs.find(x => x.id === pkg.value)
      const next = await callBooking(C, { action: 'propose', ...base, event_date: date.value, package_id: pkg.value || null, package_name: sel ? sel.name : null,
        price: price.value, deposit_amount: dep.value, notes: notes.value.trim() })
      s.close(); render(next); C.toast('Proposal sent')
    } catch (e) { send.disabled = false; send.textContent = 'Send proposal'; err.textContent = C.err(e) }
  })
}

function declineSheet(C, base, op, render) {
  const reason = h('textarea', { class: 'textarea', maxlength: '300', placeholder: 'Optional. Let them know why.' })
  const go = h('button', { class: 'btn' }, 'Decline proposal')
  const s = C.sheet({ title: 'Decline this proposal?', body: field('Reason', reason), footer: [h('button', { class: 'btn ghost', onclick: () => s.close() }, 'Back'), go] })
  go.addEventListener('click', async () => {
    go.disabled = true
    try { const st = await callBooking(C, { action: 'decline', ...base, proposal_id: op.id, reason: reason.value.trim() }); s.close(); render(st); C.toast('Proposal declined') }
    catch (e) { go.disabled = false; C.toast(C.err(e), true) }
  })
}

function cancelSheet(C, base, render) {
  const reason = h('textarea', { class: 'textarea', maxlength: '300', placeholder: 'Optional. The couple will see this.' })
  const go = h('button', { class: 'btn danger' }, 'Cancel booking')
  const s = C.sheet({ title: 'Cancel this booking?',
    body: h('div', null, h('p', { class: 'muted' }, 'The date is released and the couple is told straight away. This cannot be undone.'), h('div', { class: 'sp16' }), field('Reason', reason)),
    footer: [h('button', { class: 'btn ghost', onclick: () => s.close() }, 'Keep booking'), go] })
  go.addEventListener('click', async () => {
    go.disabled = true
    try { const st = await callBooking(C, { action: 'cancel', ...base, reason: reason.value.trim() }); s.close(); render(st); C.toast('Booking cancelled') }
    catch (e) { go.disabled = false; C.toast(C.err(e), true) }
  })
}

// Opens the booking panel (propose / accept / decline / cancel) in a pop-up. Used by chat.
export function openBooking(C, lead) {
  const host = h('div')
  const s = C.sheet({ title: 'Booking', body: host })
  bookingPanel(C, host, lead)
  return s
}
