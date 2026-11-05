import { h, clear, icon, fmtDate, LOGO, field, toggle } from './lib.js'

const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
const tm = (t) => (t ? String(t).slice(0, 5) : '')

const TYPES = [['pre_wedding', 'Pre-wedding'], ['getting_ready', 'Getting ready'], ['ceremony', 'Ceremony'], ['canapés', 'Canapés'], ['photos', 'Photos'], ['reception', 'Reception'],
  ['formalities', 'Formalities'], ['dancing', 'Dancing'], ['bump_in', 'Vendor bump-in'], ['bump_out', 'Vendor bump-out'], ['travel', 'Travel'], ['meal_break', 'Meal break'], ['other', 'General']]
const typeLabel = (k) => (TYPES.find(t => t[0] === k) || [0, ''])[1]
const bySchedule = (a, b) => { const x = a.time_start || '99:99', y = b.time_start || '99:99'; return x !== y ? x.localeCompare(y) : (a.sort_order || 0) - (b.sort_order || 0) }
const wedTitle = (name) => (name ? name + (/s$/i.test(name) ? "'" : "'s") + ' Wedding Day' : 'Wedding Day')

function sheetHtml(rs, name, items, parts) {
  const rows = items.map(i => '<tr><td>' + esc(tm(i.time_start)) + (i.time_end ? ' – ' + esc(tm(i.time_end)) : '') + '</td><td><b>' + esc(i.title) + '</b>' + (i.description ? '<br/>' + esc(i.description) : '') +
    (i.location ? '<br/><i>' + esc(i.location) + '</i>' : '') + '</td><td>' + esc((i.vendor && i.vendor.business_name) || i.responsible_party || '') + '</td></tr>').join('')
  const info = [['Ceremony', [rs.ceremony_venue, rs.ceremony_address].filter(Boolean).join(', ')], ['Reception', [rs.reception_venue, rs.reception_address].filter(Boolean).join(', ')],
    ['Emergency contact', [rs.emergency_contact_name, rs.emergency_contact_phone].filter(Boolean).join(' ')]].filter(x => x[1]).map(x => '<p><b>' + x[0] + ':</b> ' + esc(x[1]) + '</p>').join('')
  const css = "body{font-family:Arial,Helvetica,sans-serif;color:#352219;margin:0;padding:34px 40px;background:#fff}" +
    ".top{display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;border-bottom:2px solid #C3A475}.top img{height:44px}.top .tag{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#6b5c52}" +
    "h1{font-family:Georgia,'Times New Roman',serif;font-size:34px;margin:22px 0 2px;font-weight:700}.date{font-size:14px;color:#6b5c52;margin:0 0 18px}" +
    ".info{background:#fbf8f3;border:1px solid #e6dfd3;border-radius:8px;padding:12px 16px;margin-bottom:8px}.info p{margin:4px 0;font-size:13px}" +
    "table{border-collapse:collapse;width:100%;margin-top:14px}th{background:#352219;color:#fbf8f3;font-size:11px;letter-spacing:.1em;text-transform:uppercase;text-align:left;padding:9px 10px}" +
    "td{border-bottom:1px solid #c8d6de;padding:10px;text-align:left;vertical-align:top;font-size:13px}td:first-child{white-space:nowrap;font-weight:600;width:110px}" +
    ".foot{margin-top:26px;padding-top:12px;border-top:1px solid #c8d6de;font-size:11px;color:#6b5c52;display:flex;justify-content:space-between}" +
    "@media print{body{padding:18px 22px}th{-webkit-print-color-adjust:exact;print-color-adjust:exact}.top{-webkit-print-color-adjust:exact}}"
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Run sheet - ' + esc(name) + '</title><style>' + css + '</style></head><body>' +
    '<div class="top"><img src="' + LOGO + '" alt="Aisle Match"/><div class="tag">Wedding day run sheet</div></div>' +
    '<h1>' + esc(name) + '</h1><p class="date">' + esc(rs.wedding_date ? fmtDate(rs.wedding_date) : '') + '</p>' +
    (info ? '<div class="info">' + info + '</div>' : '') +
    '<table><tr><th>Time</th><th>What</th><th>Who</th></tr>' + rows + '</table>' +
    (parts.length ? '<p style="font-size:13px"><b>Vendors:</b> ' + esc(parts.map(p => (p.vendor && p.vendor.business_name) || '').filter(Boolean).join(', ')) + '</p>' : '') +
    '<div class="foot"><span>Prepared with Aisle Match</span><span>' + esc(new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })) + '</span></div></body></html>'
}

export async function renderRunsheet(C, view, parts) {
  view.appendChild(h('div', { class: 'pagehead' }, h('div', { class: 'eyebrow' }, 'Wedding day'), h('h1', { class: 'h1' }, 'Runsheet'),
    h('p', null, 'The timeline for every wedding you are booked on. Updates from the couple appear here automatically.')))
  const host = h('div'); view.appendChild(host)
  host.appendChild(h('div', { class: 'spin' }))
  const vid = C.vendor.id
  let sheets = []
  const editMap = {}
  let chan = null
  try {
    const { data: pr, error } = await C.sb.from('runsheet_participants').select('runsheet_id, role, can_edit').eq('vendor_id', vid)
    if (error) throw error
    ;(pr || []).forEach(p => { editMap[p.runsheet_id] = !!p.can_edit || p.role === 'planner' || p.role === 'admin' })
    const ids = (pr || []).map(p => p.runsheet_id)
    if (ids.length) {
      const { data: rs, error: e2 } = await C.sb.from('runsheets').select('*').in('id', ids)
      if (e2) throw e2
      sheets = (rs || []).slice().sort((a, b) => (a.wedding_date || '9999').localeCompare(b.wedding_date || '9999'))
      const { data: cps } = await C.sb.from('couples').select('id, user_id, partner_name').in('id', sheets.map(x => x.couple_id))
      const uids = [...new Set((cps || []).map(c => c.user_id).filter(Boolean))]
      const um = {}
      if (uids.length) { const { data: us } = await C.sb.from('users').select('id, first_name').in('id', uids); (us || []).forEach(u => { um[u.id] = u.first_name }) }
      const nm = {}; (cps || []).forEach(c => { nm[c.id] = [um[c.user_id], c.partner_name].filter(Boolean).join(' & ') })
      sheets.forEach(x => { x._name = nm[x.couple_id] || ''; x._title = x._name ? wedTitle(x._name) : (x.title && !/^our wedding day$/i.test(x.title) ? x.title : 'Wedding Day') })
    }
  } catch (e) { clear(host); host.appendChild(h('div', { class: 'empty' }, h('h2', { class: 'h3' }, 'Could not load runsheets'), h('p', null, C.err(e)))); return }

  if (!sheets.length) {
    clear(host)
    host.appendChild(h('div', { class: 'empty' }, h('h2', { class: 'h3' }, 'No runsheets yet'), h('p', null, 'When a couple books you, their runsheet appears here.')))
    return
  }
  const t = new Date().toISOString().slice(0, 10)
  const wanted = parts[0]
  let cur = sheets.find(x => x.couple_id === wanted) || sheets.find(x => (x.wedding_date || '9999') >= t) || sheets[0]

  const paint = async () => {
    clear(host)
    const canEdit = !!editMap[cur.id]
    if (sheets.length > 1) {
      host.appendChild(h('div', { class: 'eyebrow', style: { marginBottom: '8px' } }, 'Your weddings'))
      host.appendChild(h('div', { class: 'chips', style: { marginBottom: '18px' } }, sheets.map(x =>
        h('button', { class: 'chip' + (x.id === cur.id ? ' on' : ''), type: 'button', onclick: () => { cur = x; paint() } },
          (x._name || x._title) + (x.wedding_date ? '  ·  ' + fmtDate(x.wedding_date) : '')))))
    }
    const body = h('div'); host.appendChild(body)
    body.appendChild(h('div', { class: 'spin' }))
    let items = [], parts2 = []
    try {
      const [it, pa] = await Promise.all([
        C.sb.from('runsheet_items').select('*, vendor:vendor_id(business_name)').eq('runsheet_id', cur.id).order('sort_order').order('time_start'),
        C.sb.from('runsheet_participants').select('role, vendor_id, vendor:vendor_id(business_name)').eq('runsheet_id', cur.id),
      ])
      if (it.error) throw it.error
      items = (it.data || []).slice().sort(bySchedule); parts2 = pa.data || []; cur._parts = parts2
    } catch (e) { clear(body); body.appendChild(h('p', { class: 'muted' }, C.err(e))); return }
    clear(body)
    body.appendChild(h('div', { class: 'rs-head' }, h('img', { class: 'rs-logo', src: LOGO, alt: 'Aisle Match' }),
      h('div', null, h('div', { class: 'eyebrow' }, 'Wedding day run sheet'), h('h2', { class: 'rs-name' }, cur._title), cur.wedding_date ? h('p', { class: 'muted', style: { margin: '2px 0 0' } }, fmtDate(cur.wedding_date)) : null)))
    const kv = []
    const add = (k, v) => { if (v) kv.push(h('div', null, h('span', { class: 'k' }, k), h('span', { class: 'v' }, v))) }
    add('Ceremony', [cur.ceremony_venue, cur.ceremony_address].filter(Boolean).join(', '))
    add('Reception', [cur.reception_venue, cur.reception_address].filter(Boolean).join(', '))
    add('Emergency contact', [cur.emergency_contact_name, cur.emergency_contact_phone].filter(Boolean).join('  '))
    add('Notes', cur.notes)
    if (kv.length) body.appendChild(h('div', { class: 'kv' }, kv))
    body.appendChild(h('div', { class: 'sp16' }))
    if (canEdit) body.appendChild(h('div', { class: 'note' }, h('b', null, 'You can edit this runsheet. '), 'Changes show for the couple and every vendor straight away.'), h('div', { class: 'sp16' }))
    body.appendChild(h('div', { class: 'actions' },
      canEdit ? h('button', { class: 'btn sm', onclick: () => itemSheet(null) }, '+ Add item') : null,
      canEdit ? h('button', { class: 'btn ghost sm', onclick: () => detailsSheet() }, 'Edit details') : null,
      h('button', { class: 'btn ghost sm', onclick: () => C.go('leads/' + cur.couple_id) }, 'Open couple'),
      h('button', { class: 'btn ghost sm', onclick: () => {
        const w = window.open('', '_blank'); if (!w) { C.toast('Allow pop-ups to print', true); return }
        w.document.open(); w.document.write(sheetHtml(cur, cur._title, items, parts2)); w.document.close(); w.focus(); setTimeout(() => { try { w.print() } catch (e) { /* manual */ } }, 350)
      } }, 'Print / save as PDF')))
    if (!items.length) { body.appendChild(h('div', { class: 'empty' }, h('p', null, canEdit ? 'Nothing on the timeline yet. Tap Add item to start.' : 'The couple has not added timeline items yet.'))); return }
    body.appendChild(h('div', { class: 'list', style: { marginTop: '14px' } }, items.map(i =>
      h(canEdit ? 'button' : 'div', { class: 'item', style: i.is_buffer ? { opacity: .6 } : null, onclick: canEdit ? () => itemSheet(i) : null },
        h('div', { class: 'meta', style: { minWidth: '88px', textAlign: 'left' } }, h('div', { style: { fontWeight: 500 } }, tm(i.time_start) || '–'), i.time_end ? h('div', null, tm(i.time_end)) : null),
        h('div', { class: 'body' }, h('div', { class: 't' }, i.title),
          h('div', { class: 's', style: { whiteSpace: 'normal' } }, [typeLabel(i.item_type), i.description, i.location, (i.vendor && i.vendor.business_name) || i.responsible_party].filter(Boolean).join('  ·  ')))))))
    if (parts2.length) body.appendChild(h('p', { class: 'muted small', style: { marginTop: '14px' } }, 'On this wedding: ' + parts2.map(p => p.vendor && p.vendor.business_name).filter(Boolean).join(', ')))
  }
  paint()
  /* ---------- editing (planners / anyone with edit access) ---------- */
  const itemSheet = (item) => {
    const it = item || {}
    const title = h('input', { class: 'input', placeholder: 'e.g. Ceremony begins', value: it.title || '' })
    const type = h('select', { class: 'select' }, TYPES.map(t => h('option', { value: t[0] }, t[1])))
    type.value = it.item_type || 'other'
    const t1 = h('input', { class: 'input', type: 'time', value: tm(it.time_start) })
    const t2 = h('input', { class: 'input', type: 'time', value: tm(it.time_end) })
    const loc = h('input', { class: 'input', placeholder: 'Where', value: it.location || '' })
    const desc = h('textarea', { class: 'textarea', placeholder: 'Details everyone should know' }, it.description || '')
    const who = h('input', { class: 'input', placeholder: 'Who is responsible (optional)', value: it.responsible_party || '' })
    const vsel = h('select', { class: 'select' }, h('option', { value: '' }, 'No specific vendor'),
      cur._parts.filter(p => p.vendor_id).map(p => h('option', { value: p.vendor_id }, (p.vendor && p.vendor.business_name) || 'Vendor')))
    vsel.value = it.vendor_id || ''
    let buffer = !!it.is_buffer
    const buf = toggle(buffer, v => { buffer = v }, 'Buffer time')
    const err = h('div', { style: { color: 'var(--bad)', fontSize: '14px' } })
    const save = h('button', { class: 'btn' }, 'Save')
    let armed = false
    const del = it.id ? h('button', { class: 'btn danger', onclick: async (e) => {
      if (!armed) { armed = true; e.currentTarget.textContent = 'Tap again to remove'; return }
      const { error } = await C.sb.from('runsheet_items').delete().eq('id', it.id)
      if (error) { err.textContent = C.err(error); return }
      s.close(); C.toast('Removed'); paint()
    } }, 'Remove') : null
    const s = C.sheet({ title: it.id ? 'Edit item' : 'Add item',
      body: h('div', null, field('What happens', title), field('Category', type), h('div', { class: 'row2' }, field('Starts', t1), field('Ends', t2)), field('Location', loc),
        field('Details', desc), field('Responsible', who), field('Vendor', vsel),
        h('div', { class: 'pill-row' }, h('div', null, h('div', { class: 'l1' }, 'Buffer time'), h('div', { class: 'l2' }, 'Spare time that can absorb delays.')), buf), err),
      footer: [del, h('button', { class: 'btn ghost', onclick: () => s.close() }, 'Cancel'), save].filter(Boolean) })
    save.addEventListener('click', async () => {
      err.textContent = ''
      if (!title.value.trim()) { err.textContent = 'Give the item a title.'; return }
      save.disabled = true; save.textContent = 'Saving'
      const payload = { runsheet_id: cur.id, title: title.value.trim(), item_type: type.value, time_start: t1.value || null, time_end: t2.value || null,
        location: loc.value.trim() || null, description: desc.value.trim() || null, responsible_party: who.value.trim() || null, vendor_id: vsel.value || null,
        is_buffer: buffer, sort_order: it.sort_order == null ? 999 : it.sort_order }
      const q = it.id ? C.sb.from('runsheet_items').update(payload).eq('id', it.id) : C.sb.from('runsheet_items').insert(payload)
      const { error } = await q
      if (error) { save.disabled = false; save.textContent = 'Save'; err.textContent = C.err(error); return }
      s.close(); C.toast('Saved'); paint()
    })
  }

  const detailsSheet = () => {
    const f = (k, ph) => h('input', { class: 'input', placeholder: ph || '', value: cur[k] || '' })
    const cv = f('ceremony_venue', 'Ceremony venue'), ca = f('ceremony_address', 'Ceremony address'), rv = f('reception_venue', 'Reception venue'), ra = f('reception_address', 'Reception address')
    const en = f('emergency_contact_name', 'Name'), ep = f('emergency_contact_phone', 'Phone')
    const notes = h('textarea', { class: 'textarea', placeholder: 'Notes for everyone on the day' }, cur.notes || '')
    const err = h('div', { style: { color: 'var(--bad)', fontSize: '14px' } })
    const save = h('button', { class: 'btn' }, 'Save')
    const s = C.sheet({ title: 'Runsheet details', body: h('div', null, field('Ceremony venue', cv), field('Ceremony address', ca), field('Reception venue', rv), field('Reception address', ra),
      h('div', { class: 'row2' }, field('Emergency contact', en), field('Phone', ep)), field('Notes', notes), err),
      footer: [h('button', { class: 'btn ghost', onclick: () => s.close() }, 'Cancel'), save] })
    save.addEventListener('click', async () => {
      save.disabled = true; save.textContent = 'Saving'
      const patch = { ceremony_venue: cv.value.trim() || null, ceremony_address: ca.value.trim() || null, reception_venue: rv.value.trim() || null, reception_address: ra.value.trim() || null,
        emergency_contact_name: en.value.trim() || null, emergency_contact_phone: ep.value.trim() || null, notes: notes.value.trim() || null }
      const { error } = await C.sb.from('runsheets').update(patch).eq('id', cur.id)
      if (error) { save.disabled = false; save.textContent = 'Save'; err.textContent = C.err(error); return }
      Object.assign(cur, patch); s.close(); C.toast('Saved'); paint()
    })
  }

  // live: anything the couple or another planner changes appears here
  const listen = () => {
    try {
      chan = C.sb.channel('rs:' + vid)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'runsheet_items' }, (p) => {
          const id = (p.new && p.new.runsheet_id) || (p.old && p.old.runsheet_id)
          if (!id || id === cur.id) { if (!document.activeElement || !host.contains(document.activeElement)) paint() }
        })
        .subscribe()
    } catch (e) { /* live updates are a nice-to-have */ }
  }
  listen()
  return () => { try { if (chan) C.sb.removeChannel(chan) } catch (e) { /* ignore */ } }
}
