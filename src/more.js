import { h, clear, icon, field, toggle, ago, fmtDate, fmtMoney, daysUntil } from './lib.js'
import { accessNote } from './overview.js'

/* ---------------- notifications ---------------- */
export async function renderNotifications(C, view) {
  view.appendChild(h('div', { class: 'pagehead' }, h('div', { class: 'eyebrow' }, 'Activity'), h('h1', { class: 'h1' }, 'Notifications')))
  const host = h('div'); view.appendChild(host)
  host.appendChild(h('div', { class: 'spin' }))
  let rows = []
  const load = async () => {
    const { data, error } = await C.sb.from('vendor_notifications').select('*').eq('vendor_id', C.vendor.id).not('type', 'in', '(new_message,message_reaction)').order('created_at', { ascending: false }).limit(100)
    if (error) throw error
    rows = data || []
  }
  const target = (n) => {
    const md = n.metadata || {}
    if (n.type === 'new_message') { const id = md.conversation_id || md.conv_id; return id ? 'messages/' + id : 'messages' }
    if (/booking|match|runsheet/.test(n.type)) return md.couple_id ? 'leads/' + md.couple_id : 'leads'
    return null
  }
  const draw = () => {
    clear(host)
    const unread = rows.filter(r => !r.is_read)
    host.appendChild(h('div', { class: 'actions', style: { marginBottom: '8px' } },
      unread.length ? h('button', { class: 'btn ghost sm', onclick: async () => {
        const { error } = await C.sb.from('vendor_notifications').update({ is_read: true }).in('id', unread.map(r => r.id))
        if (error) { C.toast(C.err(error), true); return }
        rows.forEach(r => { r.is_read = true }); draw(); C.refreshBadges()
      } }, 'Mark all as read') : null,
      rows.length ? h('button', { class: 'linkbtn bad', onclick: async () => {
        const { error } = await C.sb.from('vendor_notifications').delete().eq('vendor_id', C.vendor.id)
        if (error) { C.toast(C.err(error), true); return }
        rows = []; draw(); C.refreshBadges()
      } }, 'Clear all') : null))
    if (!rows.length) { host.appendChild(h('div', { class: 'empty' }, h('h2', { class: 'h3' }, 'All quiet'), h('p', null, 'New saves, messages and booking updates will appear here.'))); return }
    host.appendChild(h('div', { class: 'list' }, rows.map(n =>
      h('button', { class: 'item' + (n.is_read ? '' : ' unread'), onclick: async () => {
        if (!n.is_read) { n.is_read = true; C.sb.from('vendor_notifications').update({ is_read: true }).eq('id', n.id).then(() => C.refreshBadges()) }
        const t = target(n); if (t) C.go(t); else draw()
      } },
        h('div', { class: 'body' }, h('div', { class: 't', style: { whiteSpace: 'normal' } }, n.title), h('div', { class: 's', style: { whiteSpace: 'normal' } }, n.body)),
        h('div', { class: 'meta' }, n.is_read ? null : h('span', { class: 'tag new' }, 'New'), h('div', null, ago(n.created_at)))))))
  }
  try { await load(); draw() } catch (e) { clear(host); host.appendChild(h('div', { class: 'empty' }, h('p', null, C.err(e)))) }
  C.onNotifChange = () => { load().then(draw).catch(() => {}) }
}

/* ---------------- settings ---------------- */
export async function renderSettings(C, view) {
  view.appendChild(h('div', { class: 'pagehead' }, h('div', { class: 'eyebrow' }, 'Account'), h('h1', { class: 'h1' }, 'Settings')))
  const host = h('div'); view.appendChild(host)
  let s = { notify_messages: true, notify_matches: true, notify_bookings: true, notify_tips: true, quiet_hours: true, auto_reply_enabled: false, auto_reply_text: '' }
  const { data } = await C.sb.from('vendor_settings').select('*').eq('vendor_id', C.vendor.id).maybeSingle()
  if (data) s = { ...s, ...data }
  const persist = async (patch) => {
    s = { ...s, ...patch }
    const { error } = await C.sb.from('vendor_settings').upsert({ ...s, vendor_id: C.vendor.id, updated_at: new Date().toISOString() }, { onConflict: 'vendor_id' })
    if (error) C.toast('Could not save. ' + C.err(error), true); else C.toast('Saved')
  }
  const row = (label, sub, key) => h('div', { class: 'pill-row' }, h('div', null, h('div', { class: 'l1' }, label), sub ? h('div', { class: 'l2' }, sub) : null), toggle(!!s[key], v => persist({ [key]: v }), label))

  host.appendChild(h('div', { class: 'sechead sec', style: { marginTop: 0, display: 'flex', borderBottom: '1px solid var(--ink)', paddingBottom: '10px', marginBottom: '0' } }, h('h2', { class: 'h2' }, 'Notifications')))
  host.append(
    row('New messages', 'When a couple writes to you.', 'notify_messages'),
    row('New saves', 'When a couple saves your profile.', 'notify_matches'),
    row('Bookings', 'Proposals, confirmations and cancellations.', 'notify_bookings'),
    row('Tips and news', 'Occasional ideas to get more from Aisle Match.', 'notify_tips'),
    row('Quiet hours', 'Hold push notifications overnight.', 'quiet_hours'))

  const reply = h('textarea', { class: 'textarea', maxlength: '300', placeholder: 'Thanks for your message. I reply within a day and will be in touch soon.' }, s.auto_reply_text || '')
  const saveReply = h('button', { class: 'btn sm' }, 'Save reply')
  saveReply.addEventListener('click', () => persist({ auto_reply_text: reply.value.trim() }))
  host.appendChild(h('div', { class: 'sec' }, h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'Auto reply')),
    row('Send an automatic first reply', 'Couples get this when they first message you.', 'auto_reply_enabled'),
    h('div', { class: 'sp16' }), field('Reply text', reply), saveReply))

  // password
  const p1 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', placeholder: 'At least 8 characters' })
  const p2 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' })
  const pb = h('button', { class: 'btn ghost sm' }, 'Update password')
  pb.addEventListener('click', async () => {
    if (p1.value.length < 8) { C.toast('Your password needs at least 8 characters.', true); return }
    if (p1.value !== p2.value) { C.toast('The two passwords do not match.', true); return }
    pb.disabled = true
    const { error } = await C.sb.auth.updateUser({ password: p1.value })
    pb.disabled = false
    if (error) { C.toast(/same/i.test(error.message) ? 'Choose a password you have not used before.' : C.err(error), true); return }
    p1.value = ''; p2.value = ''; C.toast('Password updated')
  })
  host.appendChild(h('div', { class: 'sec' }, h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'Sign in')),
    h('div', { class: 'kv', style: { marginBottom: '20px' } }, h('div', null, h('span', { class: 'k' }, 'Email'), h('span', { class: 'v' }, C.user.email || ''))),
    field('New password', p1), field('Confirm new password', p2), pb,
    h('div', { class: 'sp24' }), h('button', { class: 'btn ghost', onclick: C.signOut }, 'Sign out')))
  host.appendChild(h('div', { class: 'sec' }, h('p', { class: 'muted small' }, 'To delete your account, open Aisle Match in the app and go to Profile.')))
}

/* ---------------- billing ---------------- */
const TIERS = { standard: ['Standard', 'A$49'], featured: ['Featured', 'A$69'] }
const STATUS = { trialing: 'Free trial', active: 'Active', past_due: 'Payment failed', paused: 'Paused', payment_paused: 'Paused', cancelled: 'Cancelled', expired: 'Expired', incomplete: 'Incomplete' }

export async function renderBilling(C, view) {
  const v = C.vendor
  view.appendChild(h('div', { class: 'pagehead' }, h('div', { class: 'eyebrow' }, 'Account'), h('h1', { class: 'h1' }, 'Billing')))
  const note = accessNote(C)
  if (note) { view.appendChild(note); view.appendChild(h('div', { class: 'sp24' })) }

  const comp = !!v.is_free_forever || (v.subscription_override_until && new Date(v.subscription_override_until).getFullYear() >= 2090)
  const tier = TIERS[v.subscription_tier] || null
  const status = comp ? 'Complimentary' : (STATUS[v.subscription_status] || 'No plan')
  const tone = ['active'].includes(v.subscription_status) ? 'ok' : ['past_due', 'cancelled', 'expired'].includes(v.subscription_status) ? 'bad' : v.subscription_status === 'trialing' ? 'warn' : ''
  const kv = []
  const line = (k, val) => { if (val) kv.push(h('div', null, h('span', { class: 'k' }, k), h('span', { class: 'v' }, val))) }
  line('Plan', comp ? (tier ? tier[0] : 'Full access') + '  ·  no charge' : (tier ? tier[0] + '  ·  ' + tier[1] + ' per month' : 'No plan chosen'))
  if (v.is_founding_vendor) line('Pricing', 'Founding vendor rate, locked in')
  if (v.subscription_status === 'trialing' && v.trial_ends_at) { const d = daysUntil(v.trial_ends_at); line('Trial ends', fmtDate(v.trial_ends_at) + (d !== null && d >= 0 ? '  (' + d + (d === 1 ? ' day' : ' days') + ' left)' : '')) }
  if (v.subscription_status === 'active' && v.current_period_end) line(v.cancel_at_period_end ? 'Ends on' : 'Next payment', fmtDate(v.current_period_end))
  if (v.subscription_status === 'cancelled' && v.current_period_end) line('Access until', fmtDate(v.current_period_end))
  if (v.subscription_status === 'paused' && v.pause_resumes_at) line('Resumes', fmtDate(v.pause_resumes_at))

  view.appendChild(h('div', { class: 'sec', style: { marginTop: 0 } },
    h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'Your plan'), h('span', { class: 'tag ' + tone }, status)),
    h('div', { class: 'kv', style: { borderTop: 0 } }, kv)))

  const actions = h('div', { class: 'actions', style: { marginTop: '22px' } }); view.appendChild(actions)
  if (comp) {
    view.appendChild(h('div', { class: 'note', style: { marginTop: '22px' } }, h('b', null, 'This is a complimentary account. '), 'You have full access and you will not be charged.'))
  }
  const onApple = !!v.apple_original_transaction_id && !v.stripe_subscription_id
  if (comp) { /* nothing to manage */ } else if (onApple) {
    actions.appendChild(h('a', { class: 'btn', href: 'https://apps.apple.com/account/subscriptions', target: '_blank', rel: 'noopener' }, 'Manage in Apple subscriptions'))
    view.appendChild(h('p', { class: 'muted small', style: { marginTop: '12px' } }, 'You subscribed through the App Store, so changes to your plan are made with Apple.'))
  } else if (v.stripe_customer_id) {
    const b = h('button', { class: 'btn' }, 'Manage billing')
    b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = 'Opening'
      try {
        const { data, error } = await C.sb.functions.invoke('manage-billing', { body: { action: 'portal_session', return_url: location.origin + location.pathname } })
        if (error) { let m = error.message; try { const j = await error.context.json(); if (j && j.error) m = j.error } catch (e) { /* default */ } throw new Error(m) }
        if (!data || !data.url) throw new Error('Could not open billing. Please try again.')
        location.href = data.url
      } catch (e) { b.disabled = false; b.textContent = 'Manage billing'; C.toast(C.err(e), true) }
    })
    actions.appendChild(b)
    view.appendChild(h('p', { class: 'muted small', style: { marginTop: '12px' } }, 'Opens our secure billing page where you can update your card, see invoices, or change your plan.'))
  } else {
    view.appendChild(h('div', { class: 'note' }, h('b', null, 'No plan on this account yet. '), 'Start your plan in the Aisle Match app and it will show up here.'))
  }

  const evHost = h('div', { class: 'sec' }); view.appendChild(evHost)
  evHost.appendChild(h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'History')))
  const { data: ev } = await C.sb.from('billing_events').select('*').eq('vendor_id', v.id).order('created_at', { ascending: false }).limit(20)
  if (!ev || !ev.length) evHost.appendChild(h('p', { class: 'muted' }, 'Payments and plan changes will be listed here.'))
  else evHost.appendChild(h('div', { class: 'list', style: { borderTop: 0 } }, ev.map(e =>
    h('div', { class: 'item' }, h('div', { class: 'body' }, h('div', { class: 't', style: { whiteSpace: 'normal' } }, e.description || String(e.event_type || '').replace(/_/g, ' ')), h('div', { class: 's' }, fmtDate(e.created_at))),
      e.amount_cents ? h('div', { class: 'meta', style: { color: 'var(--ink)', fontWeight: 500 } }, fmtMoney(e.amount_cents / 100)) : null))))
}
