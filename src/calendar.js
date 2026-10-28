import { h, clear, icon, field, fmtDate, today, MONL } from './lib.js'
import { loadLeads } from './data.js'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const BOOKED = ['confirmed', 'deposited', 'paid', 'completed']
const MIN_OPTIONS = [[0, 'Any event'], [120, '2 hrs +'], [240, '4 hrs +'], [1440, 'All-day only']]

export async function renderCalendar(C, view) {
  view.appendChild(h('div', { class: 'pagehead' }, h('div', { class: 'eyebrow' }, 'Availability'), h('h1', { class: 'h1' }, 'Calendar'),
    h('p', null, 'Booked weddings, days you block and days you are busy in your own calendar all close the date to new bookings.')))
  const host = h('div'); view.appendChild(host)
  host.appendChild(h('div', { class: 'spin' }))
  const vid = C.vendor.id
  let blocks = [], bookings = [], proposals = [], leads = [], busy = [], settings = null, defaultCap = 1
  const load = async () => {
    const [b, bk, pr, ld, bz, st, dc] = await Promise.all([
      C.sb.from('vendor_blocked_dates').select('*').eq('vendor_id', vid).then(r => { if (r.error) throw r.error; return r.data || [] }),
      C.sb.from('bookings').select('id, couple_id, status, event_date, total_amount, package_name').eq('vendor_id', vid).in('status', BOOKED).then(r => r.data || []),
      C.sb.from('booking_proposals').select('id, couple_id, event_date, proposed_by').eq('vendor_id', vid).eq('status', 'open').then(r => r.data || []),
      loadLeads(C.sb, vid).catch(() => []),
      C.sb.from('vendor_external_busy').select('busy_date, source').eq('vendor_id', vid).gte('busy_date', today()).then(r => r.data || []),
      C.sb.rpc('my_calendar_settings', { p_vendor: vid }).then(r => r.data || null),
      C.sb.rpc('default_events_per_day', { p_vendor: vid }).then(r => (typeof r.data === 'number' ? r.data : 1)),
    ])
    blocks = b; bookings = bk; proposals = pr; leads = ld; busy = bz; settings = st; defaultCap = dc
  }
  try { await load() } catch (e) { clear(host); host.appendChild(h('div', { class: 'empty' }, h('h2', { class: 'h3' }, 'Could not load your calendar'), h('p', null, C.err(e)))); return }

  const now = new Date()
  let y = now.getFullYear(), m = now.getMonth()
  const cap = () => (settings && settings.max_events_per_day) || defaultCap
  const nameOf = (cid) => { const l = leads.find(x => x.coupleId === cid); return l ? l.coupleName + (l.partnerName ? ' & ' + l.partnerName : '') : 'Couple' }
  const blockFor = (d) => blocks.find(b => b.start_date <= d && b.end_date >= d)
  const bookingsOn = (d) => bookings.filter(b => b.event_date === d)
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
      const pend = proposals.find(p => p.event_date === key)
      const bz = busyOn(key)
      const cls = ['cell']
      if (key === t) cls.push('today')
      if (bks.length) cls.push('booked'); else if (blk) cls.push('blocked'); else if (bz) cls.push('busy'); else if (pend) cls.push('pending')
      const label = d + ' ' + MONL[m] + (bks.length ? ', booked' : blk ? ', blocked' : bz ? ', busy' : pend ? ', proposal pending' : '')
      grid.appendChild(h('button', { class: cls.join(' '), 'aria-label': label, onclick: () => daySheet(key, bks, blk, pend, bz) },
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
      listUpcomingBlocks())
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

  const daySheet = (key, bks, blk, pend, bz) => {
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
    const a = h('input', { class: 'input', type: 'date', min: today(), value: startKey < today() ? today() : startKey })
    const b = h('input', { class: 'input', type: 'date', min: today(), value: startKey < today() ? today() : startKey })
    const why = h('input', { class: 'input', type: 'text', maxlength: '80', placeholder: 'Holiday, another job, personal' })
    a.addEventListener('change', () => { if (b.value < a.value) b.value = a.value })
    const err = h('div', { style: { color: 'var(--bad)', fontSize: '14px' } })
    const save = h('button', { class: 'btn' }, 'Block dates')
    const s = C.sheet({ title: 'Block dates', body: h('div', null, h('div', { class: 'row2' }, field('From', a), field('To', b)), field('Reason (only you see this)', why), err),
      footer: [h('button', { class: 'btn ghost', onclick: () => s.close() }, 'Cancel'), save] })
    save.addEventListener('click', async () => {
      err.textContent = ''
      if (!a.value || !b.value) { err.textContent = 'Choose both dates.'; return }
      if (b.value < a.value) { err.textContent = 'The end date is before the start date.'; return }
      save.disabled = true
      const { data, error } = await C.sb.from('vendor_blocked_dates').insert({ vendor_id: vid, start_date: a.value, end_date: b.value, reason: why.value.trim() || null }).select('*').single()
      if (error) { save.disabled = false; err.textContent = C.err(error); return }
      blocks.push(data); s.close(); C.toast('Dates blocked'); draw()
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

      // which events block a day
      const chips = h('div', { class: 'chips' })
      MIN_OPTIONS.forEach(([v, l]) => chips.appendChild(h('button', { class: 'chip' + (((settings && settings.min_busy_minutes) != null ? settings.min_busy_minutes : 240) === v ? ' on' : ''), type: 'button', onclick: async () => {
        if (await patchSettings({ min_busy_minutes: v })) { paint(); if (settings.ics_import_url) syncNow(true) }
      } }, l)))
      body.appendChild(h('div', { class: 'panel' }, h('div', { class: 'h3' }, 'Which events block a day?'),
        h('p', { class: 'muted small' }, 'All-day events always block. Shorter events only block if they are at least this long, so a dentist appointment does not close your whole day.'), chips))

      // link a calendar
      const url = h('input', { class: 'input', type: 'url', placeholder: 'https://calendar.google.com/…/basic.ics', value: (settings && settings.ics_import_url) || '', autocomplete: 'off' })
      const status = h('p', { class: 'muted small' })
      const paintStatus = () => {
        status.textContent = settings && settings.ics_error ? settings.ics_error : (settings && settings.ics_import_url && settings.ics_synced_at ? 'Last synced ' + new Date(settings.ics_synced_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + '. Refreshes every day.' : '')
        status.style.color = settings && settings.ics_error ? 'var(--bad)' : ''
      }
      paintStatus()
      const go = h('button', { class: 'btn sm' }, settings && settings.ics_import_url ? 'Update & sync' : 'Link & sync')
      const syncNow = async (quiet) => {
        go.disabled = true
        const { data, error } = await C.sb.functions.invoke('calendar-sync', { body: { vendor_id: vid } })
        let msg = error ? error.message : null
        if (error) { try { const j = await error.context.json(); if (j && j.error) msg = j.error } catch (e) { /* default */ } }
        const { data: fresh } = await C.sb.rpc('my_calendar_settings', { p_vendor: vid }); if (fresh) settings = fresh
        go.disabled = false; paintStatus()
        if (msg) { if (!quiet) C.toast(msg, true); return }
        if (!quiet) C.toast((data && data.days != null ? data.days : 0) + ' busy days imported')
      }
      go.addEventListener('click', async () => {
        const v = url.value.trim()
        if (!/^(https|webcal):\/\//i.test(v)) { C.toast('Paste the private iCal (.ics) link. It starts with https:// or webcal://', true); return }
        go.disabled = true
        if (!(await patchSettings({ ics_import_url: v, ics_error: null }))) { go.disabled = false; return }
        await syncNow(false); go.textContent = 'Update & sync'; paint()
      })
      const rm = settings && settings.ics_import_url ? h('button', { class: 'btn ghost sm', onclick: async () => {
        await C.sb.from('vendor_external_busy').delete().eq('vendor_id', vid).eq('source', 'ics')
        await patchSettings({ ics_import_url: null, ics_error: null, ics_synced_at: null }); paint(); C.toast('Calendar unlinked')
      } }, 'Remove') : null
      body.appendChild(h('div', { class: 'panel' }, h('div', { class: 'h3' }, 'Link your Google, Apple or Outlook calendar'),
        h('p', { class: 'muted small' }, 'Paste your calendar’s private iCal link. Days with events show as unavailable. Only dates are saved, never event names. Google: Calendar settings → your calendar → “Secret address in iCal format”.'),
        url, h('div', { class: 'actions', style: { marginTop: '10px' } }, go, rm), status))

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
