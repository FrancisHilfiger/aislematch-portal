import { h, clear, icon, field, fmtDate, today, MONL } from './lib.js'
import { loadLeads } from './data.js'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const BOOKED = ['confirmed', 'deposited', 'paid', 'completed']
const MIN_OPTIONS = [[0, 'Any event'], [120, '2 hrs +'], [240, '4 hrs +'], [1440, 'All-day only']]
const DN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PROVIDERS = [
  { id: 'google', name: 'Google', steps: ['On a computer, open Google Calendar and click the cog, then Settings.', 'Under “Settings for my calendars” click your calendar, then scroll to “Integrate calendar”.', 'Copy the “Secret address in iCal format” and paste it below.'] },
  { id: 'apple', name: 'Apple', steps: ['Open Calendar on icloud.com.', 'Click the share icon beside your calendar and tick “Public Calendar”.', 'Copy the link and paste it below. Anyone with that link can see the calendar, so use a calendar that only holds your work.'] },
  { id: 'outlook', name: 'Outlook', steps: ['Open Outlook on the web, then Settings, Calendar, Shared calendars.', 'Under “Publish a calendar” choose your calendar and “Can view when I’m busy”, then Publish.', 'Copy the ICS link and paste it below.'] },
]
const cap1 = (t) => t.charAt(0).toUpperCase() + t.slice(1)
const daysText = (arr) => {
  const a = [...arr].sort((x, y) => x - y), k = a.join(',')
  if (k === '1,2,3,4,5') return 'weekdays'
  if (k === '6,7') return 'weekends'
  if (a.length === 7) return 'every day'
  if (a.length > 2 && a.every((v, i) => i === 0 || v === a[i - 1] + 1)) return DN[a[0] - 1] + '–' + DN[a[a.length - 1] - 1]
  return a.map(v => DN[v - 1]).join(', ')
}
const everyText = (n) => n === 1 ? 'every week' : 'every ' + ['', '', '2nd', '3rd', '4th'][n] + ' week'
const ruleText = (r) => cap1(daysText(r.weekdays)) + ', ' + everyText(r.every_n_weeks)
const DAYMS = 86400000
const recurMatch = (r, key) => {
  if (key < r.starts_on || (r.ends_on && key > r.ends_on)) return false
  if ((r.except_dates || []).indexOf(key) >= 0) return false
  const d = new Date(key + 'T00:00:00Z'), a = new Date(r.starts_on + 'T00:00:00Z')
  const iso = (d.getUTCDay() + 6) % 7 + 1
  if (r.weekdays.indexOf(iso) < 0) return false
  const aMon = a.getTime() - ((a.getUTCDay() + 6) % 7) * DAYMS
  return Math.floor((d.getTime() - aMon) / (7 * DAYMS)) % r.every_n_weeks === 0
}

export async function renderCalendar(C, view) {
  view.appendChild(h('div', { class: 'pagehead' }, h('div', { class: 'eyebrow' }, 'Availability'), h('h1', { class: 'h1' }, 'Calendar'),
    h('p', null, 'Booked weddings, days you block and days you are busy in your own calendar all close the date to new bookings.')))
  const host = h('div'); view.appendChild(host)
  host.appendChild(h('div', { class: 'spin' }))
  const vid = C.vendor.id
  let blocks = [], recur = [], bookings = [], proposals = [], leads = [], busy = [], settings = null, defaultCap = 1
  const load = async () => {
    const [b, bk, pr, ld, bz, st, dc, rc] = await Promise.all([
      C.sb.from('vendor_blocked_dates').select('*').eq('vendor_id', vid).then(r => { if (r.error) throw r.error; return r.data || [] }),
      C.sb.from('bookings').select('id, couple_id, status, event_date, total_amount, package_name').eq('vendor_id', vid).in('status', BOOKED).then(r => r.data || []),
      C.sb.from('booking_proposals').select('id, couple_id, event_date, proposed_by').eq('vendor_id', vid).eq('status', 'open').then(r => r.data || []),
      loadLeads(C.sb, vid).catch(() => []),
      C.sb.from('vendor_external_busy').select('busy_date, source').eq('vendor_id', vid).gte('busy_date', today()).then(r => r.data || []),
      C.sb.rpc('my_calendar_settings', { p_vendor: vid }).then(r => r.data || null),
      C.sb.rpc('default_events_per_day', { p_vendor: vid }).then(r => (typeof r.data === 'number' ? r.data : 1)),
      C.sb.from('vendor_recurring_blocks').select('*').eq('vendor_id', vid).then(r => r.data || []),
    ])
    blocks = b; bookings = bk; proposals = pr; leads = ld; busy = bz; settings = st; defaultCap = dc; recur = rc
  }
  try { await load() } catch (e) { clear(host); host.appendChild(h('div', { class: 'empty' }, h('h2', { class: 'h3' }, 'Could not load your calendar'), h('p', null, C.err(e)))); return }

  const now = new Date()
  let y = now.getFullYear(), m = now.getMonth()
  const cap = () => (settings && settings.max_events_per_day) || defaultCap
  const nameOf = (cid) => { const l = leads.find(x => x.coupleId === cid); return l ? l.coupleName + (l.partnerName ? ' & ' + l.partnerName : '') : 'Couple' }
  const blockFor = (d) => blocks.find(b => b.start_date <= d && b.end_date >= d)
  const bookingsOn = (d) => bookings.filter(b => b.event_date === d)
  const recurFor = (d) => recur.find(r => recurMatch(r, d))
  const busyOn = (d) => busy.some(x => x.busy_date === d)

  const draw = () => {
    clear(host)
    const first = new Date(y, m, 1)
    const lead = (first.getDay() + 6) % 7
    const dim = new Date(y, m + 1, 0).getDate()
    const t = today()
    const head = h('div', { class: 'calhead' },
      h('button', { class: 'iconbtn', 'aria-label': 'Previous month', onclick: () => { m--; if (m < 0) { m = 11; y-- } draw() } }, icon('back')),
      h('div', { class: 'h2' }, MONL[m] + ' ' + y),
      h('button', { class: 'iconbtn', 'aria-label': 'Next month', onclick: () => { m++; if (m > 11) { m = 0; y++ } draw() } }, icon('chev')))
    const grid = h('div', { class: 'calgrid' }, DOW.map(d => h('div', { class: 'dow' }, d)))
    for (let i = 0; i < lead; i++) grid.appendChild(h('div', { class: 'cell out', 'aria-hidden': 'true' }))
    for (let d = 1; d <= dim; d++) {
      const key = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
      const bks = bookingsOn(key)
      const blk = blockFor(key)
      const rec = blk ? null : recurFor(key)
      const pend = proposals.find(p => p.event_date === key)
      const bz = busyOn(key)
      const cls = ['cell']
      if (key === t) cls.push('today')
      if (bks.length) cls.push('booked'); else if (blk || rec) cls.push('blocked'); else if (bz) cls.push('busy'); else if (pend) cls.push('pending')
      const label = d + ' ' + MONL[m] + (bks.length ? ', booked' : (blk || rec) ? ', blocked' : bz ? ', busy' : pend ? ', proposal pending' : '')
      grid.appendChild(h('button', { class: cls.join(' '), 'aria-label': label, onclick: () => daySheet(key, bks, blk, pend, bz, rec) },
        h('span', { class: 'n' }, String(d)), bks.length > 1 ? h('span', { class: 'cnt' }, String(bks.length)) : null))
    }
    host.append(h('div', { class: 'cal' }, head, grid),
      h('div', { class: 'legend' },
        h('span', null, h('i', { style: { background: 'var(--ink)' } }), 'Booked'),
        h('span', null, h('i', { style: { background: 'repeating-linear-gradient(135deg, rgba(183,194,200,.6) 0 4px, rgba(183,194,200,.2) 4px 8px)' } }), 'Blocked'),
        h('span', null, h('i', { style: { background: '#ebddbf' } }), 'Busy (your calendar)'),
        h('span', null, h('i', { style: { boxShadow: 'inset 0 0 0 1.5px var(--steel-d)', border: 0 } }), 'Proposal pending')),
      h('p', { class: 'muted small', style: { marginTop: '10px' } }, 'You take up to ' + cap() + ' booking' + (cap() > 1 ? 's' : '') + ' per day' + (settings && settings.max_events_per_day ? '.' : ' (default for your category).')),
      h('div', { class: 'sp16' }),
      h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => blockSheet(t) }, 'Block dates'), h('button', { class: 'btn ghost', onclick: () => settingsSheet() }, 'Calendar settings')),
      ...[listRecurring(), listUpcomingBlocks()].filter(Boolean))
  }

  const listRecurring = () => {
    if (!recur.length) return null
    return h('div', { class: 'sec' }, h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'Repeating blocks')),
      h('div', { class: 'list', style: { borderTop: 0 } }, recur.map(r =>
        h('div', { class: 'item' }, h('div', { class: 'body' },
          h('div', { class: 't' }, ruleText(r)),
          h('div', { class: 's' }, (r.reason || 'No reason added') + ' · from ' + fmtDate(r.starts_on) + (r.ends_on ? ' to ' + fmtDate(r.ends_on) : ', until you remove it'))),
          h('button', { class: 'linkbtn bad', onclick: () => removeRule(r) }, 'Remove')))))
  }
  const removeRule = async (r) => {
    const { error } = await C.sb.from('vendor_recurring_blocks').delete().eq('id', r.id)
    if (error) { C.toast(C.err(error), true); return }
    recur = recur.filter(x => x.id !== r.id); C.toast('Repeating block removed'); draw()
  }

  const listUpcomingBlocks = () => {
    const t = today()
    const up = blocks.filter(b => b.end_date >= t).sort((a, b) => a.start_date < b.start_date ? -1 : 1)
    if (!up.length) return null
    return h('div', { class: 'sec' }, h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'Blocked dates')),
      h('div', { class: 'list', style: { borderTop: 0 } }, up.map(b =>
        h('div', { class: 'item' }, h('div', { class: 'body' },
          h('div', { class: 't' }, b.start_date === b.end_date ? fmtDate(b.start_date) : fmtDate(b.start_date) + ' to ' + fmtDate(b.end_date)),
          h('div', { class: 's' }, b.reason || 'No reason added')),
          h('button', { class: 'linkbtn bad', onclick: () => unblock(b) }, 'Unblock')))))
  }

  const unblock = async (b) => {
    const { error } = await C.sb.from('vendor_blocked_dates').delete().eq('id', b.id)
    if (error) { C.toast(C.err(error), true); return }
    blocks = blocks.filter(x => x.id !== b.id); C.toast('Dates unblocked'); draw()
  }

  const daySheet = (key, bks, blk, pend, bz, rec) => {
    if (bks.length) {
      const s = C.sheet({ title: fmtDate(key), body: h('div', null,
        bks.map(bk => h('div', { class: 'kv', style: { marginBottom: '14px' } },
          h('div', null, h('span', { class: 'k' }, 'Couple'), h('span', { class: 'v' }, nameOf(bk.couple_id))),
          bk.package_name ? h('div', null, h('span', { class: 'k' }, 'Package'), h('span', { class: 'v' }, bk.package_name)) : null,
          h('div', null, h('span', { class: 'k' }, 'Status'), h('span', { class: 'v' }, bk.status)),
          bk.total_amount != null ? h('div', null, h('span', { class: 'k' }, 'Total'), h('span', { class: 'v' }, '$' + Number(bk.total_amount).toLocaleString('en-AU'))) : null,
          h('div', { class: 'actions', style: { marginTop: '10px' } },
            h('button', { class: 'btn sm', onclick: () => { s.close(); C.go('leads/' + bk.couple_id) } }, 'Open booking'),
            h('button', { class: 'btn ghost sm', onclick: () => { s.close(); C.go('runsheet/' + bk.couple_id) } }, 'Runsheet'))))),
        footer: null })
      return
    }
    if (blk) {
      const s = C.sheet({ title: fmtDate(key), body: h('div', null, h('p', null, 'Blocked' + (blk.reason ? ': ' + blk.reason : '.')),
        blk.start_date !== blk.end_date ? h('p', { class: 'muted small' }, 'This block runs ' + fmtDate(blk.start_date) + ' to ' + fmtDate(blk.end_date) + '. Unblocking removes the whole block.') : null),
        footer: [h('button', { class: 'btn ghost', onclick: () => s.close() }, 'Close'), h('button', { class: 'btn', onclick: async () => { s.close(); await unblock(blk) } }, 'Unblock')] })
      return
    }
    if (rec) {
      const s = C.sheet({ title: fmtDate(key), body: h('div', null, h('p', null, 'Repeating block: ' + ruleText(rec) + (rec.reason ? ' (' + rec.reason + ')' : '') + '.'),
        h('p', { class: 'muted small' }, 'Open just this day to take a booking on it, or remove the whole repeating block.')),
        footer: [h('button', { class: 'btn ghost', onclick: async () => {
          const ex = [...(rec.except_dates || []), key]
          const { error } = await C.sb.from('vendor_recurring_blocks').update({ except_dates: ex }).eq('id', rec.id)
          if (error) { C.toast(C.err(error), true); return }
          rec.except_dates = ex; s.close(); C.toast('That day is open'); draw()
        } }, 'Open just this day'), h('button', { class: 'btn', onclick: async () => { s.close(); await removeRule(rec) } }, 'Remove repeating block')] })
      return
    }
    if (bz) {
      const s = C.sheet({ title: fmtDate(key), body: h('p', null, 'You have something in your linked calendar on this day, so couples see it as unavailable. Remove the event from your calendar, or change which events count in Calendar settings.'),
        footer: [h('button', { class: 'btn ghost', onclick: () => s.close() }, 'Close'), h('button', { class: 'btn', onclick: () => { s.close(); settingsSheet() } }, 'Calendar settings')] })
      return
    }
    if (pend) {
      const s = C.sheet({ title: fmtDate(key), body: h('p', null, 'There is an open booking proposal for this date with ' + nameOf(pend.couple_id) + '. It does not hold the date until it is accepted.'),
        footer: [h('button', { class: 'btn', onclick: () => { s.close(); C.go('leads/' + pend.couple_id) } }, 'View proposal')] })
      return
    }
    if (key < today()) { C.toast('That date has passed'); return }
    blockSheet(key)
  }

  const blockSheet = (startKey) => {
    const base = startKey < today() ? today() : startKey
    let mode = 'once', days = new Set(), every = 1, endMode = 'never'
    const a = h('input', { class: 'input', type: 'date', min: today(), value: base })
    const b = h('input', { class: 'input', type: 'date', min: today(), value: base })
    const from = h('input', { class: 'input', type: 'date', min: today(), value: base })
    const until = h('input', { class: 'input', type: 'date', min: today(), value: base })
    const why = h('input', { class: 'input', type: 'text', maxlength: '80', placeholder: 'Holiday, another job, personal' })
    a.addEventListener('change', () => { if (b.value < a.value) b.value = a.value })
    const err = h('div', { style: { color: 'var(--bad)', fontSize: '14px', marginTop: '8px' } })
    const save = h('button', { class: 'btn' }, 'Block dates')
    const tabs = h('div', { class: 'chips', style: { marginBottom: '16px' } })
    const onceBox = h('div', null, h('div', { class: 'row2' }, field('From', a), field('To', b)))
    const dayChips = h('div', { class: 'chips' }), presetChips = h('div', { class: 'chips' }), everyChips = h('div', { class: 'chips' }), endChips = h('div', { class: 'chips' })
    const summary = h('p', { class: 'summary' })
    const untilBox = h('div')
    const repBox = h('div')
    const chip = (label, on, fn) => h('button', { class: 'chip' + (on ? ' on' : ''), type: 'button', onclick: fn }, label)
    const setDays = (arr) => { days = new Set(arr); paintRep() }
    const paintRep = () => {
      clear(dayChips); clear(presetChips); clear(everyChips); clear(endChips); clear(untilBox)
      DN.forEach((n, i) => dayChips.appendChild(chip(n, days.has(i + 1), () => { days.has(i + 1) ? days.delete(i + 1) : days.add(i + 1); paintRep() })))
      ;[['Weekdays', [1, 2, 3, 4, 5]], ['Weekends', [6, 7]], ['Mon–Wed', [1, 2, 3]], ['Clear', []]].forEach(([l, arr]) => presetChips.appendChild(chip(l, false, () => setDays(arr))))
      ;[1, 2, 3, 4].forEach(n => everyChips.appendChild(chip(cap1(everyText(n)), every === n, () => { every = n; paintRep() })))
      ;[['never', 'Never'], ['date', 'On a date']].forEach(([k, l]) => endChips.appendChild(chip(l, endMode === k, () => { endMode = k; paintRep() })))
      if (endMode === 'date') untilBox.appendChild(field('Last day', until))
      const d = [...days]
      summary.textContent = !d.length ? 'Choose the days you want blocked.' :
        'Blocks ' + daysText(d) + ', ' + everyText(every) + (every > 1 ? ', starting the week of ' + fmtDate(from.value) : ', from ' + fmtDate(from.value)) + (endMode === 'date' ? ' until ' + fmtDate(until.value) : ' until you remove it') + '.'
    }
    from.addEventListener('change', paintRep); until.addEventListener('change', paintRep)
    repBox.append(
      h('div', { class: 'lbl' }, 'Which days?'), dayChips, h('div', { class: 'presetrow' }, h('span', { class: 'muted small' }, 'Quick pick:'), presetChips),
      h('div', { class: 'lbl' }, 'How often?'), everyChips,
      field('Starting', from),
      h('div', { class: 'lbl' }, 'Ends'), endChips, untilBox, summary)
    const paintTabs = () => {
      clear(tabs)
      tabs.appendChild(chip('Specific dates', mode === 'once', () => { mode = 'once'; paintTabs() }))
      tabs.appendChild(chip('Repeating', mode === 'repeat', () => { mode = 'repeat'; paintTabs() }))
      onceBox.style.display = mode === 'once' ? '' : 'none'
      repBox.style.display = mode === 'repeat' ? '' : 'none'
      save.textContent = mode === 'once' ? 'Block dates' : 'Block repeating days'
    }
    paintRep(); paintTabs()
    const s = C.sheet({ title: 'Block dates', body: h('div', null, tabs, onceBox, repBox, field('Reason (only you see this)', why), err),
      footer: [h('button', { class: 'btn ghost', onclick: () => s.close() }, 'Cancel'), save] })
    save.addEventListener('click', async () => {
      err.textContent = ''
      if (mode === 'once') {
        if (!a.value || !b.value) { err.textContent = 'Choose both dates.'; return }
        if (b.value < a.value) { err.textContent = 'The end date is before the start date.'; return }
        save.disabled = true
        const { data, error } = await C.sb.from('vendor_blocked_dates').insert({ vendor_id: vid, start_date: a.value, end_date: b.value, reason: why.value.trim() || null }).select('*').single()
        if (error) { save.disabled = false; err.textContent = C.err(error); return }
        blocks.push(data); s.close(); C.toast('Dates blocked'); draw()
        return
      }
      if (!days.size) { err.textContent = 'Choose at least one day of the week.'; return }
      if (!from.value) { err.textContent = 'Choose a starting date.'; return }
      if (endMode === 'date' && (!until.value || until.value < from.value)) { err.textContent = 'The last day is before the start date.'; return }
      save.disabled = true
      const row = { vendor_id: vid, weekdays: [...days].sort((x, y) => x - y), every_n_weeks: every, starts_on: from.value, ends_on: endMode === 'date' ? until.value : null, reason: why.value.trim() || null }
      const { data, error } = await C.sb.from('vendor_recurring_blocks').insert(row).select('*').single()
      if (error) { save.disabled = false; err.textContent = C.err(error); return }
      recur.push(data); s.close(); C.toast('Repeating block saved'); draw()
    })
  }

  /* ---------- settings ---------- */
  const patchSettings = async (p) => {
    const { data, error } = await C.sb.from('vendor_calendar_settings').update({ ...p, updated_at: new Date().toISOString() }).eq('vendor_id', vid).select('*').single()
    if (error) { C.toast(C.err(error), true); return null }
    settings = data; return data
  }
  const feedUrl = () => settings && settings.feed_token ? C.cfg.supabaseUrl + '/functions/v1/calendar-feed?token=' + settings.feed_token : ''

  const settingsSheet = () => {
    const body = h('div')
    const s = C.sheet({ title: 'Calendar settings', body, onClose: () => { load().then(draw).catch(() => draw()) } })
    const paint = () => {
      clear(body)
      // bookings per day
      const val = h('div', { class: 'stepval' }, String(cap()))
      const step = (n) => async () => {
        const next = cap() + n; if (next < 1 || next > 10) return
        if (await patchSettings({ max_events_per_day: next })) { val.textContent = String(cap()); paintHint() }
      }
      const hint = h('p', { class: 'muted small' })
      const paintHint = () => {
        clear(hint); hint.appendChild(document.createTextNode('Default for your category: ' + defaultCap + '. '))
        if (settings && settings.max_events_per_day != null) hint.appendChild(h('button', { class: 'linkbtn', onclick: async () => { if (await patchSettings({ max_events_per_day: null })) { val.textContent = String(cap()); paintHint() } } }, 'Reset to default'))
      }
      paintHint()
      body.appendChild(h('div', { class: 'panel' }, h('div', { class: 'h3' }, 'Bookings per day'),
        h('p', { class: 'muted small' }, 'How many bookings you can take on the same date. A day closes to new bookings once it is full.'),
        h('div', { class: 'stepper' }, h('button', { class: 'iconbtn', 'aria-label': 'Fewer', onclick: step(-1) }, '−'), val, h('button', { class: 'iconbtn', 'aria-label': 'More', onclick: step(1) }, '+')), hint))

      // connect a calendar
      const linked = !!(settings && settings.ics_import_url)
      const syncNow = async (quiet, btn) => {
        if (btn) btn.disabled = true
        const { data, error } = await C.sb.functions.invoke('calendar-sync', { body: { vendor_id: vid } })
        let msg = error ? error.message : null
        if (error) { try { const j = await error.context.json(); if (j && j.error) msg = j.error } catch (e) { /* default */ } }
        const { data: fresh } = await C.sb.rpc('my_calendar_settings', { p_vendor: vid }); if (fresh) settings = fresh
        if (btn) btn.disabled = false
        if (msg) { if (!quiet) C.toast(msg, true); return false }
        if (!quiet) C.toast((data && data.days != null ? data.days : 0) + ' busy days imported')
        return true
      }
      const panel = h('div', { class: 'panel' })
      body.appendChild(panel)
      const paintLink = (pick) => {
        clear(panel)
        panel.appendChild(h('div', { class: 'h3' }, 'Connect your calendar'))
        if (linked) {
          const when = settings.ics_synced_at ? 'Last synced ' + new Date(settings.ics_synced_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + '.' : ''
          panel.appendChild(h('p', { class: 'ok small' }, '✓ Connected. ' + when + ' Updates every day.'))
          if (settings.ics_error) panel.appendChild(h('p', { class: 'small', style: { color: 'var(--bad)' } }, settings.ics_error))
          const sync = h('button', { class: 'btn sm' }, 'Sync now')
          sync.addEventListener('click', async () => { await syncNow(false, sync); paint() })
          panel.appendChild(h('div', { class: 'actions' }, sync, h('button', { class: 'btn ghost sm', onclick: async () => {
            await C.sb.from('vendor_external_busy').delete().eq('vendor_id', vid).eq('source', 'ics')
            await patchSettings({ ics_import_url: null, ics_error: null, ics_synced_at: null }); paint(); C.toast('Calendar disconnected')
          } }, 'Disconnect')))
          return
        }
        panel.appendChild(h('p', { class: 'muted small' }, 'Days you are busy in your own calendar close automatically for couples. We only save the dates, never event names. Which calendar do you use?'))
        panel.appendChild(h('div', { class: 'chips' }, PROVIDERS.map(p => h('button', { class: 'chip' + (pick === p.id ? ' on' : ''), type: 'button', onclick: () => paintLink(p.id) }, p.name))))
        const pv = PROVIDERS.find(p => p.id === pick)
        if (pv) {
          const url = h('input', { class: 'input', type: 'url', placeholder: 'Paste the link here', autocomplete: 'off' })
          const go = h('button', { class: 'btn sm' }, 'Connect')
          go.addEventListener('click', async () => {
            const v = url.value.trim()
            if (!/^(https|webcal):\/\//i.test(v)) { C.toast('Paste the calendar link. It starts with https:// or webcal://', true); return }
            go.disabled = true
            if (!(await patchSettings({ ics_import_url: v, ics_error: null }))) { go.disabled = false; return }
            await syncNow(false); paint()
          })
          panel.appendChild(h('ol', { class: 'steps' }, pv.steps.map(t => h('li', null, t))))
          panel.appendChild(url)
          panel.appendChild(h('div', { class: 'actions', style: { marginTop: '10px' } }, go))
        }
        panel.appendChild(h('p', { class: 'muted small', style: { marginTop: '12px' } }, 'Prefer your phone? The Aisle Match app can link your phone’s calendar in one tap.'))
      }
      paintLink(null)

      if (linked) {
        const chips = h('div', { class: 'chips' })
        MIN_OPTIONS.forEach(([v, l]) => chips.appendChild(h('button', { class: 'chip' + (((settings && settings.min_busy_minutes) != null ? settings.min_busy_minutes : 240) === v ? ' on' : ''), type: 'button', onclick: async () => {
          if (await patchSettings({ min_busy_minutes: v })) { paint(); syncNow(true) }
        } }, l)))
        body.appendChild(h('div', { class: 'panel' }, h('div', { class: 'h3' }, 'Which events block a day?'),
          h('p', { class: 'muted small' }, 'All-day events always block. Shorter events only block if they are at least this long, so a dentist appointment does not close your whole day.'), chips))
      }

      // outbound feed
      const f = feedUrl()
      if (f) {
        const copy = h('button', { class: 'btn ghost sm', onclick: async () => { try { await navigator.clipboard.writeText(f); C.toast('Link copied') } catch (e) { window.prompt('Copy this link', f) } } }, 'Copy link')
        const apple = h('a', { class: 'btn sm', href: f.replace(/^https:/, 'webcal:'), style: { textDecoration: 'none' } }, 'Add to Apple Calendar')
        const reset = h('button', { class: 'linkbtn bad', onclick: async () => {
          const { error } = await C.sb.rpc('rotate_calendar_feed_token', { p_vendor: vid })
          if (error) { C.toast(C.err(error), true); return }
          const { data: fresh } = await C.sb.rpc('my_calendar_settings', { p_vendor: vid }); if (fresh) settings = fresh
          paint(); C.toast('Link reset')
        } }, 'Reset link')
        body.appendChild(h('div', { class: 'panel' }, h('div', { class: 'h3' }, 'Send your bookings to your calendar'),
          h('p', { class: 'muted small' }, 'Subscribe once and every confirmed Aisle Match booking appears in your own calendar and stays up to date. Google: Other calendars → From URL. This link is private to you; anyone with it can see your booking dates and couple names.'),
          h('div', { class: 'actions' }, apple, copy), h('div', { class: 'sp8' }), reset))
      }
    }
    paint()
  }

  draw()
}
