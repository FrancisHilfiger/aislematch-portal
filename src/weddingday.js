import { h, clear, field } from './lib.js'

const SECTIONS = [
  ['wd_ceremony', 'Ceremony & photos'],
  ['wd_story', 'Your story'],
  ['wd_day', 'Your day'],
  ['wd_people', 'People & places'],
]
const EXTRA = 'wd_extra'
const GROUPS = SECTIONS.map(s => s[0]).concat([EXTRA])

const txt = (a) => (a === null || a === undefined ? '' : Array.isArray(a) ? a.join(', ') : String(a))
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')

function buildHtml(name, sections, word) {
  const body = sections.map(s => '<h2>' + esc(s.title) + '</h2>' + s.rows.map(r => '<div class="q">' + esc(r.q) + '</div><div class="a">' + esc(r.a) + '</div>').join('')).join('')
  const date = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  return '<!DOCTYPE html><html' + (word ? ' xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"' : '') + '><head><meta charset="utf-8"><title>Wedding day questionnaire</title><style>' +
    "body{font-family:Georgia,'Times New Roman',serif;color:#352219;margin:32px;line-height:1.5}h1{font-size:28px;margin:0 0 4px}.sub{font-family:Arial,sans-serif;font-size:12px;color:#6b5c52;margin-bottom:24px}" +
    'h2{font-size:19px;border-bottom:1px solid #c8d6de;padding-bottom:4px;margin-top:28px}.q{font-family:Arial,sans-serif;font-size:11px;color:#6b5c52;margin-top:12px}.a{font-size:14px;margin-top:2px}' +
    '</style></head><body><h1>' + esc(name) + '</h1><div class="sub">Wedding day questionnaire · ' + esc(date) + ' · Aisle Match</div>' + (body || '<p>No answers yet.</p>') + '</body></html>'
}
const safe = (s) => String(s || 'wedding').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'wedding'

export function downloadWord(name, sections) {
  const blob = new Blob(['﻿', buildHtml(name, sections, true)], { type: 'application/msword' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = safe(name) + '-questionnaire.doc'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
export function printPdf(name, sections) {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.open(); w.document.write(buildHtml(name, sections, false)); w.document.close()
  w.focus(); setTimeout(() => { try { w.print() } catch (e) { /* user can print manually */ } }, 350)
  return true
}

export function openWeddingDay(C, lead, names) {
  const body = h('div', null, h('div', { class: 'spin' }))
  const s = C.sheet({ title: 'Wedding day questionnaire', body })
  const vid = C.vendor.id
  let questions = [], answers = {}, vendorNames = {}, booked = !!lead.isBooked

  const sections = () => {
    const out = []
    SECTIONS.forEach(([k, title]) => {
      const rows = questions.filter(q => q.group_key === k).sort((a, b) => a.sort - b.sort).map(q => ({ q: q.label, a: txt(answers[q.key]) })).filter(r => r.a.trim())
      if (rows.length) out.push({ title, rows })
    })
    const ex = questions.filter(q => q.group_key === EXTRA).map(q => ({ q: q.label + (q.added_by_vendor_id && vendorNames[q.added_by_vendor_id] ? ' (asked by ' + vendorNames[q.added_by_vendor_id] + ')' : ''), a: txt(answers[q.key]) })).filter(r => r.a.trim())
    if (ex.length) out.push({ title: 'Questions from vendors', rows: ex })
    return out
  }

  const paint = () => {
    clear(body)
    const total = questions.length
    const done = questions.filter(q => txt(answers[q.key]).trim()).length
    body.appendChild(h('p', { class: 'muted small' }, done + ' of ' + total + ' answered by the couple.' + (booked ? '' : ' Mobile numbers, family details and worries unlock once they book you.')))
    SECTIONS.forEach(([k, title]) => {
      const qs = questions.filter(q => q.group_key === k).sort((a, b) => a.sort - b.sort)
      const ans = qs.filter(q => txt(answers[q.key]).trim())
      const locked = !booked && qs.some(q => q.visibility === 'booked')
      if (!ans.length && !locked) return
      body.appendChild(h('div', { class: 'panel', style: { marginTop: '12px' } }, h('div', { class: 'h3' }, title),
        ans.map(q => h('div', { class: 'a', style: { marginTop: '10px' } }, h('div', { class: 'q' }, q.label), h('div', { class: 'r' }, txt(answers[q.key])))),
        !ans.length ? h('p', { class: 'muted small' }, 'Nothing shared yet.') : null,
        locked ? h('p', { class: 'muted small' }, 'Some answers in this section are only shared with booked vendors.') : null))
    })
    const ex = questions.filter(q => q.group_key === EXTRA)
    if (ex.length) body.appendChild(h('div', { class: 'panel', style: { marginTop: '12px' } }, h('div', { class: 'h3' }, 'Questions from vendors'),
      ex.map(q => h('div', { class: 'a', style: { marginTop: '10px' } },
        h('div', { class: 'q' }, q.label + (q.added_by_vendor_id && vendorNames[q.added_by_vendor_id] ? '  ·  ' + vendorNames[q.added_by_vendor_id] : '')),
        h('div', { class: 'r' }, txt(answers[q.key]) || 'Not answered yet'),
        q.added_by_vendor_id === vid ? h('button', { class: 'linkbtn bad', onclick: async () => {
          const { error } = await C.sb.from('questionnaire_questions').delete().eq('key', q.key)
          if (error) { C.toast(C.err(error), true); return }
          questions = questions.filter(x => x.key !== q.key); paint()
        } }, 'Remove my question') : null))))

    const nq = h('textarea', { class: 'textarea', maxlength: '300', placeholder: 'Type your question' })
    const send = h('button', { class: 'btn sm' }, 'Send question')
    send.addEventListener('click', async () => {
      const label = nq.value.trim(); if (!label) return
      send.disabled = true
      const key = 'x_' + vid.slice(0, 8) + '_' + Date.now().toString(36)
      const { data, error } = await C.sb.from('questionnaire_questions').insert({ key, group_key: EXTRA, label, type: 'text', options: [], sort: 0, couple_id: lead.coupleId, added_by_vendor_id: vid, vendor_visible: true, visibility: 'matched' }).select('*').single()
      if (error) { send.disabled = false; C.toast(C.err(error), true); return }
      vendorNames[vid] = C.vendor.business_name
      questions.push(data); C.toast('Question sent. The couple has been notified.'); paint()
    })
    body.appendChild(h('div', { class: 'panel', style: { marginTop: '12px' } }, h('div', { class: 'h3' }, 'Ask them something'),
      h('p', { class: 'muted small' }, 'The couple is notified and answers in their questionnaire. Other vendors can see it too.'), field('Your question', nq), h('div', { class: 'sp8' }), send))

    const secs = sections()
    body.appendChild(h('div', { class: 'actions', style: { marginTop: '16px' } },
      h('button', { class: 'btn ghost sm', onclick: () => { if (!secs.length) { C.toast('Nothing to download yet'); return } downloadWord(names, secs) } }, 'Download Word'),
      h('button', { class: 'btn ghost sm', onclick: () => { if (!secs.length) { C.toast('Nothing to download yet'); return } if (!printPdf(names, secs)) C.toast('Allow pop-ups to save a PDF', true) } }, 'Save as PDF')))
  }

  ;(async () => {
    try {
      const [qs, ans, m] = await Promise.all([
        C.sb.from('questionnaire_questions').select('*').in('group_key', GROUPS).order('sort'),
        C.sb.from('couple_answers').select('question_key, answer').eq('couple_id', lead.coupleId),
        C.sb.from('matches').select('is_booked').eq('couple_id', lead.coupleId).eq('vendor_id', vid).maybeSingle(),
      ])
      if (qs.error) throw qs.error
      questions = (qs.data || []).filter(q => !q.couple_id || q.couple_id === lead.coupleId)
      ;(ans.data || []).forEach(a => { answers[a.question_key] = a.answer })
      booked = !!(m.data && m.data.is_booked)
      const vids = [...new Set(questions.map(q => q.added_by_vendor_id).filter(Boolean))]
      if (vids.length) { const { data: vs } = await C.sb.from('vendor_profiles').select('id, business_name').in('id', vids); (vs || []).forEach(v => { vendorNames[v.id] = v.business_name }) }
      paint()
    } catch (e) { clear(body); body.appendChild(h('p', { class: 'muted' }, C.err(e))) }
  })()
  return s
}
