import { h, clear, field, fmtMoney } from './lib.js'

const MAX_PKGS = 5

export async function renderPackages(C, view) {
  view.appendChild(h('div', { class: 'pagehead' }, h('div', { class: 'eyebrow' }, 'Pricing'), h('h1', { class: 'h1' }, 'Packages'),
    h('p', null, 'Up to five packages, shown to couples when they view your profile.')))
  const host = h('div'); view.appendChild(host)
  host.appendChild(h('div', { class: 'spin' }))
  let pkgs = []
  const load = async () => {
    const { data, error } = await C.sb.from('vendor_packages').select('*').eq('vendor_id', C.vendor.id).eq('is_active', true).order('sort_order')
    if (error) throw error
    pkgs = data || []
  }
  try { await load() } catch (e) { clear(host); host.appendChild(h('div', { class: 'empty' }, h('h2', { class: 'h3' }, 'Could not load packages'), h('p', null, C.err(e)))); return }

  const draw = () => {
    clear(host)
    host.appendChild(h('div', { class: 'actions', style: { marginBottom: '8px' } },
      pkgs.length < MAX_PKGS ? h('button', { class: 'btn', onclick: () => edit(null) }, 'Add a package') : h('span', { class: 'muted small' }, 'You have used all ' + MAX_PKGS + ' packages.')))
    if (!pkgs.length) {
      host.appendChild(h('div', { class: 'empty' }, h('h2', { class: 'h3' }, 'No packages yet'), h('p', null, 'Couples compare prices before they enquire. A clear package or two makes a real difference.')))
      return
    }
    pkgs.forEach((p, i) => {
      const dep = p.deposit_type && p.deposit_type !== 'none' && p.deposit_value ? (p.deposit_type === 'percent' ? p.deposit_value + '% deposit' : fmtMoney(p.deposit_value) + ' deposit') : ''
      host.appendChild(h('div', { class: 'pkg' },
        h('div', { class: 'body' },
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, h('div', { class: 'nm' }, p.name), p.is_most_popular ? h('span', { class: 'tag' }, 'Most popular') : null),
          h('div', { class: 'pr' }, p.price != null ? fmtMoney(p.price) + (p.price_label ? '  ·  ' + p.price_label : '') : (p.price_label || 'Price on application')),
          p.description ? h('p', { class: 'muted small', style: { marginTop: '8px', whiteSpace: 'pre-wrap' } }, p.description) : null,
          h('div', { class: 'tiny', style: { marginTop: '8px' } }, [p.duration_hours ? p.duration_hours + ' hours' : '', p.max_guests ? 'Up to ' + p.max_guests + ' guests' : '', dep].filter(Boolean).join('  ·  '))),
        h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' } },
          h('button', { class: 'linkbtn', onclick: () => edit(p) }, 'Edit'),
          i > 0 ? h('button', { class: 'linkbtn', onclick: () => move(i, -1) }, 'Move up') : null)))
    })
  }

  const move = async (i, dir) => {
    const a = pkgs[i], b = pkgs[i + dir]; if (!a || !b) return
    const ra = await C.sb.from('vendor_packages').update({ sort_order: i + dir }).eq('id', a.id)
    const rb = await C.sb.from('vendor_packages').update({ sort_order: i }).eq('id', b.id)
    if (ra.error || rb.error) { C.toast(C.err(ra.error || rb.error), true); return }
    try { await load(); draw() } catch (e) { C.toast(C.err(e), true) }
  }

  const edit = (p) => {
    const isNew = !p
    const name = h('input', { class: 'input', type: 'text', maxlength: '60', value: p ? p.name : '', placeholder: 'For example, Full day coverage' })
    const price = h('input', { class: 'input', type: 'number', inputmode: 'decimal', min: '0', step: '1', value: p && p.price != null ? p.price : '', placeholder: '0' })
    const label = h('input', { class: 'input', type: 'text', maxlength: '40', value: p ? (p.price_label || '') : '', placeholder: 'From, POA, or contact us' })
    const desc = h('textarea', { class: 'textarea', style: { minHeight: '150px' }, maxlength: '600', placeholder: 'List everything included. Couples read this carefully before enquiring.' }, p ? (p.description || '') : '')
    const hours = h('input', { class: 'input', type: 'number', inputmode: 'decimal', min: '0', step: '0.5', value: p && p.duration_hours != null ? p.duration_hours : '' })
    const guests = h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: '0', value: p && p.max_guests != null ? p.max_guests : '' })
    const dtype = h('select', { class: 'select' }, h('option', { value: 'none' }, 'No deposit'), h('option', { value: 'percent' }, 'Percentage of price'), h('option', { value: 'flat' }, 'Fixed amount'))
    dtype.value = (p && p.deposit_type) || 'none'
    const dval = h('input', { class: 'input', type: 'number', inputmode: 'decimal', min: '0', step: '1', value: p && p.deposit_value != null ? p.deposit_value : '' })
    const dwrap = field('Deposit amount', dval)
    const syncDep = () => dwrap.classList.toggle('hidden', dtype.value === 'none')
    dtype.addEventListener('change', syncDep); syncDep()
    const pop = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!(p && p.is_most_popular) }), h('span', null, 'Mark as most popular'))
    const err = h('div', { style: { color: 'var(--bad)', fontSize: '14px', marginTop: '8px' } })
    const saveBtn = h('button', { class: 'btn' }, isNew ? 'Add package' : 'Save changes')
    const s = C.sheet({ title: isNew ? 'New package' : 'Edit package',
      body: h('div', null, field('Package name', name), h('div', { class: 'row2' }, field('Price (AUD)', price), field('Price note', label)), field('What is included', desc),
        h('div', { class: 'row2' }, field('Hours of service', hours), field('Max guests', guests)), field('Deposit', dtype), dwrap, pop, err,
        !isNew ? h('div', null, h('div', { class: 'sp16' }), h('button', { class: 'linkbtn bad', onclick: async () => {
          const { error } = await C.sb.from('vendor_packages').update({ is_active: false }).eq('id', p.id)
          if (error) { err.textContent = C.err(error); return }
          s.close(); C.toast('Package removed'); await load(); draw()
        } }, 'Remove this package')) : null),
      footer: [h('button', { class: 'btn ghost', onclick: () => s.close() }, 'Cancel'), saveBtn] })
    saveBtn.addEventListener('click', async () => {
      err.textContent = ''
      if (!name.value.trim()) { err.textContent = 'Give the package a name.'; return }
      const num = (el) => el.value === '' ? null : Number(el.value)
      if ([price, hours, guests, dval].some(el => el.value !== '' && (isNaN(Number(el.value)) || Number(el.value) < 0))) { err.textContent = 'Check the numbers. They cannot be negative.'; return }
      if (dtype.value === 'percent' && num(dval) > 100) { err.textContent = 'A percentage deposit cannot be over 100.'; return }
      const payload = { vendor_id: C.vendor.id, is_active: true, name: name.value.trim(), price: num(price), price_label: label.value.trim() || null, description: desc.value.trim() || null,
        duration_hours: num(hours), max_guests: num(guests), deposit_type: dtype.value, deposit_value: dtype.value === 'none' ? null : num(dval), is_most_popular: pop.querySelector('input').checked }
      saveBtn.disabled = true
      const r = isNew ? await C.sb.from('vendor_packages').insert({ ...payload, sort_order: pkgs.length }) : await C.sb.from('vendor_packages').update(payload).eq('id', p.id)
      if (r.error) { saveBtn.disabled = false; err.textContent = C.err(r.error); return }
      s.close(); C.toast(isNew ? 'Package added' : 'Package saved'); try { await load(); draw() } catch (e) { C.toast(C.err(e), true) }
    })
  }
  draw()
}
