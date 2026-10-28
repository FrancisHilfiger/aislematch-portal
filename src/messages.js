import { h, clear, icon, ago, clock, initial, fmtDate, img, MON } from './lib.js'
import { loadConvs } from './data.js'
import { pick, uploadToCloudinary } from './profile.js'
import { openBooking } from './leads.js'

function dayLabel(iso) {
  const d = new Date(iso); const n = new Date()
  const k = (x) => x.getFullYear() * 400 + x.getMonth() * 32 + x.getDate()
  if (k(d) === k(n)) return 'Today'
  const y = new Date(n.getTime() - 86400000)
  if (k(d) === k(y)) return 'Yesterday'
  return d.getDate() + ' ' + MON[d.getMonth()] + (d.getFullYear() !== n.getFullYear() ? ' ' + d.getFullYear() : '')
}

const BOOK_KIND = {
  proposal: ['BOOKING REQUEST', 'sent a booking request'], accepted: ['BOOKING CONFIRMED', 'accepted the booking'], declined: ['REQUEST DECLINED', 'declined the request'],
  withdrawn: ['REQUEST WITHDRAWN', 'withdrew the request'], cancelled: ['BOOKING CANCELLED', 'cancelled the booking'],
}
function bookingCard(m, mine, onView) {
  const md = m.metadata || {}; const k = BOOK_KIND[md.kind] || BOOK_KIND.proposal
  const row = (a, b) => (b ? h('div', { class: 'row' }, h('span', null, a), h('span', null, b)) : null)
  const money = (n) => (n === null || n === undefined || n === '' ? '' : '$' + Number(n).toLocaleString('en-AU'))
  return h('div', { class: 'bookcard' + (mine ? ' me' : '') },
    h('div', { class: 'kick' }, k[0]), h('div', { class: 'ttl' }, (mine ? 'You' : (md.by_name || 'They')) + ' ' + k[1]),
    row('Date', md.event_date ? fmtDate(md.event_date) : ''), row('Package', md.package_name), row('Price', money(md.price)), row('Deposit', money(md.deposit)),
    md.reason ? h('div', { class: 'muted small', style: { marginTop: '6px', fontStyle: 'italic' } }, '\u201c' + md.reason + '\u201d') : null,
    h('div', { class: 'sp8' }), h('button', { class: 'btn sm block', onclick: onView }, 'View booking'),
    h('span', { class: 'tm' }, clock(m.created_at)))
}

export function renderMessages(C, view, parts, main) {
  main.classList.add('msgmode', 'rel')
  const openId = parts[0] || null
  const listcol = h('div', { class: 'listcol' })
  const threadcol = h('div', { class: 'threadcol' + (openId ? '' : ' empty') })
  view.appendChild(h('div', { class: 'split' }, listcol, threadcol))

  let convs = []
  let showArchived = false
  let threadCleanup = null

  const drawList = () => {
    clear(listcol)
    listcol.appendChild(h('div', { class: 'lhead' }, h('div', { class: 'eyebrow' }, 'Inbox'), h('h1', { class: 'h1' }, 'Messages')))
    const rows = convs.filter(c => !!c.is_archived_by_vendor === showArchived)
    const archivedCount = convs.filter(c => c.is_archived_by_vendor).length
    if (!rows.length) {
      listcol.appendChild(h('div', { class: 'empty' }, h('h2', { class: 'h3' }, showArchived ? 'Nothing archived' : 'No conversations yet'),
        h('p', null, showArchived ? 'Archived chats show up here.' : 'Open a lead and tap Message to start a chat with a couple.')))
    } else {
      listcol.appendChild(h('div', { class: 'list' }, rows.map(c =>
        h('button', { class: 'item' + (c.vendor_unread_count ? ' unread' : ''), 'aria-current': c.id === openId ? 'true' : null, style: c.id === openId ? { background: 'rgba(226,244,255,.55)' } : null, onclick: () => C.go('messages/' + c.id) },
          h('div', { class: 'avatar' }, c.avatar ? h('img', { src: img(c.avatar, 120), alt: '', loading: 'lazy' }) : initial(c.coupleName)),
          h('div', { class: 'body' }, h('div', { class: 't' }, c.coupleName + (c.partnerName ? ' & ' + c.partnerName : '')), h('div', { class: 's' }, c.last_message_preview || 'No messages yet')),
          h('div', { class: 'meta' }, c.vendor_unread_count ? h('span', { class: 'tag new' }, String(c.vendor_unread_count)) : null, h('div', null, ago(c.last_message_at)))))))
    }
    if (archivedCount || showArchived) listcol.appendChild(h('div', { style: { padding: '12px 16px' } },
      h('button', { class: 'linkbtn', onclick: () => { showArchived = !showArchived; drawList() } }, showArchived ? 'Back to inbox' : 'Archived (' + archivedCount + ')')))
  }

  const refreshList = async () => {
    try { convs = await loadConvs(C.sb, C.vendor.id); drawList() } catch (e) { /* keep old list */ }
  }

  const openThread = async (id) => {
    clear(threadcol)
    threadcol.classList.remove('empty')
    C.immersive(true)
    let conv = convs.find(c => c.id === id)
    if (!conv) { await refreshList(); conv = convs.find(c => c.id === id) }
    if (!conv) {
      threadcol.appendChild(h('div', { class: 'thread' }, h('div', { class: 'thead' }, h('button', { class: 'iconbtn', 'aria-label': 'Back', onclick: () => C.go('messages') }, icon('back'))),
        h('div', { class: 'empty' }, h('h2', { class: 'h3' }, 'Conversation not found'), h('p', null, 'It may have been removed.'))))
      return
    }
    const msgsEl = h('div', { class: 'msgs', role: 'log', 'aria-live': 'polite' })
    const leadOf = () => ({ coupleId: conv.couple_id, matchId: conv.match_id, weddingDate: conv.weddingDate })
    const input = h('textarea', { rows: '1', placeholder: 'Write a message', 'aria-label': 'Message' })
    const sendBtn = h('button', { class: 'btn', 'aria-label': 'Send', type: 'button' }, icon('send'))
    const attachBtn = h('button', { class: 'iconbtn', 'aria-label': 'Add to chat', type: 'button', style: { flex: 'none', height: '46px' } }, icon('plus'))
    const arch = h('button', { class: 'linkbtn', style: { minHeight: '44px', padding: '0 12px' }, onclick: async () => {
      const next = !conv.is_archived_by_vendor
      const { error } = await C.sb.from('conversations').update({ is_archived_by_vendor: next }).eq('id', conv.id)
      if (error) { C.toast(C.err(error), true); return }
      C.toast(next ? 'Archived' : 'Moved to inbox'); C.go('messages')
    } }, conv.is_archived_by_vendor ? 'Unarchive' : 'Archive')
    const thread = h('div', { class: 'thread' },
      h('div', { class: 'thead' },
        h('button', { class: 'iconbtn', 'aria-label': 'Back to messages', onclick: () => C.go('messages'), style: { } }, icon('back')),
        h('div', { class: 'who' }, h('div', { class: 't' }, conv.coupleName + (conv.partnerName ? ' & ' + conv.partnerName : '')),
          h('div', { class: 's' }, [conv.weddingDate ? fmtDate(conv.weddingDate) : null, conv.location].filter(Boolean).join('  ·  ') || 'Couple')),
        h('button', { class: 'linkbtn', style: { minHeight: '44px', padding: '0 12px' }, onclick: () => C.go('leads/' + conv.couple_id) }, 'Profile'),
        arch),
      msgsEl,
      h('div', { class: 'compose' }, attachBtn, input, sendBtn))
    threadcol.appendChild(thread)
    msgsEl.appendChild(h('div', { class: 'spin' }))

    let msgs = []
    const seen = new Set()
    const draw = () => {
      clear(msgsEl)
      if (!msgs.length) { msgsEl.appendChild(h('div', { class: 'empty' }, h('p', null, 'Say hello. Keep it friendly and specific to their day.'))); return }
      let last = ''
      msgs.forEach(m => {
        const dl = dayLabel(m.created_at)
        if (dl !== last) { msgsEl.appendChild(h('div', { class: 'day' }, dl)); last = dl }
        const mine = m.sender_id === C.user.id
        if (m.message_type === 'booking' && m.metadata && !m.is_deleted) { msgsEl.appendChild(bookingCard(m, mine, () => openBooking(C, leadOf()))); return }
        const body = m.is_deleted ? h('i', null, 'Message removed') : (m.attachment_url && /image/.test(m.attachment_type || 'image')
          ? [h('img', { src: img(m.attachment_url, 600), alt: 'Attachment', style: { maxWidth: '100%', borderRadius: '10px', display: 'block' }, loading: 'lazy' }), m.body ? h('div', null, m.body) : null]
          : m.body)
        msgsEl.appendChild(h('div', { class: 'bub ' + (mine ? 'me' : 'them') }, body, h('span', { class: 'tm' }, clock(m.created_at) + (mine && m.is_read ? '  ·  Read' : ''))))
      })
      msgsEl.scrollTop = msgsEl.scrollHeight
    }
    const markRead = () => C.sb.rpc('reset_unread_count', { conv_id: conv.id, reader_is_couple: false }).then(() => C.refreshBadges && C.refreshBadges())

    try {
      const { data, error } = await C.sb.from('messages').select('*').eq('conversation_id', conv.id).order('created_at', { ascending: true }).limit(300)
      if (error) throw error
      msgs = (data || []).filter(m => !(m.is_deleted_locally && m.local_deleted_by === C.user.id))
      msgs.forEach(m => seen.add(m.id))
      draw(); markRead()
    } catch (e) { clear(msgsEl); msgsEl.appendChild(h('div', { class: 'empty' }, h('p', null, C.err(e)))) }

    const ch = C.sb.channel('vt:' + conv.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conv.id }, (p) => {
        const nm = p.new; if (!nm || seen.has(nm.id)) return
        seen.add(nm.id); msgs.push(nm); draw()
        if (nm.sender_id !== C.user.id) {
          C.sb.from('messages').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', nm.id).then(() => {})
          markRead()
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conv.id }, (p) => {
        const u = p.new; msgs = msgs.map(m => m.id === u.id ? { ...m, ...u } : m); draw()
      })
      .subscribe()

    let sending = false
    const sendPhoto = async () => {
      const [f] = await pick('image/*', false); if (!f || sending) return
      sending = true; attachBtn.disabled = true; C.toast('Sending photo')
      try {
        const url = await uploadToCloudinary(C.cfg, f, 'image')
        const { data: msg, error } = await C.sb.from('messages').insert({ conversation_id: conv.id, sender_id: C.user.id, body: '', attachment_url: url, attachment_type: 'image', is_read: false }).select('*').single()
        if (error) throw error
        if (msg && !seen.has(msg.id)) { seen.add(msg.id); msgs.push(msg); draw() }
        await C.sb.from('conversations').update({ last_message_at: new Date().toISOString(), last_message_preview: 'Photo' }).eq('id', conv.id)
      } catch (e) { C.toast('Photo not sent. ' + C.err(e), true) }
      sending = false; attachBtn.disabled = false
    }
    attachBtn.addEventListener('click', () => {
      const menu = C.sheet({ title: 'Add to chat', body: h('div', { class: 'menu' },
        h('button', { class: 'mi', onclick: () => { menu.close(); openBooking(C, leadOf()) } }, icon('cal'), 'Booking request'),
        h('button', { class: 'mi', onclick: () => { menu.close(); sendPhoto() } }, icon('img'), 'Photo')) })
    })
    const send = async () => {
      const text = input.value.trim()
      if (!text || sending) return
      sending = true; sendBtn.disabled = true
      input.value = ''; input.style.height = 'auto'
      try {
        const { data: msg, error } = await C.sb.from('messages').insert({ conversation_id: conv.id, sender_id: C.user.id, body: text, is_read: false }).select('*').single()
        if (error) throw error
        if (msg && !seen.has(msg.id)) { seen.add(msg.id); msgs.push(msg); draw() }
        await C.sb.from('conversations').update({ last_message_at: new Date().toISOString(), last_message_preview: text }).eq('id', conv.id)
      } catch (e) { input.value = text; C.toast('Message not sent. ' + C.err(e), true) }
      sending = false; sendBtn.disabled = false
      input.focus()
    }
    sendBtn.addEventListener('click', send)
    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px' })
    input.addEventListener('keydown', (e) => {
      // Enter sends on desktop; on touch devices Enter makes a new line
      const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches
      if (e.key === 'Enter' && !e.shiftKey && !touch) { e.preventDefault(); send() }
    })
    threadCleanup = () => { try { C.sb.removeChannel(ch) } catch (e) { /* ignore */ } }
  }

  const placeholder = () => {
    clear(threadcol)
    threadcol.appendChild(h('div', { class: 'nothread' }, h('div', { style: { textAlign: 'center' } },
      h('div', { class: 'h2' }, 'Pick a conversation'), h('p', { class: 'muted' }, 'Your messages with couples show up here.'))))
  }

  C.onConvChange = refreshList
  drawList()
  refreshList().then(() => { if (openId) openThread(openId) })
  if (!openId) placeholder()
  return () => { if (threadCleanup) threadCleanup(); C.immersive(false) }
}
