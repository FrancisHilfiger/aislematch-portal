import { h, clear, fmtDate, fmtMoney, ago, initial, daysUntil, today, img } from './lib.js'
import { loadLeads } from './data.js'
import { goLiveChecks, fixCheck } from './profile.js'

export function accessNote(C) {
  const a = C.access || {}
  const v = C.vendor || {}
  const go = (label, to) => h('div', { class: 'actions' }, h('button', { class: 'btn sm', onclick: () => C.go(to || 'billing') }, label))
  if (a.reason === 'trial_active' && (a.trial_ends_at || v.trial_ends_at)) {
    const d = daysUntil(a.trial_ends_at || v.trial_ends_at)
    if (d !== null && d <= 7) return h('div', { class: 'note warn' }, h('b', null, d <= 0 ? 'Your free trial ends today. ' : 'Your free trial ends in ' + d + (d === 1 ? ' day. ' : ' days. ')), 'Add a card to keep your listing live.', go('See billing'))
  }
  if (a.reason === 'past_due_grace') return h('div', { class: 'note bad' }, h('b', null, 'Your last payment did not go through. '), 'Update your payment details so your listing stays live.', go('Fix payment'))
  if (a.access === 'dashboard_only') return h('div', { class: 'note warn' }, h('b', null, 'Your listing is paused. '), 'You can still see your leads and messages, but couples cannot find you until you reactivate.', go('Reactivate'))
  if (a.reason === 'cancelled_grace') return h('div', { class: 'note' }, h('b', null, 'Your plan is cancelled. '), 'You keep full access until ' + fmtDate(a.access_until) + '.', go('Manage plan'))
  return null
}

export async function renderOverview(C, view) {
  const v = C.vendor
  const first = (v.business_name || '').trim()
  view.appendChild(h('div', { class: 'pagehead' },
    h('div', { class: 'eyebrow' }, 'Overview'),
    h('h1', { class: 'h1' }, first || 'Welcome'),
    h('p', null, 'Here is what needs your attention today.')))
  const note = accessNote(C)
  if (note) { view.appendChild(note); view.appendChild(h('div', { class: 'sp24' })) }
  if (!v.is_published) {
    const missing = goLiveChecks(C).filter(c => !c.ok)
    view.appendChild(h('div', { class: 'note warn' }, h('b', null, 'Your listing is not live yet. '),
      missing.length ? 'Couples cannot see you until these are done:' : 'Everything is ready. Switch your listing on to go live.',
      missing.length ? h('div', { class: 'golist', style: { marginTop: '10px' } }, missing.map(c => h('div', { class: 'goitem' }, h('span', { class: 'goic' }), h('span', { class: 'gol' }, c.label), h('button', { class: 'linkbtn', onclick: () => fixCheck(C, c) }, c.action)))) : null,
      h('div', { class: 'actions' }, h('button', { class: 'btn sm', onclick: () => { C.jump = 'Listing visibility'; C.go('profile') } }, missing.length ? 'Open my profile' : 'Go live'))))
    view.appendChild(h('div', { class: 'sp24' }))
  }

  const statsHost = h('div'); const nextHost = h('div'); const leadsHost = h('div')
  view.append(statsHost, nextHost, leadsHost)
  statsHost.appendChild(h('div', { class: 'skel' }))

  const t = today()
  const since = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10)
  const [leads, bk, wk, cv] = await Promise.all([
    loadLeads(C.sb, v.id).catch(() => []),
    C.sb.from('bookings').select('id, status, event_date, total_amount, couple_id').eq('vendor_id', v.id).then(r => r.data || []),
    C.sb.from('vendor_analytics_weekly').select('profile_views, swipe_rights, messages, week_start').eq('vendor_id', v.id).gte('week_start', since).then(r => r.data || []),
    C.sb.from('conversations').select('vendor_unread_count').eq('vendor_id', v.id).eq('is_archived_by_vendor', false).then(r => r.data || []),
  ])
  const sum = (k) => wk.reduce((a, r) => a + (r[k] || 0), 0)
  const unread = cv.reduce((a, r) => a + (r.vendor_unread_count || 0), 0)
  const open = leads.filter(l => l.tab === 'leads')
  const upcoming = bk.filter(b => ['confirmed', 'deposited', 'paid'].includes(b.status) && b.event_date && b.event_date >= t)
    .sort((a, b) => a.event_date < b.event_date ? -1 : 1)

  const stat = (n, l) => h('div', { class: 'stat' }, h('div', { class: 'n' }, String(n)), h('div', { class: 'l' }, l))
  clear(statsHost)
  statsHost.appendChild(h('div', { class: 'stats' },
    stat(open.length, 'Open leads'), stat(unread, 'Unread messages'),
    stat(upcoming.length, 'Booked weddings'), stat(sum('profile_views'), 'Views, 4 weeks')))

  // next booked weddings
  const lm = {}; leads.forEach(l => { lm[l.coupleId] = l })
  if (upcoming.length) {
    nextHost.appendChild(h('div', { class: 'sec' },
      h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'Coming up')),
      h('div', { class: 'list', style: { borderTop: '0' } }, upcoming.slice(0, 4).map(b => {
        const l = lm[b.couple_id]
        return h('button', { class: 'item', onclick: () => C.go('leads/' + b.couple_id) },
          h('div', { class: 'avatar' }, l && l.avatar ? h('img', { src: img(l.avatar, 120), alt: '', loading: 'lazy' }) : initial(l ? l.coupleName : 'C')),
          h('div', { class: 'body' }, h('div', { class: 't' }, l ? l.coupleName : 'Couple'), h('div', { class: 's' }, fmtDate(b.event_date) + (b.total_amount ? '  ·  ' + fmtMoney(b.total_amount) : ''))),
          h('span', { class: 'tag ' + (b.status === 'confirmed' ? '' : 'ok') }, b.status))
      }))))
  }

  // latest leads
  leadsHost.appendChild(h('div', { class: 'sec' },
    h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'Newest leads'),
      h('button', { class: 'linkbtn', onclick: () => C.go('leads') }, 'See all')),
    open.length
      ? h('div', { class: 'list', style: { borderTop: '0' } }, open.slice(0, 5).map(l =>
        h('button', { class: 'item' + (l.unread ? ' unread' : ''), onclick: () => C.go('leads/' + l.coupleId) },
          h('div', { class: 'avatar' }, l.avatar ? h('img', { src: img(l.avatar, 120), alt: '', loading: 'lazy' }) : initial(l.coupleName)),
          h('div', { class: 'body' }, h('div', { class: 't' }, l.coupleName + (l.partnerName ? ' & ' + l.partnerName : '')),
            h('div', { class: 's' }, [fmtDate(l.weddingDate), l.location].filter(Boolean).join('  ·  '))),
          l.isNew ? h('span', { class: 'tag new' }, 'New') : h('span', { class: 'tiny' }, ago(l.createdAt)))))
      : h('div', { class: 'empty' }, h('h3', { class: 'h3' }, 'No open leads right now'),
        h('p', null, 'When a couple saves your profile they show up here. A complete profile with strong photos gets saved more.'),
        h('div', { class: 'sp16' }), h('button', { class: 'btn sm ghost', onclick: () => C.go('profile') }, 'Improve your profile'))))
}
