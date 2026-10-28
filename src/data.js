import { today } from './lib.js'

export const NEW_WINDOW = 48 * 3600 * 1000

// Which tab a lead lives in. Same rule as the app.
export function tabOf(m) {
  const t = today()
  const d = m.bookedDate || m.weddingDate
  const past = !!d && String(d).slice(0, 10) < t
  if (m.vendorStatus === 'completed') return 'completed'
  if (m.isBooked || m.vendorStatus === 'upcoming') return past ? 'completed' : 'upcoming'
  return 'leads'
}

export function coupleLabel(u, couple) {
  if (u && u.first_name) return u.first_name + (u.last_name ? ' ' + u.last_name : '')
  return (couple && couple.partner_name) || 'Couple'
}

async function couplesAndUsers(sb, coupleIds) {
  if (!coupleIds.length) return { cm: {}, um: {} }
  const { data: cd } = await sb.from('couples')
    .select('id, user_id, partner_name, wedding_date, venue_location, venue_state, guest_count_estimate, budget_total, wedding_styles')
    .in('id', coupleIds)
  const cm = {}; (cd || []).forEach(c => { cm[c.id] = c })
  const uids = [...new Set((cd || []).map(c => c.user_id).filter(Boolean))]
  const um = {}
  if (uids.length) {
    const { data: ud } = await sb.from('users').select('id, first_name, last_name, avatar_url').in('id', uids)
    ;(ud || []).forEach(u => { um[u.id] = u })
  }
  return { cm, um }
}

// couple_id -> { date, status } for this vendor's live bookings (the date they agreed in the booking flow)
export async function bookingDates(sb, vendorId) {
  const out = {}
  try {
    const { data } = await sb.from('bookings').select('couple_id, event_date, status, created_at')
      .eq('vendor_id', vendorId).in('status', ['confirmed', 'deposited', 'paid']).order('created_at', { ascending: false })
    ;(data || []).forEach(b => { if (!out[b.couple_id]) out[b.couple_id] = { date: b.event_date || null, status: b.status } })
  } catch (e) { /* dates are a nice-to-have */ }
  return out
}

export async function loadLeads(sb, vendorId) {
  const { data, error } = await sb.from('matches')
    .select('id, couple_id, is_shortlisted, created_at, is_booked, vendor_status, conversations ( id, last_message_preview, last_message_at, vendor_unread_count )')
    .eq('vendor_id', vendorId).eq('is_shortlisted', true).eq('vendor_hidden', false)
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!data || !data.length) return []
  const [{ cm, um }, bd] = await Promise.all([couplesAndUsers(sb, data.map(m => m.couple_id)), bookingDates(sb, vendorId)])
  const now = Date.now()
  return data.map(m => {
    const c = cm[m.couple_id] || {}
    const u = um[c.user_id] || {}
    const conv = Array.isArray(m.conversations) ? m.conversations[0] : m.conversations
    const loc = [c.venue_location, c.venue_state].filter(Boolean).join(', ')
    const out = {
      matchId: m.id, coupleId: m.couple_id,
      coupleName: coupleLabel(u, c), partnerName: c.partner_name || null,
      weddingDate: c.wedding_date || null, location: loc || null,
      bookedDate: (bd[m.couple_id] && bd[m.couple_id].date) || null, hasBooking: !!bd[m.couple_id],
      styles: c.wedding_styles || null, guests: c.guest_count_estimate || null, budget: c.budget_total || null,
      avatar: u.avatar_url || null,
      convId: (conv && conv.id) || null, preview: (conv && conv.last_message_preview) || null,
      lastAt: (conv && conv.last_message_at) || null, unread: (conv && conv.vendor_unread_count) || 0,
      createdAt: m.created_at, isBooked: !!m.is_booked, vendorStatus: m.vendor_status || 'new',
    }
    out.isNew = (now - new Date(m.created_at).getTime()) < NEW_WINDOW && !out.convId
    out.tab = tabOf(out)
    return out
  })
}

export async function loadConvs(sb, vendorId) {
  const { data, error } = await sb.from('conversations')
    .select('*, couples(id, user_id, partner_name, wedding_date, venue_location, venue_state)')
    .eq('vendor_id', vendorId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
  if (error) throw error
  const rows = data || []
  const bd = await bookingDates(sb, vendorId)
  const uids = [...new Set(rows.map(c => c.couples && c.couples.user_id).filter(Boolean))]
  const um = {}
  if (uids.length) {
    const { data: ud } = await sb.from('users').select('id, first_name, last_name, avatar_url').in('id', uids)
    ;(ud || []).forEach(u => { um[u.id] = u })
  }
  return rows.map(c => {
    const couple = c.couples || {}
    const u = um[couple.user_id] || {}
    return { ...c, coupleName: coupleLabel(u, couple), partnerName: couple.partner_name || null, weddingDate: couple.wedding_date || null,
      bookedDate: (bd[c.couple_id] && bd[c.couple_id].date) || null,
      location: [couple.venue_location, couple.venue_state].filter(Boolean).join(', ') || null, avatar: u.avatar_url || null }
  })
}

// Find the conversation for a couple, or create it (same as the app).
export async function ensureConversation(sb, vendorId, lead) {
  const { data: existing } = await sb.from('conversations').select('*').eq('vendor_id', vendorId).eq('couple_id', lead.coupleId).maybeSingle()
  let row = existing
  if (!row) {
    const { data: created, error } = await sb.from('conversations')
      .insert({ vendor_id: vendorId, couple_id: lead.coupleId, match_id: lead.matchId, status: 'active' }).select('*').single()
    if (error) throw error
    row = created
  } else if (!row.match_id && lead.matchId) {
    await sb.from('conversations').update({ match_id: lead.matchId }).eq('id', row.id)
  }
  return row
}

export async function loadAnswers(sb, vendorId, coupleId) {
  const { data: links } = await sb.from('vendor_category_links').select('category_id, categories(name)').eq('vendor_id', vendorId)
  const catIds = (links || []).map(l => l.category_id)
  const groups = new Set(['universal'])
  let mapped = 0
  if (catIds.length) {
    const { data: gs } = await sb.from('category_question_groups').select('group_key').in('category_id', catIds)
    ;(gs || []).forEach(g => { groups.add(g.group_key); mapped++ })
  }
  // Planners and coordinators run the whole day, so they see every answer the couple has shared with vendors.
  const planner = (links || []).some(l => /planner|coordinat/i.test((l.categories && l.categories.name) || ''))
  let qq = sb.from('questionnaire_questions').select('key, label, group_key, sort, vendor_visible').eq('vendor_visible', true)
  if (!planner && mapped) qq = qq.in('group_key', [...groups])
  const { data: qs } = await qq
  const { data: ans } = await sb.from('couple_answers').select('question_key, answer').eq('couple_id', coupleId)
  const am = {}; (ans || []).forEach(a => { am[a.question_key] = a.answer })
  const ordered = (qs || []).slice().sort((a, b) => (a.group_key === 'universal' ? 1 : 0) - (b.group_key === 'universal' ? 1 : 0) || a.sort - b.sort)
  return ordered.filter(q => am[q.key] !== undefined && am[q.key] !== null).map(q => ({
    label: q.label, value: Array.isArray(am[q.key]) ? am[q.key].join(', ') : String(am[q.key]),
  }))
}

export function friendlyError(e) {
  const m = String((e && e.message) || e || '')
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No connection. Check your internet and try again.'
  if (/JWT|expired|Invalid session/i.test(m)) return 'Your session has expired. Please sign in again.'
  return m || 'Something went wrong. Please try again.'
}
