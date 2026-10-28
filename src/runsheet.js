import { h, clear, icon, fmtDate, LOGO } from './lib.js'

const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
const tm = (t) => (t ? String(t).slice(0, 5) : '')

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
  try {
    const { data: pr, error } = await C.sb.from('runsheet_participants').select('runsheet_id').eq('vendor_id', vid)
    if (error) throw error
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
      sheets.forEach(x => { x._name = nm[x.couple_id] || x.title || 'Wedding' })
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
    if (sheets.length > 1) {
      host.appendChild(h('div', { class: 'eyebrow', style: { marginBottom: '8px' } }, 'Your weddings'))
      host.appendChild(h('div', { class: 'chips', style: { marginBottom: '18px' } }, sheets.map(x =>
        h('button', { class: 'chip' + (x.id === cur.id ? ' on' : ''), type: 'button', onclick: () => { cur = x; paint() } },
          x._name + (x.wedding_date ? '  ·  ' + fmtDate(x.wedding_date) : '')))))
    }
    const body = h('div'); host.appendChild(body)
    body.appendChild(h('div', { class: 'spin' }))
    let items = [], parts2 = []
    try {
      const [it, pa] = await Promise.all([
        C.sb.from('runsheet_items').select('*, vendor:vendor_id(business_name)').eq('runsheet_id', cur.id).order('sort_order').order('time_start'),
        C.sb.from('runsheet_participants').select('role, vendor:vendor_id(business_name)').eq('runsheet_id', cur.id),
      ])
      if (it.error) throw it.error
      items = it.data || []; parts2 = pa.data || []
    } catch (e) { clear(body); body.appendChild(h('p', { class: 'muted' }, C.err(e))); return }
    clear(body)
    body.appendChild(h('div', { class: 'rs-head' }, h('img', { class: 'rs-logo', src: LOGO, alt: 'Aisle Match' }),
      h('div', null, h('div', { class: 'eyebrow' }, 'Wedding day run sheet'), h('h2', { class: 'rs-name' }, cur._name), cur.wedding_date ? h('p', { class: 'muted', style: { margin: '2px 0 0' } }, fmtDate(cur.wedding_date)) : null)))
    const kv = []
    const add = (k, v) => { if (v) kv.push(h('div', null, h('span', { class: 'k' }, k), h('span', { class: 'v' }, v))) }
    add('Ceremony', [cur.ceremony_venue, cur.ceremony_address].filter(Boolean).join(', '))
    add('Reception', [cur.reception_venue, cur.reception_address].filter(Boolean).join(', '))
    add('Emergency contact', [cur.emergency_contact_name, cur.emergency_contact_phone].filter(Boolean).join('  '))
    add('Notes', cur.notes)
    if (kv.length) body.appendChild(h('div', { class: 'kv' }, kv))
    body.appendChild(h('div', { class: 'sp16' }))
    body.appendChild(h('div', { class: 'actions' },
      h('button', { class: 'btn ghost sm', onclick: () => C.go('leads/' + cur.couple_id) }, 'Open couple'),
      h('button', { class: 'btn ghost sm', onclick: () => {
        const w = window.open('', '_blank'); if (!w) { C.toast('Allow pop-ups to print', true); return }
        w.document.open(); w.document.write(sheetHtml(cur, cur._name, items, parts2)); w.document.close(); w.focus(); setTimeout(() => { try { w.print() } catch (e) { /* manual */ } }, 350)
      } }, 'Print / save as PDF')))
    if (!items.length) { body.appendChild(h('div', { class: 'empty' }, h('p', null, 'The couple has not added timeline items yet.'))); return }
    body.appendChild(h('div', { class: 'list', style: { marginTop: '14px' } }, items.map(i =>
      h('div', { class: 'item', style: i.is_buffer ? { opacity: .6 } : null },
        h('div', { class: 'meta', style: { minWidth: '88px', textAlign: 'left' } }, h('div', { style: { fontWeight: 500 } }, tm(i.time_start) || '–'), i.time_end ? h('div', null, tm(i.time_end)) : null),
        h('div', { class: 'body' }, h('div', { class: 't' }, i.title),
          h('div', { class: 's', style: { whiteSpace: 'normal' } }, [i.description, i.location, (i.vendor && i.vendor.business_name) || i.responsible_party].filter(Boolean).join('  ·  ')))))))
    if (parts2.length) body.appendChild(h('p', { class: 'muted small', style: { marginTop: '14px' } }, 'On this wedding: ' + parts2.map(p => p.vendor && p.vendor.business_name).filter(Boolean).join(', ')))
  }
  paint()
}
