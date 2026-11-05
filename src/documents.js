import { h, clear, field, fmtDate, daysUntil, icon } from './lib.js'

const DOC_TYPES = [
  { key: 'public_liability_insurance', label: 'Public liability insurance', hint: 'Covers third-party injury or property damage at events', expiry: true, rec: true },
  { key: 'professional_indemnity_insurance', label: 'Professional indemnity insurance', hint: 'Covers claims arising from your advice or services', expiry: true },
  { key: 'workers_compensation', label: 'Workers compensation', hint: 'If you employ staff or contractors', expiry: true },
  { key: 'business_registration', label: 'ABN / business registration', hint: 'ABN confirmation or ASIC extract', expiry: false },
  { key: 'celebrant_registration', label: 'Marriage celebrant registration', hint: 'Your Attorney-General\'s Department authorisation', expiry: false, ref: 'Registration number', slugs: ['celebrants'], rec: true },
  { key: 'food_safety', label: 'Food safety certificate', hint: 'Food Safety Supervisor or council registration', expiry: true, slugs: ['catering', 'cake'], rec: true },
  { key: 'rsa', label: 'Responsible Service of Alcohol', hint: 'RSA certificate for anyone serving alcohol', expiry: true, slugs: ['catering', 'venues', 'hens', 'music'] },
  { key: 'liquor_licence', label: 'Liquor licence', hint: 'Venue or caterer liquor licence', expiry: true, slugs: ['venues', 'catering'] },
  { key: 'council_approval', label: 'Council / venue approval', hint: 'Occupancy, event or development approval', expiry: true, slugs: ['venues'] },
  { key: 'drone_licence', label: 'Drone licence (CASA)', hint: 'RePL or ReOC if you fly drones', expiry: true, slugs: ['photographers', 'videographers'] },
  { key: 'vehicle_accreditation', label: 'Vehicle / chauffeur accreditation', hint: 'Passenger transport accreditation and driver authority', expiry: true, ref: 'Accreditation number', slugs: ['cars'], rec: true },
  { key: 'working_with_children', label: 'Working With Children Check', hint: 'Needed for some venues and schools', expiry: true, ref: 'Check number' },
  { key: 'police_check', label: 'Police check', hint: 'National police certificate', expiry: true },
  { key: 'first_aid', label: 'First aid certificate', hint: 'Current first aid / CPR', expiry: true },
  { key: 'qualification', label: 'Qualification or training', hint: 'Diplomas, trade certificates, memberships', expiry: false },
  { key: 'other', label: 'Other document', hint: 'Anything else couples or our team should see', expiry: true },
]
const typeOf = (k) => DOC_TYPES.find((t) => t.key === k)
const MAX = 10 * 1024 * 1024

function health(d) {
  const left = d.expires_on ? daysUntil(d.expires_on + 'T12:00:00') : null
  if (left !== null && left < 0) return ['Expired', 'bad']
  if (d.status === 'rejected') return ['Needs attention', 'bad']
  if (left !== null && left <= 14) return ['Expires in ' + left + ' day' + (left === 1 ? '' : 's'), 'warn']
  if (d.status === 'verified') return ['Verified', 'ok']
  return ['Pending review', '']
}
const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB')

export async function renderDocuments(C, view) {
  view.appendChild(h('div', { class: 'pagehead' }, h('div', { class: 'eyebrow' }, 'Trust'), h('h1', { class: 'h1' }, 'Documents'),
    h('p', null, 'Upload your insurance, licences and certificates. Our team checks each one and reads the expiry date, and couples see a Verified badge on your profile. They never see the file itself.')))
  const host = h('div'); view.appendChild(host)
  host.appendChild(h('div', { class: 'spin' }))
  let docs = [], slug = ''
  const load = async () => {
    const [d, c] = await Promise.all([
      C.sb.from('vendor_documents').select('*').eq('vendor_id', C.vendor.id).order('created_at', { ascending: false }),
      C.sb.from('vendor_category_links').select('categories(slug)').eq('vendor_id', C.vendor.id).limit(1).maybeSingle(),
    ])
    if (d.error) throw d.error
    docs = d.data || []; slug = (c.data && c.data.categories && c.data.categories.slug) || ''
  }
  try { await load() } catch (e) { clear(host); host.appendChild(h('div', { class: 'empty' }, h('h2', { class: 'h3' }, 'Could not load documents'), h('p', null, C.err(e)))); return }

  const open = async (d) => {
    const w = window.open('', '_blank')
    try {
      let url = d.file_url
      if (d.storage_path) {
        const { data, error } = await C.sb.storage.from('vendor-docs').createSignedUrl(d.storage_path, 300)
        if (error || !data) throw error || new Error('No link')
        url = data.signedUrl
      }
      if (w) w.location = url; else location.href = url
    } catch (e) { if (w) w.close(); C.toast('Could not open that file. Try again.', true) }
  }
  const rescan = async (d, btn) => {
    btn.disabled = true; btn.textContent = 'Reading…'
    try { await Promise.race([C.sb.functions.invoke('read-document', { body: { document_id: d.id } }), new Promise((r) => setTimeout(r, 30000))]) } catch (e) {}
    await load(); draw()
  }

  const draw = () => {
    clear(host)
    const relevant = DOC_TYPES.filter((t) => !t.slugs || t.slugs.includes(slug))
    const missing = relevant.filter((t) => t.rec && !docs.some((d) => d.type === t.key))
    const verified = docs.filter((d) => d.status === 'verified').length
    const pending = docs.filter((d) => d.status === 'pending').length
    const attention = docs.filter((d) => { const [, tone] = health(d); return tone === 'bad' || tone === 'warn' }).length
    host.appendChild(h('div', { class: 'dstrip' },
      h('div', { class: 'dstat' }, h('b', null, String(verified)), h('span', null, 'Verified')),
      h('div', { class: 'dstat' }, h('b', null, String(pending)), h('span', null, 'Awaiting review')),
      h('div', { class: 'dstat' + (attention ? ' warn' : '') }, h('b', null, String(attention)), h('span', null, 'Need attention')),
      h('button', { class: 'btn', onclick: () => edit({}) }, icon('upload'), 'Upload document')))

    docs.forEach((d) => {
      const t = typeOf(d.type), [txt, tone] = health(d)
      const needsDate = !d.expires_on && t && t.expiry && d.ai_status && d.ai_status !== 'done'
      const rescanBtn = needsDate ? h('button', { class: 'linkbtn', onclick: (e) => rescan(d, e.target) }, 'Read again') : null
      host.appendChild(h('div', { class: 'dcard' },
        h('div', { class: 'dicon' }, icon('file')),
        h('div', { class: 'dbody' },
          h('div', { class: 'dtop' }, h('div', { class: 'dnm' }, d.label || (t && t.label) || d.type), h('span', { class: 'tag ' + tone }, txt)),
          h('div', { class: 'dmeta' }, [d.reference_no, d.expires_on ? 'Expires ' + fmtDate(d.expires_on) : '', d.file_name].filter(Boolean).join('  ·  ')),
          d.expiry_source === 'ai' ? h('div', { class: 'dnote' }, 'Expiry read from your certificate. Choose Edit if it looks wrong.') : null,
          needsDate ? h('div', { class: 'dnote warn' }, 'We could not read the expiry date. ', rescanBtn, ' or choose Edit to add it yourself.') : null,
          d.status === 'rejected' && d.reject_reason ? h('div', { class: 'dnote bad' }, d.reject_reason) : null),
        h('div', { class: 'dacts' },
          h('button', { class: 'linkbtn', onclick: () => open(d) }, 'View'),
          h('button', { class: 'linkbtn', onclick: () => edit(d) }, d.expires_on && daysUntil(d.expires_on + 'T12:00:00') <= 14 ? 'Renew' : 'Edit'),
          h('button', { class: 'linkbtn bad', onclick: () => remove(d) }, 'Remove'))))
    })
    missing.forEach((t) => host.appendChild(h('div', { class: 'dcard ghost', onclick: () => edit({ type: t.key }) },
      h('div', { class: 'dicon' }, icon('upload')),
      h('div', { class: 'dbody' }, h('div', { class: 'dnm' }, t.label), h('div', { class: 'dmeta' }, t.hint + '  ·  Recommended')),
      h('div', { class: 'dacts' }, h('span', { class: 'linkbtn' }, 'Upload')))))
    if (!docs.length && !missing.length) host.appendChild(h('div', { class: 'empty' }, h('h2', { class: 'h3' }, 'Nothing uploaded yet'), h('p', null, 'Add your insurance to earn a Verified badge.')))
  }

  const remove = async (d) => {
    if (!confirm('Remove "' + (d.label || (typeOf(d.type) || {}).label || 'this document') + '"?')) return
    if (d.storage_path) await C.sb.storage.from('vendor-docs').remove([d.storage_path])
    const { error } = await C.sb.from('vendor_documents').delete().eq('id', d.id)
    if (error) { C.toast(C.err(error), true); return }
    C.toast('Document removed'); await load(); draw()
  }

  const edit = (doc) => {
    const isNew = !doc.id
    const choices = DOC_TYPES.filter((x) => !x.slugs || x.slugs.includes(slug) || x.key === doc.type)
    const sel = h('select', { class: 'select' }, h('option', { value: '' }, 'Choose a type…'), choices.map((x) => h('option', { value: x.key }, x.label)))
    sel.value = doc.type || ''
    const name = h('input', { class: 'input', type: 'text', maxlength: '60', value: doc.label || '', placeholder: 'e.g. Venue floor plan approval' })
    const ref = h('input', { class: 'input', type: 'text', maxlength: '60', value: doc.reference_no || '' })
    const exp = h('input', { class: 'input', type: 'date', value: doc.expires_on || '' })
    const hint = h('div', { class: 'tiny', style: { marginTop: '6px' } })
    const nameF = field('Document name', name), refF = field('Reference number', ref)
    const expF = field('Expiry date', exp, isNew ? 'Leave blank and we will read it from your certificate. We remind you 14 days and 7 days before it runs out.' : 'We remind you 14 days and 7 days before it runs out.')

    // drag and drop file area
    let picked = null
    const input = h('input', { type: 'file', accept: 'application/pdf,image/png,image/jpeg,image/webp', style: { display: 'none' } })
    const dz = h('div', { class: 'dz', tabindex: '0', role: 'button', 'aria-label': 'Choose a file' })
    const paintDz = () => {
      clear(dz); dz.classList.toggle('has', !!picked)
      if (!picked) {
        dz.append(h('div', { class: 'dzicon' }, icon('upload')), h('div', { class: 'dzt' }, 'Drag and drop your file here'),
          h('div', { class: 'dzs' }, 'or ', h('span', { class: 'dzlink' }, 'browse your computer'), '. PDF, JPG or PNG up to 10MB.'))
        if (!isNew && doc.file_name) dz.appendChild(h('div', { class: 'dzs', style: { marginTop: '8px' } }, 'Current file: ' + doc.file_name + '. Leave empty to keep it.'))
      } else {
        dz.append(h('div', { class: 'dzicon ok' }, icon('file')), h('div', { class: 'dzt' }, picked.name), h('div', { class: 'dzs' }, fmtSize(picked.size) + '  ·  ',
          h('button', { class: 'linkbtn', type: 'button', onclick: (e) => { e.stopPropagation(); picked = null; input.value = ''; paintDz() } }, 'Remove')))
      }
    }
    const setFile = (f) => {
      err.textContent = ''
      if (!f) return
      if (!/^(application\/pdf|image\/(png|jpeg|webp))$/.test(f.type)) { err.textContent = 'Please choose a PDF, JPG or PNG.'; return }
      if (f.size > MAX) { err.textContent = 'That file is over 10MB. Please choose a smaller one.'; return }
      picked = f; paintDz()
    }
    dz.addEventListener('click', () => input.click())
    dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click() } })
    input.addEventListener('change', () => setFile(input.files && input.files[0]))
    ;['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over') }))
    ;['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over') }))
    dz.addEventListener('drop', (e) => setFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]))

    const sync = () => { const t = typeOf(sel.value); nameF.classList.toggle('hidden', sel.value !== 'other'); refF.classList.toggle('hidden', !(t && t.ref)); expF.classList.toggle('hidden', !(t && t.expiry)); if (t && t.ref) refF.querySelector('.lbl').textContent = t.ref; hint.textContent = t ? t.hint : '' }
    const err = h('div', { style: { color: 'var(--bad)', fontSize: '14px', marginTop: '10px' } })
    sel.addEventListener('change', sync); sync(); paintDz()
    const save = h('button', { class: 'btn' }, isNew ? 'Upload' : 'Save changes')
    const s = C.sheet({
      title: isNew ? 'Upload a document' : 'Edit document',
      body: h('div', null, field('Type', sel), hint, nameF, refF, expF,
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, isNew ? 'File' : 'Replace file (optional)'), dz, input,
          h('div', { class: 'hint' }, 'Stored privately. Only you and our verification team can open it.')), err),
      footer: [h('button', { class: 'btn ghost', onclick: () => s.close() }, 'Cancel'), save],
    })
    save.addEventListener('click', async () => {
      err.textContent = ''
      const t = typeOf(sel.value)
      if (!t) { err.textContent = 'Choose the type of document.'; return }
      if (t.key === 'other' && !name.value.trim()) { err.textContent = 'Give this document a name.'; return }
      const f = picked
      if (isNew && !f) { err.textContent = 'Add a file to upload.'; return }
      save.disabled = true; save.textContent = f ? 'Uploading…' : 'Saving…'
      try {
        const row = { type: t.key, label: name.value.trim() || t.label, reference_no: ref.value.trim() || null, expires_on: t.expiry ? (exp.value || null) : null }
        if (f) {
          const ext = (f.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '')
          const path = C.user.id + '/' + t.key + '-' + Date.now() + '.' + ext
          const up = await C.sb.storage.from('vendor-docs').upload(path, f, { contentType: f.type || 'application/pdf', upsert: false })
          if (up.error) throw up.error
          if (doc.storage_path) await C.sb.storage.from('vendor-docs').remove([doc.storage_path])
          Object.assign(row, { storage_path: path, file_url: 'storage:' + path, file_name: f.name })
        }
        const r = isNew ? await C.sb.from('vendor_documents').insert({ ...row, vendor_id: C.vendor.id }).select('id').single()
                        : await C.sb.from('vendor_documents').update(row).eq('id', doc.id).select('id').single()
        if (r.error) throw r.error
        let note = ''
        if (f && r.data) {
          save.textContent = 'Reading your certificate…'
          try {
            const res = await Promise.race([C.sb.functions.invoke('read-document', { body: { document_id: r.data.id } }), new Promise((res) => setTimeout(res, 30000))])
            if (res && res.data && res.data.ok === false) note = ' We could not read the expiry date, so please check it.'
          } catch (e) {}
        }
        s.close(); C.toast((isNew ? 'Document uploaded.' : 'Document saved.') + note); await load(); draw()
      } catch (e) { save.disabled = false; save.textContent = isNew ? 'Upload' : 'Save changes'; err.textContent = C.err(e) }
    })
  }
  draw()
}
