import { h, clear, fmtDate, initial } from './lib.js'

function stars(n) {
  const v = Math.max(0, Math.min(5, Math.round(n || 0)))
  return h('span', { class: 'small', 'aria-label': v + ' out of 5', style: { letterSpacing: '2px' } }, '\u2605'.repeat(v) + '\u2606'.repeat(5 - v))
}

export async function renderReviews(C, view) {
  view.appendChild(h('div', { class: 'pagehead' }, h('div', { class: 'eyebrow' }, 'Reputation'), h('h1', { class: 'h1' }, 'Reviews'),
    h('p', null, 'What couples have said about working with you. A thoughtful reply shows up under their review.')))
  const host = h('div'); view.appendChild(host)
  host.appendChild(h('div', { class: 'spin' }))
  const { data, error } = await C.sb.from('reviews')
    .select('id, overall_rating, title, body, vendor_reply, vendor_reply_at, is_verified, created_at, couples(partner_name, users(first_name, last_name))')
    .eq('vendor_id', C.vendor.id).eq('is_published', true).order('created_at', { ascending: false }).limit(50)
  clear(host)
  if (error) { host.appendChild(h('div', { class: 'empty' }, h('h2', { class: 'h3' }, 'Could not load reviews'), h('p', null, C.err(error)))); return }
  const rows = data || []
  if (!rows.length) { host.appendChild(h('div', { class: 'empty' }, h('h2', { class: 'h3' }, 'No reviews yet'), h('p', null, 'Reviews from couples appear here once their wedding is complete.'))); return }
  const avg = rows.reduce((a, r) => a + (r.overall_rating || 0), 0) / rows.length
  host.appendChild(h('div', { class: 'stats', style: { gridTemplateColumns: '1fr 1fr', marginBottom: '8px' } },
    h('div', { class: 'stat' }, h('div', { class: 'n' }, avg.toFixed(1)), h('div', { class: 'l' }, 'Average rating')),
    h('div', { class: 'stat' }, h('div', { class: 'n' }, String(rows.length)), h('div', { class: 'l' }, 'Reviews'))))
  const list = h('div'); host.appendChild(list)
  const draw = () => {
    clear(list)
    rows.forEach(r => {
      const u = r.couples && r.couples.users
      const name = u && u.first_name ? u.first_name + (u.last_name ? ' ' + u.last_name[0] + '.' : '') : 'A couple'
      const replyBox = h('div')
      const drawReply = () => {
        clear(replyBox)
        if (r.vendor_reply) {
          replyBox.appendChild(h('div', { class: 'note', style: { marginTop: '12px' } }, h('b', null, 'Your reply. '), r.vendor_reply,
            h('div', null, h('button', { class: 'linkbtn', onclick: () => editor() }, 'Edit reply'))))
        } else replyBox.appendChild(h('button', { class: 'btn ghost sm', style: { marginTop: '12px' }, onclick: () => editor() }, 'Reply'))
      }
      const editor = () => {
        clear(replyBox)
        const ta = h('textarea', { class: 'textarea', maxlength: '800', placeholder: 'Thank them, and keep it warm and genuine.' }, r.vendor_reply || '')
        const save = h('button', { class: 'btn sm' }, 'Post reply')
        save.addEventListener('click', async () => {
          if (!ta.value.trim()) { C.toast('Write a reply first.', true); return }
          save.disabled = true
          const { error: e } = await C.sb.from('reviews').update({ vendor_reply: ta.value.trim(), vendor_reply_at: new Date().toISOString() }).eq('id', r.id)
          if (e) { save.disabled = false; C.toast(C.err(e), true); return }
          r.vendor_reply = ta.value.trim(); C.toast('Reply posted'); drawReply()
        })
        replyBox.append(h('div', { class: 'sp8' }), ta, h('div', { class: 'sp8' }), h('div', { class: 'actions' }, save, h('button', { class: 'linkbtn', onclick: drawReply }, 'Cancel')))
      }
      drawReply()
      list.appendChild(h('div', { class: 'pkg', style: { display: 'block' } },
        h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } }, h('div', { class: 'avatar' }, initial(name)),
          h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { style: { fontWeight: 500 } }, name), h('div', { class: 'tiny' }, fmtDate(r.created_at) + (r.is_verified ? '  \u00b7  Verified booking' : ''))),
          stars(r.overall_rating)),
        r.title ? h('div', { class: 'h3', style: { marginTop: '12px' } }, r.title) : null,
        r.body ? h('p', { style: { marginTop: '6px', whiteSpace: 'pre-wrap' } }, r.body) : null,
        replyBox))
    })
  }
  draw()
}
