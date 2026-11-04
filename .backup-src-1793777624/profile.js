import { h, clear, icon, field, img, initial, toggle } from './lib.js'

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']
const MAX_IMG = 15 * 1024 * 1024
const MAX_VID = 150 * 1024 * 1024

// Unsigned upload straight to Cloudinary, with progress. Same preset and folder as the app.
export function uploadToCloudinary(cfg, file, kind, onProgress) {
  return new Promise((resolve, reject) => {
    if (!cfg.cloudName || !cfg.uploadPreset) { reject(new Error('Uploads are not set up yet.')); return }
    const limit = kind === 'video' ? MAX_VID : MAX_IMG
    if (file.size > limit) { reject(new Error('That file is too large. The limit is ' + Math.round(limit / 1048576) + ' MB.')); return }
    const fd = new FormData()
    fd.append('file', file)
    fd.append('upload_preset', cfg.uploadPreset)
    fd.append('folder', 'aisle_match/vendors')
    const xhr = new XMLHttpRequest()
    xhr.open('POST', 'https://api.cloudinary.com/v1_1/' + cfg.cloudName + '/' + (kind === 'video' ? 'video' : 'image') + '/upload')
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total) }
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'))
    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && j.secure_url) resolve(j.secure_url)
        else reject(new Error((j.error && j.error.message) || 'Upload failed. Please try again.'))
      } catch (e) { reject(new Error('Upload failed. Please try again.')) }
    }
    xhr.send(fd)
  })
}

export function pick(accept, multiple) {
  return new Promise((resolve) => {
    const i = document.createElement('input')
    i.type = 'file'; i.accept = accept; i.multiple = !!multiple
    i.style.display = 'none'
    i.addEventListener('change', () => { resolve(Array.from(i.files || [])); i.remove() })
    i.addEventListener('cancel', () => { resolve([]); i.remove() })
    document.body.appendChild(i)
    i.click()
  })
}

// What a vendor needs before they can go live. Same rules as the app.
export function goLiveChecks(C) {
  const v = C.vendor || {}
  const photos = Array.isArray(v.portfolio_photos) ? v.portfolio_photos.length : 0
  return [
    { key: 'plan', ok: !C.access || C.access.access === 'full', label: 'Your free trial or plan must be active', action: 'Go to billing', route: 'billing' },
    { key: 'name', ok: !!(v.business_name || '').trim(), label: 'Add your business name', action: 'Add it', sec: 'Business' },
    { key: 'tagline', ok: !!(v.tagline || '').trim(), label: 'Write a one-line tagline', action: 'Add it', sec: 'Business' },
    { key: 'bio', ok: !!(v.bio || '').trim(), label: 'Fill in the “About you” section', action: 'Add it', sec: 'Business' },
    { key: 'photos', ok: photos >= 1, label: 'Upload at least one portfolio photo (three or more looks best)', action: 'Add photos', sec: 'photos' },
  ]
}
export function fixCheck(C, c) { if (c.sec) C.jump = c.sec; C.go(c.route || 'profile') }

// Instagram: accepts "@name", "name" or a full link and returns just the handle
const igHandle = (s) => { s = String(s || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^(www\.)?instagram\.com\//i, ''); s = s.split(/[/?#\s]/)[0].replace(/@/g, '').trim(); return s || null }
const fixUrl = (s) => { s = (s || '').trim(); if (!s) return null; return /^https?:\/\//i.test(s) ? s : 'https://' + s }

export async function renderProfile(C, view) {
  let v = C.vendor
  view.appendChild(h('div', { class: 'pagehead' }, h('div', { class: 'eyebrow' }, 'Your listing'), h('h1', { class: 'h1' }, 'Profile'),
    h('p', null, 'This is what couples see when they find you in the app.')))

  const pct = v.profile_completion_pct || 0
  view.appendChild(h('div', null,
    h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, h('span', { class: 'eyebrow' }, 'Profile strength'), h('span', { class: 'small' }, pct + '%')),
    h('div', { class: 'bar' }, h('i', { style: { width: Math.min(100, pct) + '%' } }))))

  const save = async (patch, btn, msg) => {
    if (btn) { btn.disabled = true }
    const { data, error } = await C.sb.from('vendor_profiles').update(patch).eq('id', v.id).select('*').single()
    if (btn) btn.disabled = false
    if (error) { C.toast(C.err(error), true); return false }
    v = data; C.vendor = data
    C.toast(msg || 'Saved'); return true
  }

  /* ---- avatar ---- */
  const avHost = h('div', { class: 'sec' }); view.appendChild(avHost)
  const drawAvatar = (url) => {
    clear(avHost)
    avHost.appendChild(h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'Profile picture')))
    const bar = h('div', { class: 'bar hidden' }, h('i', { style: { width: '0%' } }))
    avHost.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '16px' } },
      h('div', { class: 'avatar lg' }, url ? h('img', { src: img(url, 200), alt: 'Your profile picture' }) : initial(v.business_name)),
      h('div', null, h('button', { class: 'btn ghost sm', onclick: async () => {
        const [f] = await pick('image/*', false); if (!f) return
        bar.classList.remove('hidden')
        try {
          const u = await uploadToCloudinary(C.cfg, f, 'image', p => { bar.firstChild.style.width = Math.round(p * 100) + '%' })
          const { error } = await C.sb.from('users').update({ avatar_url: u }).eq('id', C.user.id)
          if (error) throw error
          C.avatar = u; drawAvatar(u); C.toast('Profile picture updated')
        } catch (e) { bar.classList.add('hidden'); C.toast(C.err(e), true) }
      } }, url ? 'Change picture' : 'Add a picture'), bar)))
  }
  drawAvatar(null)
  C.sb.from('users').select('avatar_url').eq('id', C.user.id).maybeSingle().then(r => { if (r.data && r.data.avatar_url) drawAvatar(r.data.avatar_url) })

  /* ---- photos ---- */
  const phHost = h('div', { class: 'sec' }); view.appendChild(phHost)
  let uploading = null
  const drawPhotos = () => {
    clear(phHost)
    const list = Array.isArray(v.portfolio_photos) ? v.portfolio_photos : []
    phHost.appendChild(h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'Portfolio photos'), h('span', { class: 'tiny' }, list.length + ' added')))
    phHost.appendChild(h('p', { class: 'muted small', style: { marginBottom: '14px' } }, 'The first photo is the one couples see first. Aim for at least six of your best work.'))
    const grid = h('div', { class: 'photos' })
    list.forEach((u, i) => grid.appendChild(h('button', { class: 'ph', style: { padding: 0, border: 0 }, 'aria-label': 'Photo ' + (i + 1) + ' options', onclick: () => photoSheet(u, i) },
      h('img', { src: img(u, 400), alt: 'Portfolio photo ' + (i + 1), loading: 'lazy' }), i === 0 ? h('span', { class: 'cov' }, 'First') : null)))
    grid.appendChild(h('button', { class: 'addph', onclick: addPhotos, disabled: !!uploading }, icon('plus'), uploading ? uploading : 'Add photos'))
    phHost.appendChild(grid)
  }
  const photoSheet = (u, i) => {
    const s = C.sheet({ title: 'Photo ' + (i + 1),
      body: h('img', { src: img(u, 900), alt: '', style: { width: '100%', borderRadius: '10px', display: 'block' } }),
      footer: [
        i > 0 ? h('button', { class: 'btn ghost', onclick: async () => {
          const next = [u, ...v.portfolio_photos.filter((_, k) => k !== i)]
          s.close(); if (await save({ portfolio_photos: next, cover_photo_url: u }, null, 'Moved to the front')) drawPhotos()
        } }, 'Make first') : null,
        h('button', { class: 'btn danger', onclick: async () => {
          const next = v.portfolio_photos.filter((_, k) => k !== i)
          // the cover photo is what couples see first, so it must never point at a photo that was just removed
          const patch = { portfolio_photos: next }
          if (v.cover_photo_url === u || (v.cover_photo_url && !next.includes(v.cover_photo_url))) patch.cover_photo_url = next[0] || null
          s.close(); if (await save(patch, null, 'Photo removed')) drawPhotos()
        } }, 'Remove')] })
  }
  const addPhotos = async () => {
    const files = await pick('image/*', true); if (!files.length) return
    const added = []
    for (let k = 0; k < files.length; k++) {
      uploading = 'Uploading ' + (k + 1) + ' of ' + files.length; drawPhotos()
      try { added.push(await uploadToCloudinary(C.cfg, files[k], 'image')) }
      catch (e) { C.toast(files[k].name + ': ' + C.err(e), true) }
    }
    uploading = null
    if (added.length) await save({ portfolio_photos: [...(v.portfolio_photos || []), ...added], cover_photo_url: v.cover_photo_url || added[0] }, null, added.length + (added.length === 1 ? ' photo added' : ' photos added'))
    drawPhotos()
  }
  drawPhotos()

  /* ---- video ---- */
  const vidHost = h('div', { class: 'sec' }); view.appendChild(vidHost)
  const drawVideo = () => {
    clear(vidHost)
    vidHost.appendChild(h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'Showreel')))
    const bar = h('div', { class: 'bar hidden' }, h('i', { style: { width: '0%' } }))
    if (v.portfolio_video_url) vidHost.appendChild(h('video', { src: v.portfolio_video_url, controls: true, playsinline: true, preload: 'metadata', style: { width: '100%', maxHeight: '360px', background: '#000', borderRadius: '10px', display: 'block', marginBottom: '14px' } }))
    else vidHost.appendChild(h('p', { class: 'muted small', style: { marginBottom: '14px' } }, 'A short video of your work helps couples picture their day with you. Up to 150 MB.'))
    vidHost.appendChild(h('div', { class: 'actions' },
      h('button', { class: 'btn ghost sm', onclick: async () => {
        const [f] = await pick('video/*', false); if (!f) return
        bar.classList.remove('hidden')
        try {
          const u = await uploadToCloudinary(C.cfg, f, 'video', p => { bar.firstChild.style.width = Math.round(p * 100) + '%' })
          await save({ portfolio_video_url: u }, null, 'Video uploaded'); drawVideo()
        } catch (e) { bar.classList.add('hidden'); C.toast(C.err(e), true) }
      } }, v.portfolio_video_url ? 'Replace video' : 'Upload a video'),
      v.portfolio_video_url ? h('button', { class: 'linkbtn bad', onclick: async () => { if (await save({ portfolio_video_url: null }, null, 'Video removed')) drawVideo() } }, 'Remove') : null))
    vidHost.appendChild(bar)
  }
  drawVideo()

  /* ---- details ---- */
  const secs = { photos: phHost }
  const form = (title, build) => { const s = h('div', { class: 'sec' }); secs[title] = s; s.appendChild(h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, title))); build(s); view.appendChild(s) }
  const txt = (val, o) => h('input', { class: 'input', type: 'text', value: val || '', ...(o || {}) })

  form('Business', (s) => {
    const name = txt(v.business_name, { maxlength: '80', autocomplete: 'organization' })
    const tag = txt(v.tagline, { maxlength: '90', placeholder: 'One line that sums you up' })
    const bio = h('textarea', { class: 'textarea', style: { minHeight: '160px' }, maxlength: '1500', placeholder: 'Tell couples who you are and what it is like to work with you.' }, v.bio || '')
    const yrs = txt(v.years_experience != null ? v.years_experience : '', { type: 'number', inputmode: 'numeric', min: '0', max: '80' })
    const abn = txt(v.abn, { inputmode: 'numeric', maxlength: '14', placeholder: '11 digits' })
    const b = h('button', { class: 'btn' }, 'Save business details')
    b.addEventListener('click', async () => {
      if (!name.value.trim()) { C.toast('Your business needs a name.', true); return }
      await save({ business_name: name.value.trim(), tagline: tag.value.trim() || null, bio: bio.value.trim() || null, years_experience: yrs.value === '' ? null : Number(yrs.value) }, b)
    })
    s.append(field('Business name', name), field('Tagline', tag), field('About you', bio), h('div', { class: 'row2' }, field('Years in business', yrs), field('ABN', abn, 'Set in the app. Shown here for reference.')), b)
    abn.disabled = true
  })

  form('Contact and links', (s) => {
    const phone = txt(v.phone_number, { type: 'tel', inputmode: 'tel', autocomplete: 'tel' })
    const web = txt(v.website_url, { inputmode: 'url', autocapitalize: 'none', placeholder: 'yourwebsite.com.au' })
    const igNow = igHandle(v.instagram) || igHandle(v.instagram_url)
    const ig = txt(igNow ? '@' + igNow : '', { autocapitalize: 'none', placeholder: '@yourbusiness' })
    const fb = txt(v.facebook_url, { inputmode: 'url', autocapitalize: 'none' })
    const tt = txt(v.tiktok_url, { inputmode: 'url', autocapitalize: 'none' })
    const b = h('button', { class: 'btn' }, 'Save contact and links')
    b.addEventListener('click', () => save({ phone_number: phone.value.trim() || null, website_url: fixUrl(web.value), instagram: igHandle(ig.value) || '', instagram_url: igHandle(ig.value) ? 'https://instagram.com/' + igHandle(ig.value) : null, facebook_url: fixUrl(fb.value), tiktok_url: fixUrl(tt.value) }, b))
    s.append(field('Phone', phone), field('Website', web), field('Instagram', ig), h('div', { class: 'row2' }, field('Facebook', fb), field('TikTok', tt)), b)
  })

  form('Where you are based', (s) => {
    const sub = txt(v.suburb, { autocomplete: 'address-level2' })
    const pc = txt(v.postcode, { inputmode: 'numeric', maxlength: '4', autocomplete: 'postal-code' })
    const st = h('select', { class: 'select' }, h('option', { value: '' }, 'Choose a state'), STATES.map(x => h('option', { value: x }, x)))
    st.value = v.state || ''
    const b = h('button', { class: 'btn' }, 'Save location')
    b.addEventListener('click', () => save({ suburb: sub.value.trim() || null, postcode: pc.value.trim() || null, state: st.value || null }, b))
    s.append(h('div', { class: 'row2' }, field('Suburb', sub), field('Postcode', pc)), field('State', st), b,
      h('p', { class: 'muted small', style: { marginTop: '14px' } }, 'Service areas and travel range are managed in the app, where the map search lives.'))
  })

  /* ---- publish ---- */
  form('Listing visibility', (s) => {
    const box = h('div'); s.appendChild(box)
    let tried = false
    const paint = () => {
      clear(box)
      const checks = goLiveChecks(C), missing = checks.filter(c => !c.ok)
      const sw = toggle(!!v.is_published, async (on) => {
        if (on && missing.length) { tried = true; paint(); return }
        const ok = await save({ is_published: on }, null, on ? 'You are live' : 'Listing hidden')
        if (ok) tried = false
        paint()
      }, 'Show my listing to couples')
      box.appendChild(h('div', { class: 'pill-row' },
        h('div', null, h('div', { class: 'l1' }, 'Show my listing to couples'), h('div', { class: 'l2' }, v.is_published ? 'You are live in the app.' : (missing.length ? 'Not live yet. ' + missing.length + (missing.length === 1 ? ' thing' : ' things') + ' to finish first.' : 'Ready. Switch this on to go live.'))), sw))
      if (!v.is_published) {
        box.appendChild(h('div', { class: 'golist' }, checks.map(c =>
          h('div', { class: 'goitem' + (c.ok ? ' ok' : '') }, h('span', { class: 'goic' }, c.ok ? '✓' : ''), h('span', { class: 'gol' }, c.label),
            c.ok ? null : h('button', { class: 'linkbtn', onclick: () => { if (c.route) fixCheck(C, c); else { const t = secs[c.sec]; if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }) } } }, c.action)))))
        if (tried && missing.length) box.appendChild(h('div', { class: 'note warn', style: { marginTop: '12px' } }, 'You can go live once the items above are done.'))
      }
    }
    paint()
  })

  if (C.jump) { const t = secs[C.jump]; C.jump = null; if (t) setTimeout(() => t.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120) }
}
