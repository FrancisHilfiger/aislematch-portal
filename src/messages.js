import { h, clear, icon, ago, clock, initial, fmtDate, img, MON } from './lib.js'
import { loadConvs, loadGroups } from './data.js'
import { pick, uploadToCloudinary } from './profile.js'
import { openBooking } from './leads.js'
import { groupAvatar, openNewGroup, openGroupInfo, tint } from './groups.js'

const EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥']
const COLS = 'id, conversation_id, sender_id, body, attachment_url, attachment_type, message_type, metadata, is_read, read_at, is_deleted, is_deleted_locally, local_deleted_by, reply_to_id, created_at'

function dayLabel(iso) {
  const d = new Date(iso); const n = new Date()
  const k = (x) => x.getFullYear() * 400 + x.getMonth() * 32 + x.getDate()
  if (k(d) === k(n)) return 'Today'
  const y = new Date(n.getTime() - 86400000)
  if (k(d) === k(y)) return 'Yesterday'
  return d.getDate() + ' ' + MON[d.getMonth()] + (d.getFullYear() !== n.getFullYear() ? ' ' + d.getFullYear() : '')
}
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()

// "Active now" / "Active 5m ago", same rule as the app
export function lastActive(ts) {
  if (!ts) return null
  const diff = Date.now() - new Date(ts).getTime()
  if (!isFinite(diff) || diff > 24 * 3600000) return null
  if (diff < 2 * 60000) return { label: 'Active now', online: true }
  if (diff < 3600000) return { label: 'Active ' + Math.max(2, Math.floor(diff / 60000)) + 'm ago', online: false }
  return { label: 'Active ' + Math.floor(diff / 3600000) + 'hr ago', online: false }
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
    md.reason ? h('div', { class: 'muted small', style: { marginTop: '6px', fontStyle: 'italic' } }, '“' + md.reason + '”') : null,
    h('div', { class: 'sp8' }), h('button', { class: 'btn sm block', onclick: onView }, 'View booking'),
    h('span', { class: 'tm' }, clock(m.created_at)))
}

// photo shown at its real shape (Messenger style): fixed width, height follows the photo, extremes clamped
function photoBox(src, ratio, onOpen, status, label) {
  const ar0 = ratio ? Math.min(1.8, Math.max(0.66, ratio)) : 4 / 3
  const box = h('div', { class: 'mph' + (status ? ' ' + status : '') + (onOpen ? ' tap' : ''), style: { aspectRatio: String(ar0) } })
  const im = h('img', { src, alt: 'Photo', decoding: 'async' })
  im.addEventListener('load', () => { if (!ratio && im.naturalWidth) box.style.aspectRatio = String(Math.min(1.8, Math.max(0.66, im.naturalWidth / im.naturalHeight))); box.dispatchEvent(new CustomEvent('photoload', { bubbles: true, composed: true })) })
  box.appendChild(im)
  if (status === 'sending') box.appendChild(h('div', { class: 'mphov' }, h('div', { class: 'spin sm' }), label ? h('span', null, label) : null))
  if (status === 'failed') box.appendChild(h('div', { class: 'mphov bad' }, h('b', null, 'Not sent'), h('span', null, 'Tap to try again')))
  if (onOpen) box.addEventListener('click', onOpen)
  return box
}

export function renderMessages(C, view, parts, main) {
  main.classList.add('msgmode', 'rel')
  const openId = parts[0] || null
  const listcol = h('div', { class: 'listcol' })
  const threadcol = h('div', { class: 'threadcol' + (openId ? '' : ' empty') })
  view.appendChild(h('div', { class: 'split' }, listcol, threadcol))

  let items = []           // direct chats and group chats together
  let filter = 'all'
  let query = ''
  let threadCleanup = null
  let alive = true
  let listChannel = null
  const typingSeen = {}

  const itemTitle = (c) => c.kind === 'direct' ? (c.coupleName + (c.partnerName ? ' & ' + c.partnerName : '')) : (c.title || 'Group')
  const unreadOf = (c) => c.kind === 'direct' ? (c.vendor_unread_count || 0) : (c.unread_count || 0)
  const archivedOf = (c) => c.kind === 'direct' ? !!c.is_archived_by_vendor : !!c.archived
  const pinnedOf = (c) => c.kind === 'direct' ? !!c.is_pinned_by_vendor : !!c.pinned
  const lastAtOf = (c) => c.last_message_at || null

  /* ------------------------------ list ------------------------------ */
  const drawList = () => {
    clear(listcol)
    const unreadTotal = items.filter(c => !archivedOf(c) && unreadOf(c) > 0).length
    const archivedCount = items.filter(archivedOf).length
    const groupCount = items.filter(c => c.kind !== 'direct' && !archivedOf(c)).length
    listcol.appendChild(h('div', { class: 'lhead' },
      h('div', { class: 'lrow' }, h('div', null, h('div', { class: 'eyebrow' }, 'Inbox'), h('h1', { class: 'h1' }, 'Messages')),
        h('button', { class: 'btn sm', type: 'button', onclick: () => openNewGroup(C, (id) => { refreshList().then(() => C.go('messages/' + id)) }) }, icon('plus'), 'New group')),
      unreadTotal ? h('div', { class: 'unreadline' }, h('span', { class: 'ud' }), unreadTotal + ' unread chat' + (unreadTotal === 1 ? '' : 's')) : null))
    const search = h('input', { class: 'sfield', type: 'search', placeholder: 'Search chats', 'aria-label': 'Search chats', value: query })
    search.addEventListener('input', () => { query = search.value; drawRows() })
    listcol.appendChild(h('div', { class: 'searchpill' }, icon('search'), search))
    const pills = [['all', 'All'], ['groups', 'Groups' + (groupCount ? ' (' + groupCount + ')' : '')], ['unread', 'Unread' + (unreadTotal ? ' (' + unreadTotal + ')' : '')], ['archived', 'Archived' + (archivedCount ? ' (' + archivedCount + ')' : '')]]
    listcol.appendChild(h('div', { class: 'pills', role: 'tablist' }, pills.map(p => h('button', { class: 'pillbtn' + (filter === p[0] ? ' on' : ''), role: 'tab', 'aria-selected': String(filter === p[0]), type: 'button', onclick: () => { filter = p[0]; drawList() } }, p[1]))))
    listcol.appendChild(h('div', { class: 'rows', id: 'rows' }))
    drawRows()
  }

  const drawRows = () => {
    const host = listcol.querySelector('.rows'); if (!host) return
    clear(host)
    const q = query.trim().toLowerCase()
    let rows = items.filter(c => {
      if (filter === 'archived') return archivedOf(c)
      if (archivedOf(c)) return false
      if (filter === 'groups') return c.kind !== 'direct'
      if (filter === 'unread') return unreadOf(c) > 0
      return true
    })
    if (q) rows = rows.filter(c => itemTitle(c).toLowerCase().includes(q) || String(c.last_message_preview || '').toLowerCase().includes(q))
    rows.sort((a, b) => (pinnedOf(b) - pinnedOf(a)) || String(lastAtOf(b) || '').localeCompare(String(lastAtOf(a) || '')))
    if (!rows.length) {
      const msg = filter === 'archived' ? ['Nothing archived', 'Archived chats show up here.'] : filter === 'unread' ? ['All caught up', 'No unread chats.'] : filter === 'groups' ? ['No group chats yet', 'Start one with New group. Your wedding chats appear here too.'] : q ? ['No results', 'Try a different search.'] : ['No conversations yet', 'Open a lead and tap Message to start a chat with a couple.']
      host.appendChild(h('div', { class: 'empty' }, h('h2', { class: 'h3' }, msg[0]), h('p', null, msg[1])))
      return
    }
    rows.forEach(c => {
      const un = unreadOf(c), isGroup = c.kind !== 'direct'
      const act = isGroup ? null : lastActive(c.lastSeen)
      const av = isGroup ? groupAvatar(c.avatars, 52, c.title) : h('div', { class: 'avatar md' }, c.avatar ? h('img', { src: img(c.avatar, 120), alt: '', loading: 'lazy' }) : initial(c.coupleName))
      const wrapAv = h('div', { class: 'cav' }, av, act ? h('span', { class: 'adot' + (act.online ? '' : ' off') }) : null)
      const sub = isGroup ? (c.member_count ? c.member_count + ' people' : '') : [act ? act.label : null, c.weddingDate ? fmtDate(c.weddingDate) : null].filter(Boolean).join('  ·  ')
      const prev = isGroup ? (c.last_message_preview ? (c.last_sender_name ? c.last_sender_name + ': ' : '') + c.last_message_preview : 'No messages yet') : (c.last_message_preview || 'No messages yet')
      host.appendChild(h('button', { class: 'crow' + (un ? ' unread' : '') + (c.id === openId ? ' open' : ''), type: 'button', 'aria-current': c.id === openId ? 'true' : null, onclick: () => C.go('messages/' + c.id) },
        wrapAv,
        h('div', { class: 'cbody' },
          h('div', { class: 'ctop' }, h('span', { class: 'ctitle' }, itemTitle(c)), pinnedOf(c) ? h('span', { class: 'mini' }, icon('pin')) : null, (isGroup && c.muted) ? h('span', { class: 'mini' }, icon('bellOff')) : null, h('span', { class: 'ctime' }, ago(c.last_message_at))),
          sub ? h('div', { class: 'csub' + (act && act.online ? ' online' : '') }, sub) : null,
          h('div', { class: 'cprev' }, prev)),
        un ? h('span', { class: 'cbadge' }, un > 99 ? '99+' : String(un)) : null))
    })
  }

  const refreshList = async () => {
    try {
      const [direct, groups] = await Promise.all([loadConvs(C.sb, C.vendor.id), loadGroups(C.sb)])
      if (!alive) return
      items = direct.map(c => ({ ...c, kind: 'direct' })).concat(groups.map(g => ({ ...g, kind: g.kind || 'group', last_message_at: g.last_message_at })))
      drawList()
    } catch (e) { /* keep the old list */ }
  }

  /* ----------------------------- thread ----------------------------- */
  const openThread = async (id) => {
    clear(threadcol)
    threadcol.classList.remove('empty')
    C.immersive(true)
    let conv = items.find(c => c.id === id)
    if (!conv) { await refreshList(); conv = items.find(c => c.id === id) }
    if (!conv) {
      threadcol.appendChild(h('div', { class: 'thread' }, h('div', { class: 'thead' }, h('button', { class: 'iconbtn', 'aria-label': 'Back', onclick: () => C.go('messages') }, icon('back'))),
        h('div', { class: 'empty' }, h('h2', { class: 'h3' }, 'Conversation not found'), h('p', null, 'It may have been removed.'))))
      return
    }
    const isGroup = conv.kind !== 'direct'
    const me = C.user.id
    const leadOf = () => ({ coupleId: conv.couple_id, matchId: conv.match_id, weddingDate: conv.weddingDate })

    // state
    let msgs = []
    const seen = new Set()
    const rx = new Map()          // message id -> reactions
    let names = {}                // group member names
    let pins = new Set()
    let replyTo = null
    let stick = true
    let pendingSends = 0
    let typing = false, typingOn = false, typingTimer = null
    let presence = null
    const nodes = new Map()       // keyed DOM cache so photos do not reload on every redraw

    // elements
    const msgsEl = h('div', { class: 'msgs', role: 'log', 'aria-live': 'polite' })
    const jump = h('button', { class: 'jump hidden', type: 'button', onclick: () => { stick = true; toBottom(true); jump.classList.add('hidden') } }, icon('down'), 'New messages')
    const input = h('textarea', { rows: '1', placeholder: isGroup ? 'Message the group' : 'Write a message', 'aria-label': 'Message' })
    const sendBtn = h('button', { class: 'btn', 'aria-label': 'Send', type: 'button' }, icon('send'))
    const attachBtn = h('button', { class: 'iconbtn', 'aria-label': 'Add to chat', type: 'button', style: { flex: 'none', height: '46px' } }, icon('plus'))
    const replyBar = h('div', { class: 'replybar hidden' })
    const pinBar = h('button', { class: 'pinbar hidden', type: 'button' })
    const subEl = h('div', { class: 's' })
    const titleEl = h('div', { class: 't' }, isGroup ? (conv.title || 'Group') : (conv.coupleName + (conv.partnerName ? ' & ' + conv.partnerName : '')))

    const paintSub = () => {
      subEl.classList.toggle('typing', typing); subEl.classList.remove('online')
      if (typing) { subEl.textContent = 'Typing…'; return }
      if (isGroup) { subEl.textContent = (conv.member_count ? conv.member_count + ' people' : 'Group chat'); return }
      const act = lastActive(conv.lastSeen)
      if (act && act.online) subEl.classList.add('online')
      subEl.textContent = act ? act.label : ([conv.weddingDate ? fmtDate(conv.weddingDate) : null, conv.location].filter(Boolean).join('  ·  ') || 'Couple')
    }
    paintSub()

    const headAv = isGroup ? groupAvatar(conv.avatars, 40, conv.title) : h('div', { class: 'avatar sm' }, conv.avatar ? h('img', { src: img(conv.avatar, 100), alt: '' }) : initial(conv.coupleName))
    const optionsBtn = h('button', { class: 'iconbtn', 'aria-label': 'Chat options', type: 'button', onclick: () => openOptions() }, icon('more'))
    const thread = h('div', { class: 'thread' },
      h('div', { class: 'thead' },
        h('button', { class: 'iconbtn', 'aria-label': 'Back to messages', onclick: () => C.go('messages') }, icon('back')),
        h('div', { class: 'hav' }, headAv),
        h('button', { class: 'who', type: 'button', onclick: () => isGroup ? openInfo() : C.go('leads/' + conv.couple_id) }, titleEl, subEl),
        isGroup ? h('button', { class: 'iconbtn', 'aria-label': 'Group details', type: 'button', onclick: () => openInfo() }, icon('users')) : h('button', { class: 'linkbtn', style: { minHeight: '44px', padding: '0 10px' }, onclick: () => C.go('leads/' + conv.couple_id) }, 'Profile'),
        optionsBtn),
      pinBar,
      h('div', { class: 'msgwrap2' }, msgsEl, jump),
      replyBar,
      h('div', { class: 'compose' }, attachBtn, input, sendBtn))
    threadcol.appendChild(thread)
    msgsEl.appendChild(h('div', { class: 'spin' }))

    /* --- scrolling that behaves: only follow new messages when already at the bottom --- */
    const toBottom = (smooth) => { msgsEl.scrollTo ? msgsEl.scrollTo({ top: msgsEl.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }) : (msgsEl.scrollTop = msgsEl.scrollHeight) }
    msgsEl.addEventListener('scroll', () => {
      const dist = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight
      stick = dist < 80
      if (stick) jump.classList.add('hidden')
    }, { passive: true })
    msgsEl.addEventListener('photoload', () => { if (stick) toBottom(false) })

    /* --- build one message --- */
    const nameOf = (uid) => (names[uid] && names[uid].display_name) || 'Member'
    const rxOf = (m) => rx.get(m.id) || []
    const keyOf = (m) => m._key || m.id
    const buildMsg = (m, i, list) => {
      const prev = list[i - 1], next = list[i + 1]
      const mine = m.sender_id === me
      if (m.message_type === 'system') return h('div', { class: 'sysmsg' }, m.body)
      if (m.message_type === 'booking' && m.metadata && !m.is_deleted) return bookingCard(m, mine, () => openBooking(C, leadOf()))
      const firstOfRun = !prev || prev.sender_id !== m.sender_id || prev.message_type === 'system' || prev.message_type === 'booking' || !sameDay(prev.created_at, m.created_at) || (new Date(m.created_at) - new Date(prev.created_at)) > 5 * 60000
      const lastOfRun = !next || next.sender_id !== m.sender_id || next.message_type === 'system' || next.message_type === 'booking' || !sameDay(next.created_at, m.created_at) || (new Date(next.created_at) - new Date(m.created_at)) > 5 * 60000
      const isImg = !!m.attachment_url && /image/.test(m.attachment_type || 'image') && !m.is_deleted
      const wrap = h('div', { class: 'mrow2 ' + (mine ? 'me' : 'them') + (firstOfRun ? ' first' : '') + (lastOfRun ? ' last' : '') })
      if (isGroup && !mine) {
        const nm = names[m.sender_id]
        wrap.appendChild(h('div', { class: 'sav' }, lastOfRun ? h('div', { class: 'avatar xs' }, nm && nm.avatar_url ? h('img', { src: img(nm.avatar_url, 80), alt: '' }) : initial(nameOf(m.sender_id))) : null))
      }
      const col = h('div', { class: 'mcol' })
      if (isGroup && !mine && firstOfRun) col.appendChild(h('div', { class: 'sname', style: { color: tint(m.sender_id) } }, nameOf(m.sender_id)))
      // reply quote
      if (m.reply_to_id && !m.is_deleted) {
        const orig = msgs.find(x => x.id === m.reply_to_id)
        col.appendChild(h('button', { class: 'quote', type: 'button', onclick: () => { const nd = nodes.get(m.reply_to_id); if (nd && nd.el) { nd.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); nd.el.classList.add('flash'); setTimeout(() => nd.el.classList.remove('flash'), 1200) } } },
          h('b', null, orig ? (orig.sender_id === me ? 'You' : (isGroup ? nameOf(orig.sender_id) : conv.coupleName)) : 'Message'),
          h('span', null, orig ? (orig.is_deleted ? 'Message removed' : (orig.body || (orig.attachment_url ? 'Photo' : ''))) : 'Original message')))
      }
      let content
      const status = m._status || null
      if (m.is_deleted) content = h('div', { class: 'bub gone' }, h('i', null, 'Message removed'))
      else if (isImg) {
        const onOpen = status === 'failed' ? () => retry(m) : () => openLightbox(m.attachment_url)
        const label = status === 'sending' && m._progress ? Math.round(m._progress * 100) + '%' : ''
        content = h('div', { class: 'mphwrap' }, photoBox(m._local || img(m.attachment_url, 800), m._ratio || null, onOpen, status, label), m.body ? h('div', { class: 'bub ' + (mine ? 'me' : 'them'), style: { marginTop: '4px' } }, m.body) : null)
      } else {
        content = h('div', { class: 'bub ' + (mine ? 'me' : 'them') + (status === 'sending' ? ' pending' : '') + (status === 'failed' ? ' failed' : '') }, m.body)
        if (status === 'failed') content.addEventListener('click', () => retry(m))
      }
      const holder = h('div', { class: 'mhold' }, content)
      if (!m.is_deleted && !status) {
        holder.appendChild(h('button', { class: 'mmore', type: 'button', 'aria-label': 'Message options', onclick: (e) => { e.stopPropagation(); openActions(m) } }, icon('smile')))
        let lp = null
        holder.addEventListener('touchstart', () => { lp = setTimeout(() => openActions(m), 450) }, { passive: true })
        const cancel = () => clearTimeout(lp)
        holder.addEventListener('touchend', cancel); holder.addEventListener('touchmove', cancel); holder.addEventListener('touchcancel', cancel)
        holder.addEventListener('contextmenu', (e) => { e.preventDefault(); openActions(m) })
      }
      col.appendChild(holder)
      // reactions
      const rs = rxOf(m)
      if (rs.length) {
        const groupedR = EMOJIS.map(e => ({ e, n: rs.filter(r => r.emoji === e).length, mine: rs.some(r => r.emoji === e && r.user_id === me) })).filter(x => x.n)
        col.appendChild(h('div', { class: 'rxrow' }, groupedR.map(x => h('button', { class: 'rxchip' + (x.mine ? ' mine' : ''), type: 'button', onclick: () => react(m, x.e) }, x.e + (x.n > 1 ? ' ' + x.n : '')))))
      }
      // time / status line
      const lastMineId = (() => { for (let k = list.length - 1; k >= 0; k--) { if (list[k].sender_id === me && !list[k].is_deleted && list[k].message_type !== 'system') return list[k].id } return null })()
      if (status === 'failed') col.appendChild(h('div', { class: 'tline bad' }, 'Not sent. Tap to try again'))
      else if (status === 'sending' && !isImg) col.appendChild(h('div', { class: 'tline' }, 'Sending…'))
      else if (m._flash && isImg) col.appendChild(h('div', { class: 'tline ok' }, 'Sent'))
      else if (lastOfRun) col.appendChild(h('div', { class: 'tline' }, clock(m.created_at) + (!isGroup && mine && m.id === lastMineId ? (m.is_read ? '  ·  Read' : '  ·  Sent') : '')))
      wrap.appendChild(col)
      return wrap
    }
    const sigOf = (m, i, list) => {
      const prev = list[i - 1], next = list[i + 1]
      return [m.body, m.is_deleted, m.is_read, m._status, m._flash, m.attachment_url, m._progress ? Math.floor(m._progress * 10) : 0, m.reply_to_id, pins.has(m.id),
        rxOf(m).map(r => r.user_id + r.emoji).join(','), prev && prev.sender_id, next && next.sender_id, prev && String(prev.created_at || '').slice(0, 16), next && String(next.created_at || '').slice(0, 16),
        isGroup ? (names[m.sender_id] && names[m.sender_id].display_name) : '', (list[i + 1] === undefined)].join('|')
    }

    const draw = () => {
      const list = msgs.filter(m => !(m.is_deleted_locally && m.local_deleted_by === me))
      const keep = new Set()
      const frag = document.createDocumentFragment()
      if (!list.length) { clear(msgsEl); msgsEl.appendChild(h('div', { class: 'empty' }, h('p', null, isGroup ? 'Say hello to the group.' : 'Say hello. Keep it friendly and specific to their day.'))); nodes.clear(); return }
      let lastDay = ''
      list.forEach((m, i) => {
        const dl = dayLabel(m.created_at)
        if (dl !== lastDay) { lastDay = dl; const dk = 'day:' + dl; keep.add(dk); let dn = nodes.get(dk); if (!dn) { dn = { sig: dl, el: h('div', { class: 'day' }, dl) }; nodes.set(dk, dn) } frag.appendChild(dn.el) }
        const k = keyOf(m); keep.add(k)
        const sig = sigOf(m, i, list)
        let nd = nodes.get(k)
        if (!nd || nd.sig !== sig) { nd = { sig, el: buildMsg(m, i, list) }; nodes.set(k, nd) }
        frag.appendChild(nd.el)
      })
      if (typing) frag.appendChild(h('div', { class: 'typingrow' }, h('span', { class: 'td' }), h('span', { class: 'td' }), h('span', { class: 'td' })))
      for (const k of [...nodes.keys()]) if (!keep.has(k)) nodes.delete(k)
      clear(msgsEl); msgsEl.appendChild(frag)
      if (stick) toBottom(false)
      paintPin()
    }

    /* --- pinned banner (1:1 chats) --- */
    const paintPin = () => {
      const pm = [...msgs].reverse().find(m => pins.has(m.id) && !m.is_deleted)
      if (!pm || isGroup) { pinBar.classList.add('hidden'); return }
      clear(pinBar); pinBar.classList.remove('hidden')
      pinBar.appendChild(icon('pin')); pinBar.appendChild(h('span', null, pm.body || 'Photo'))
      pinBar.onclick = () => { const nd = nodes.get(keyOf(pm)); if (nd && nd.el) { nd.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); nd.el.classList.add('flash'); setTimeout(() => nd.el.classList.remove('flash'), 1200) } }
    }

    /* --- data --- */
    const markRead = async () => {
      try {
        if (isGroup) await C.sb.rpc('mark_group_read', { p_conv: conv.id })
        else {
          const r = await C.sb.rpc('mark_conversation_read', { p_conv: conv.id })
          if (r && r.error) await C.sb.rpc('reset_unread_count', { conv_id: conv.id, reader_is_couple: false })
        }
      } catch (e) { /* best effort */ }
      C.refreshBadges && C.refreshBadges()
    }
    const loadReactions = async (ids) => {
      if (!ids.length) return
      try {
        const { data } = await C.sb.from('message_reactions').select('id, message_id, user_id, emoji').in('message_id', ids)
        ;(data || []).forEach(r => { const a = rx.get(r.message_id) || []; if (!a.find(x => x.id === r.id)) a.push(r); rx.set(r.message_id, a) })
      } catch (e) { /* reactions are optional */ }
    }
    try {
      const q = C.sb.from('messages').select(COLS).eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(300)
      const { data, error } = await q
      if (error) throw error
      msgs = (data || []).slice().reverse()
      msgs.forEach(m => seen.add(m.id))
      if (isGroup) { const r = await C.sb.rpc('group_members', { p_conv: conv.id }); ((r && r.data) || []).forEach(x => { names[x.user_id] = x }) }
      else { try { const { data: pd } = await C.sb.from('message_pins').select('message_id').eq('conversation_id', conv.id); pins = new Set((pd || []).map(p => p.message_id)) } catch (e) { /* no pins */ } }
      await loadReactions(msgs.map(m => m.id))
      draw(); toBottom(false); markRead()
    } catch (e) { clear(msgsEl); msgsEl.appendChild(h('div', { class: 'empty' }, h('p', null, C.err(e)))) }

    /* --- live updates --- */
    const ch = C.sb.channel((isGroup ? 'gt:' : 'chat:') + conv.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conv.id }, (p) => {
        const nm = p.new; if (!nm || seen.has(nm.id)) return
        if (nm.sender_id === me && pendingSends > 0 && nm.message_type !== 'booking') return
        seen.add(nm.id); msgs.push(nm)
        if (nm.message_type === 'system' && isGroup) C.sb.rpc('group_members', { p_conv: conv.id }).then(r => { ((r && r.data) || []).forEach(x => { names[x.user_id] = x }); draw() })
        if (!stick && nm.sender_id !== me) jump.classList.remove('hidden')
        draw()
        if (nm.sender_id !== me) {
          if (!isGroup) C.sb.from('messages').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', nm.id).then(() => {})
          markRead()
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conv.id }, (p) => {
        const u = p.new; msgs = msgs.map(m => m.id === u.id ? { ...m, ...u, _key: m._key, _flash: m._flash } : m); draw()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, (p) => {
        const r = p.new; if (!r || !seen.has(r.message_id)) return
        const a = (rx.get(r.message_id) || []).filter(x => x.id !== r.id && !(x.user_id === r.user_id && x.emoji === r.emoji)); a.push(r); rx.set(r.message_id, a); draw()
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, (p) => {
        const r = p.old; if (!r) return
        for (const [k, a] of rx) { const f = a.filter(x => x.id !== r.id); if (f.length !== a.length) rx.set(k, f) }
        draw()
      })
    if (!isGroup) {
      ch.on('presence', { event: 'sync' }, () => {
        try {
          const state = ch.presenceState ? ch.presenceState() : {}
          const others = Object.values(state).flat().filter(s => s && s.userId && s.userId !== me)
          const t = others.some(s => s.typing)
          if (t !== typing) { typing = t; paintSub(); draw() }
        } catch (e) { /* presence is a nicety */ }
      })
    }
    ch.subscribe(async (st) => { if (st === 'SUBSCRIBED' && !isGroup) { presence = ch; try { await ch.track({ userId: me, typing: false, viewing: !document.hidden }) } catch (e) { /* ignore */ } } })

    // tell the server this chat is on screen (no notifications for it) and keep "Active now" fresh
    const beat = () => { if (!document.hidden) C.sb.rpc('set_presence', { p_foreground: true, p_conversation: conv.id }).then(() => {}, () => {}) }
    beat(); const beatTimer = setInterval(beat, 30000)
    document.addEventListener('visibilitychange', beat)
    C.openConvId = conv.id

    const setTyping = (on) => {
      if (isGroup || typingOn === on) return
      typingOn = on
      try { presence && presence.track({ userId: me, typing: on, viewing: !document.hidden }) } catch (e) { /* ignore */ }
    }

    /* --- sending --- */
    const addTemp = (patch) => {
      const id = 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
      const m = { id, _key: id, conversation_id: conv.id, sender_id: me, body: null, attachment_url: null, attachment_type: null, message_type: null, is_read: false, created_at: new Date().toISOString(), _status: 'sending', ...patch }
      msgs.push(m); stick = true; jump.classList.add('hidden'); draw(); toBottom(false)
      return m
    }
    const deliver = async (m, row) => {
      pendingSends++
      try {
        const { data, error } = await C.sb.from('messages').insert({ conversation_id: conv.id, sender_id: me, is_read: false, ...row }).select(COLS).single()
        if (error) throw error
        seen.add(data.id)
        const hadPhoto = !!data.attachment_url
        const dup = msgs.findIndex(x => x.id === data.id && x !== m)
        if (dup >= 0) msgs.splice(dup, 1)
        const idx = msgs.indexOf(m)
        if (idx >= 0) msgs[idx] = { created_at: m.created_at, ...data, _key: m._key, _flash: hadPhoto, _local: m._local, _ratio: m._ratio }
        draw()
        if (hadPhoto) setTimeout(() => { const x = msgs.find(y => y.id === data.id); if (x) { x._flash = false; draw() } }, 1800)
        if (!isGroup) await C.sb.from('conversations').update({ last_message_at: new Date().toISOString(), last_message_preview: row.body ? row.body : 'Photo' }).eq('id', conv.id)
      } catch (e) {
        m._status = 'failed'; draw()
        C.toast('Not sent. ' + C.err(e), true)
      }
      pendingSends--
    }
    const sendText = () => {
      const text = input.value.trim(); if (!text) return
      input.value = ''; input.style.height = 'auto'; setTyping(false)
      const rt = replyTo; setReply(null)
      const m = addTemp({ body: text, reply_to_id: rt ? rt.id : null })
      m._row = { body: text, reply_to_id: rt ? rt.id : null }
      deliver(m, m._row)
    }
    const uploadPhoto = async (m) => {
      m._status = 'sending'; m._progress = 0; draw()
      pendingSends++
      try {
        const url = m._url || await uploadToCloudinary(C.cfg, m._file, 'image', (p) => { m._progress = p; draw() })
        m._url = url
        pendingSends--
        await deliver(m, { body: '', attachment_url: url, attachment_type: 'image/jpeg' })
        pendingSends++
      } catch (e) { m._status = 'failed'; draw(); C.toast('Photo not sent. ' + C.err(e), true) }
      pendingSends--
    }
    const sendPhoto = async () => {
      const [f] = await pick('image/*', false); if (!f) return
      const local = URL.createObjectURL(f)
      const ratio = await new Promise((res) => { const t = new Image(); t.onload = () => res(t.naturalWidth / (t.naturalHeight || 1)); t.onerror = () => res(null); t.src = local })
      const m = addTemp({ attachment_url: local, attachment_type: 'image/jpeg', _local: local, _ratio: ratio, _file: f })
      uploadPhoto(m)
    }
    const retry = (m) => {
      if (m._file && !m._url) { uploadPhoto(m); return }
      m._status = 'sending'; draw()
      deliver(m, m._row || { body: '', attachment_url: m._url || m.attachment_url, attachment_type: 'image/jpeg' })
    }
    sendBtn.addEventListener('click', sendText)
    input.addEventListener('input', () => {
      input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'
      if (input.value.trim()) { setTyping(true); clearTimeout(typingTimer); typingTimer = setTimeout(() => setTyping(false), 2500) } else setTyping(false)
    })
    input.addEventListener('keydown', (e) => {
      const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches
      if (e.key === 'Enter' && !e.shiftKey && !touch) { e.preventDefault(); sendText() }
    })
    attachBtn.addEventListener('click', () => {
      const menu = C.sheet({ title: 'Add to chat', body: h('div', { class: 'menu' },
        !isGroup ? h('button', { class: 'mi', onclick: () => { menu.close(); openBooking(C, leadOf()) } }, icon('cal'), 'Booking request') : null,
        h('button', { class: 'mi', onclick: () => { menu.close(); sendPhoto() } }, icon('img'), 'Photo')) })
    })

    /* --- reply bar --- */
    function setReply(m) {
      replyTo = m
      clear(replyBar)
      if (!m) { replyBar.classList.add('hidden'); return }
      replyBar.classList.remove('hidden')
      replyBar.appendChild(h('div', { class: 'rb' }, h('b', null, 'Replying to ' + (m.sender_id === me ? 'yourself' : (isGroup ? nameOf(m.sender_id) : conv.coupleName))), h('span', null, m.body || 'Photo')))
      replyBar.appendChild(h('button', { class: 'iconbtn', 'aria-label': 'Cancel reply', type: 'button', onclick: () => setReply(null) }, icon('x')))
      input.focus()
    }

    /* --- actions --- */
    async function react(m, emoji) {
      const list = (rx.get(m.id) || [])
      const mineR = list.find(r => r.user_id === me)
      if (mineR && mineR.emoji === emoji) {
        rx.set(m.id, list.filter(r => r.id !== mineR.id)); draw()
        await C.sb.from('message_reactions').delete().eq('id', mineR.id); return
      }
      let next = list
      if (mineR) { next = list.filter(r => r.id !== mineR.id); await C.sb.from('message_reactions').delete().eq('id', mineR.id) }
      const { data } = await C.sb.from('message_reactions').insert({ message_id: m.id, user_id: me, emoji }).select('id, message_id, user_id, emoji').single()
      if (data) { rx.set(m.id, next.filter(r => r.id !== data.id).concat([data])); draw() }
    }
    function openActions(m) {
      const mine = m.sender_id === me
      const s = C.sheet({ title: '', body: h('div', null,
        h('div', { class: 'emrow' }, EMOJIS.map(e => h('button', { class: 'em', type: 'button', onclick: () => { s.close(); react(m, e) } }, e))),
        h('div', { class: 'menu' },
          h('button', { class: 'mi', onclick: () => { s.close(); setReply(m) } }, icon('reply'), 'Reply'),
          m.body ? h('button', { class: 'mi', onclick: () => { s.close(); try { navigator.clipboard.writeText(m.body); C.toast('Copied') } catch (e) { C.toast('Could not copy', true) } } }, icon('copy'), 'Copy') : null,
          !isGroup ? h('button', { class: 'mi', onclick: async () => {
            s.close()
            try {
              if (pins.has(m.id)) { pins.delete(m.id); await C.sb.from('message_pins').delete().eq('conversation_id', conv.id).eq('message_id', m.id) }
              else { pins.add(m.id); await C.sb.from('message_pins').insert({ conversation_id: conv.id, message_id: m.id, pinned_by: me }) }
              nodes.clear(); draw()
            } catch (e) { C.toast(C.err(e), true) }
          } }, icon('pin'), pins.has(m.id) ? 'Unpin' : 'Pin') : null,
          mine ? h('button', { class: 'mi', onclick: async () => {
            s.close(); m.is_deleted = true; draw()
            const { error } = await C.sb.from('messages').update({ is_deleted: true }).eq('id', m.id)
            if (error) { m.is_deleted = false; draw(); C.toast('Could not remove that message.', true) }
          } }, icon('trash'), 'Unsend') : h('button', { class: 'mi', onclick: async () => {
            s.close()
            const { error } = await C.sb.rpc('submit_report', { p_content_type: 'message', p_content_id: m.id, p_reason: 'Reported from the vendor portal', p_details: null, p_conversation: conv.id })
            C.toast(error ? 'Could not send the report. Try again.' : 'Thanks, we have sent this to the Aisle Match team.', !!error)
          } }, icon('flag'), 'Report message'))) })
    }
    function openLightbox(src) {
      const s = C.sheet({ title: '', body: h('div', { class: 'lightbox' }, h('img', { src: img(src, 1400), alt: 'Photo' })) })
      return s
    }
    function openInfo() {
      openGroupInfo(C, conv, { onChanged: () => { refreshList().then(() => { const g = items.find(x => x.id === conv.id); if (g) { conv = g; titleEl.textContent = g.title || 'Group'; paintSub() } }) }, onLeft: () => { C.go('messages'); refreshList() } })
    }
    function openOptions() {
      const pinned = isGroup ? !!conv.pinned : !!conv.is_pinned_by_vendor
      const s = C.sheet({ title: titleEl.textContent, body: h('div', { class: 'menu' },
        isGroup ? h('button', { class: 'mi', onclick: () => { s.close(); openInfo() } }, icon('users'), 'Group details') : h('button', { class: 'mi', onclick: () => { s.close(); C.go('leads/' + conv.couple_id) } }, icon('user'), 'View profile'),
        h('button', { class: 'mi', onclick: async () => {
          s.close()
          if (isGroup) await C.sb.rpc('set_group_flags', { p_conv: conv.id, p_pinned: !pinned })
          else await C.sb.from('conversations').update({ is_pinned_by_vendor: !pinned }).eq('id', conv.id)
          C.toast(pinned ? 'Unpinned' : 'Pinned to the top'); refreshList()
        } }, icon('pin'), pinned ? 'Unpin chat' : 'Pin to top'),
        isGroup ? h('button', { class: 'mi', onclick: async () => { s.close(); await C.sb.rpc('set_group_flags', { p_conv: conv.id, p_muted: !conv.muted }); C.toast(conv.muted ? 'Notifications on' : 'Muted'); refreshList() } }, icon('bellOff'), conv.muted ? 'Unmute notifications' : 'Mute notifications') : null,
        h('button', { class: 'mi', onclick: async () => {
          s.close()
          const next = !(isGroup ? conv.archived : conv.is_archived_by_vendor)
          if (isGroup) await C.sb.rpc('set_group_flags', { p_conv: conv.id, p_archived: next })
          else { const { error } = await C.sb.from('conversations').update({ is_archived_by_vendor: next }).eq('id', conv.id); if (error) { C.toast(C.err(error), true); return } }
          C.toast(next ? 'Archived' : 'Moved to inbox'); C.go('messages')
        } }, icon('archive'), (isGroup ? conv.archived : conv.is_archived_by_vendor) ? 'Unarchive' : 'Archive'))
      })
    }

    threadCleanup = () => {
      clearInterval(beatTimer); clearTimeout(typingTimer)
      document.removeEventListener('visibilitychange', beat)
      setTyping(false)
      try { C.sb.removeChannel(ch) } catch (e) { /* ignore */ }
      C.openConvId = null
      C.sb.rpc('set_presence', { p_foreground: true, p_conversation: null }).then(() => {}, () => {})
      markRead()
    }
  }

  const placeholder = () => {
    clear(threadcol)
    threadcol.appendChild(h('div', { class: 'nothread' }, h('div', { style: { textAlign: 'center' } },
      h('div', { class: 'h2' }, 'Pick a conversation'), h('p', { class: 'muted' }, 'Your messages with couples and your group chats show up here.'))))
  }

  // list stays live: direct chats via the portal feed, groups via my membership rows
  C.onConvChange = () => { clearTimeout(C._lt); C._lt = setTimeout(refreshList, 250) }
  try {
    listChannel = C.sb.channel('vlist:' + C.user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members', filter: 'user_id=eq.' + C.user.id }, () => C.onConvChange && C.onConvChange())
      .subscribe()
  } catch (e) { /* the 1:1 feed still works */ }
  drawList()
  refreshList().then(() => { if (openId && alive) openThread(openId) })
  if (!openId) placeholder()
  return () => {
    alive = false
    if (threadCleanup) threadCleanup()
    if (listChannel) { try { C.sb.removeChannel(listChannel) } catch (e) { /* ignore */ } }
    C.immersive(false)
  }
}
