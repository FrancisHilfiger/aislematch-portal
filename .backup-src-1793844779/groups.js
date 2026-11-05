import { h, clear, icon, img, initial } from './lib.js'

const TINTS = ['#8a5a44', '#4f6f8f', '#7a6a3a', '#5b7a62', '#8a4f6a', '#4f7a7a']
export function tint(id) { let n = 0; const s = String(id || ''); for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) | 0; return TINTS[Math.abs(n) % TINTS.length] }

// Messenger style avatar: 1 photo, or 2 to 3 overlapping circles. `online` adds the green dot.
export function groupAvatar(urls, size, title, online) {
  const list = (urls || []).filter(Boolean).slice(0, 3)
  const wrap = h('div', { class: 'gav', style: { width: size + 'px', height: size + 'px' } })
  const dot = (u, d, pos) => {
    const el = h('div', { class: 'gdot', style: { width: d + 'px', height: d + 'px', background: u ? 'var(--ice)' : tint(title || 'g'), fontSize: Math.round(d * 0.42) + 'px', ...pos } }, u ? h('img', { src: img(u, 120), alt: '', loading: 'lazy' }) : initial(title))
    wrap.appendChild(el)
  }
  if (list.length <= 1) dot(list[0], size, { top: '0', left: '0', border: 'none' })
  else if (list.length === 2) { const d = Math.round(size * 0.68); dot(list[0], d, { top: '0', right: '0' }); dot(list[1], d, { bottom: '0', left: '0' }) }
  else { const d = Math.round(size * 0.58); dot(list[0], d, { top: '0', left: Math.round((size - d) / 2) + 'px' }); dot(list[1], d, { bottom: '0', left: '0' }); dot(list[2], d, { bottom: '0', right: '0' }) }
  if (online) wrap.appendChild(h('span', { class: 'adot' }))
  return wrap
}

function friendlyGroupError(C, e) {
  const m = String((e && e.message) || e || '')
  if (/title_required/.test(m)) return 'Give the group a name.'
  if (/add_someone/.test(m)) return 'Pick at least one person.'
  if (/too_many_members/.test(m)) return 'Groups can have up to 30 people.'
  if (/cannot_add/.test(m)) return 'You can only add people you have messaged or booked with.'
  if (/not_admin|not_a_member|forbidden/.test(m)) return 'Only group admins can do that.'
  return C.err(e)
}

// A searchable list of people you are allowed to add. `convId` hides people already in the group.
function peoplePicker(C, convId, selected, onChange) {
  const box = h('div', { class: 'pp' })
  const search = h('input', { class: 'input', placeholder: 'Search people', 'aria-label': 'Search people' })
  const list = h('div', { class: 'pplist' }, h('div', { class: 'spin' }))
  box.appendChild(search); box.appendChild(list)
  let rows = []
  const draw = () => {
    clear(list)
    const q = search.value.trim().toLowerCase()
    const shown = rows.filter(r => !q || String(r.display_name || '').toLowerCase().includes(q))
    if (!shown.length) { list.appendChild(h('p', { class: 'muted', style: { padding: '14px 2px' } }, rows.length ? 'No one matches that.' : 'No one to add yet. You can add couples and vendors you have messaged or booked with.')); return }
    shown.forEach(r => {
      const on = selected.has(r.user_id)
      list.appendChild(h('button', { class: 'pprow' + (on ? ' on' : ''), type: 'button', onclick: () => { if (selected.has(r.user_id)) selected.delete(r.user_id); else selected.add(r.user_id); onChange(); draw() } },
        h('div', { class: 'avatar sm' }, r.avatar_url ? h('img', { src: img(r.avatar_url, 100), alt: '' }) : initial(r.display_name)),
        h('div', { class: 'body' }, h('div', { class: 't' }, r.display_name || 'Someone'), h('div', { class: 's' }, [r.kind === 'vendor' ? 'Vendor' : 'Couple', r.subtitle].filter(Boolean).join('  ·  '))),
        h('span', { class: 'tick' }, on ? icon('tick') : null)))
    })
  }
  search.addEventListener('input', draw)
  C.sb.rpc('group_candidates', { p_conv: convId || null }).then(r => { rows = (r && r.data) || []; draw() }, () => { rows = []; draw() })
  return box
}

export function openNewGroup(C, onDone) {
  const selected = new Set()
  const title = h('input', { class: 'input', placeholder: 'Group name', maxlength: '60', 'aria-label': 'Group name' })
  const btn = h('button', { class: 'btn', type: 'button', disabled: true }, 'Create group')
  const count = h('span', { class: 'tiny' }, '')
  const update = () => { btn.disabled = selected.size === 0; count.textContent = selected.size ? selected.size + ' selected' : '' }
  const body = h('div', null, h('p', { class: 'muted small', style: { marginBottom: '10px' } }, 'Chat with several people at once. You can add couples and vendors you have messaged or booked with.'), title, h('div', { class: 'sp8' }), peoplePicker(C, null, selected, update))
  const s = C.sheet({ title: 'New group', body, footer: [count, btn] })
  btn.addEventListener('click', async () => {
    if (!title.value.trim()) { C.toast('Give the group a name.', true); title.focus(); return }
    btn.disabled = true
    try {
      const { data, error } = await C.sb.rpc('create_group_chat', { p_title: title.value.trim(), p_user_ids: [...selected] })
      if (error) throw error
      s.close(); onDone && onDone(data)
    } catch (e) { btn.disabled = false; C.toast(friendlyGroupError(C, e), true) }
  })
}

export function openGroupInfo(C, group, hooks) {
  const body = h('div', null, h('div', { class: 'spin' }))
  const s = C.sheet({ title: 'Group details', body })
  let members = []
  let me = null
  const reload = async () => {
    const { data } = await C.sb.rpc('group_members', { p_conv: group.id })
    members = Array.isArray(data) ? data : []
    me = members.find(m => m.user_id === C.user.id) || null
    draw()
  }
  const act = async (fn, okMsg) => {
    try { const r = await fn(); if (r && r.error) throw r.error; if (okMsg) C.toast(okMsg); hooks && hooks.onChanged && hooks.onChanged(); await reload() }
    catch (e) { C.toast(friendlyGroupError(C, e), true) }
  }
  const draw = () => {
    clear(body)
    const admin = !!(me && me.role === 'admin')
    body.appendChild(h('div', { class: 'ginfo' }, groupAvatar(group.avatars, 84, group.title), h('h2', { class: 'h2' }, group.title || 'Group'),
      h('div', { class: 'muted small' }, members.length + ' people')))
    if (admin && group.kind !== 'wedding') {
      body.appendChild(h('button', { class: 'linkbtn', onclick: () => {
        const name = window.prompt('Group name', group.title || '')
        if (name && name.trim()) act(() => C.sb.rpc('rename_group', { p_conv: group.id, p_title: name.trim() }), 'Renamed')
      } }, 'Rename group'))
    }
    body.appendChild(h('div', { class: 'sechead2' }, 'People'))
    members.forEach(m => {
      const isMe = m.user_id === C.user.id
      const row = h('div', { class: 'mrow' },
        h('div', { class: 'avatar sm' }, m.avatar_url ? h('img', { src: img(m.avatar_url, 100), alt: '' }) : initial(m.display_name)),
        h('div', { class: 'body' }, h('div', { class: 't' }, (m.display_name || 'Someone') + (isMe ? ' (you)' : '')),
          h('div', { class: 's' }, [m.kind === 'vendor' ? (m.category || 'Vendor') : 'Couple', m.is_booked ? 'Booked' : null].filter(Boolean).join('  ·  '))),
        m.role === 'admin' ? h('span', { class: 'tag' }, 'Admin') : null)
      if (admin && !isMe) {
        row.appendChild(h('button', { class: 'linkbtn', onclick: () => act(() => C.sb.rpc('set_group_admin', { p_conv: group.id, p_user: m.user_id, p_admin: m.role !== 'admin' }), m.role === 'admin' ? 'Admin removed' : 'Made admin') }, m.role === 'admin' ? 'Remove admin' : 'Make admin'))
        row.appendChild(h('button', { class: 'linkbtn bad', onclick: () => { if (window.confirm('Remove ' + (m.display_name || 'this person') + ' from the group?')) act(() => C.sb.rpc('remove_group_member', { p_conv: group.id, p_user: m.user_id }), 'Removed') } }, 'Remove'))
      }
      body.appendChild(row)
    })
    body.appendChild(h('div', { class: 'sp16' }))
    if (group.kind !== 'wedding' || admin) body.appendChild(h('button', { class: 'btn ghost block', onclick: () => addPeople() }, icon('plus'), 'Add people'))
    body.appendChild(h('div', { class: 'sp8' }))
    body.appendChild(h('button', { class: 'btn danger block', onclick: async () => {
      if (!window.confirm('Leave this group? You will stop getting its messages.')) return
      try { const { error } = await C.sb.rpc('leave_group', { p_conv: group.id }); if (error) throw error; s.close(); hooks && hooks.onLeft && hooks.onLeft() }
      catch (e) { C.toast(friendlyGroupError(C, e), true) }
    } }, 'Leave group'))
  }
  const addPeople = () => {
    const selected = new Set()
    const btn = h('button', { class: 'btn', type: 'button', disabled: true }, 'Add')
    const a = C.sheet({ title: 'Add people', body: peoplePicker(C, group.id, selected, () => { btn.disabled = selected.size === 0 }), footer: [btn] })
    btn.addEventListener('click', async () => {
      btn.disabled = true
      try { const { error } = await C.sb.rpc('add_group_members', { p_conv: group.id, p_user_ids: [...selected] }); if (error) throw error; a.close(); C.toast('Added'); hooks && hooks.onChanged && hooks.onChanged(); reload() }
      catch (e) { btn.disabled = false; C.toast(friendlyGroupError(C, e), true) }
    })
  }
  reload()
}
