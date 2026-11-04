import { h, clear, img } from './lib.js'

// Same 7 checks as the app's Profile health card.
export async function computeHealth(C) {
  const v = C.vendor || {}
  const [u, p] = await Promise.all([
    C.sb.from('users').select('avatar_url').eq('id', C.user.id).maybeSingle().then(r => r.data).catch(() => null),
    C.sb.from('vendor_packages').select('id', { count: 'exact', head: true }).eq('vendor_id', v.id).eq('is_active', true).then(r => r.count || 0).catch(() => 0),
  ])
  const photos = Array.isArray(v.portfolio_photos) ? v.portfolio_photos.length : 0
  const items = [
    { label: 'Profile picture', ok: !!(u && u.avatar_url), sec: 'Profile picture' },
    { label: 'Tagline', ok: !!(v.tagline || '').trim(), sec: 'Business' },
    { label: 'About you', ok: !!(v.bio || '').trim(), sec: 'Business' },
    { label: 'Portfolio photos', ok: photos > 0, sec: 'photos' },
    { label: 'Showreel video', ok: !!v.portfolio_video_url, sec: 'Showreel' },
    { label: 'An active package', ok: p > 0, route: 'packages' },
    { label: 'Listing is live', ok: !!v.is_published, sec: 'Listing visibility' },
  ]
  const done = items.filter(i => i.ok).length
  return { items, pct: Math.round(done * 100 / items.length), avatar: u && u.avatar_url, packages: p }
}

export function healthCard(C, H) {
  const rows = H.items.map(i => h('div', { class: 'goitem', style: { opacity: i.ok ? 0.55 : 1 } },
    h('span', { class: 'goic' }), h('span', { class: 'gol', style: i.ok ? { textDecoration: 'line-through' } : null }, i.label),
    i.ok ? h('span', { class: 'tag ok' }, 'Done') : h('button', { class: 'linkbtn', onclick: () => { if (i.sec) C.jump = i.sec; C.go(i.route || 'profile') } }, 'Fix')))
  return h('div', { class: 'sec' },
    h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'Profile health'), h('span', { class: 'small' }, H.pct + '%')),
    h('div', { class: 'bar' }, h('i', { style: { width: H.pct + '%' } })),
    H.pct < 100 ? h('div', { class: 'golist', style: { marginTop: '12px' } }, rows) : h('p', { class: 'muted small', style: { marginTop: '10px' } }, 'Your profile is complete.'))
}

// What a couple sees on the swipe card.
export function previewCardEl(C) {
  const v = C.vendor || {}
  const photos = Array.isArray(v.portfolio_photos) ? v.portfolio_photos : []
  const cover = v.cover_photo_url || photos[0] || null
  const place = [v.suburb || v.city, v.state].filter(Boolean).join(', ')
  const cat = v.category_name || v.category || ''
  const price = v.starting_price ? 'From $' + Number(v.starting_price).toLocaleString('en-AU') : ''
  const card = h('div', { style: { position: 'relative', width: '100%', maxWidth: '300px', aspectRatio: '9 / 16', borderRadius: '20px', overflow: 'hidden', background: '#e2f4ff', boxShadow: '0 18px 40px rgba(53,34,25,.18)', margin: '0 auto' } },
    cover ? h('img', { src: img(cover, 700), alt: '', style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } })
      : h('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8fa0a8', fontSize: '14px', padding: '24px', textAlign: 'center' } }, 'Add a portfolio photo and it shows here'),
    v.is_featured ? h('span', { style: { position: 'absolute', top: '14px', left: '14px', background: '#c3a475', color: '#fff', fontSize: '11px', letterSpacing: '.08em', padding: '5px 10px', borderRadius: '999px' } }, 'FEATURED') : null,
    h('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: '56px 18px 18px', background: 'linear-gradient(to top, rgba(53,34,25,.88), rgba(53,34,25,0))', color: '#fff' } },
      cat ? h('div', { style: { fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', opacity: .8 } }, cat) : null,
      h('div', { style: { fontFamily: 'Cormorant, serif', fontSize: '28px', lineHeight: 1.1, marginTop: '4px' } }, (v.business_name || 'Your business')),
      v.tagline ? h('div', { style: { fontSize: '13px', opacity: .9, marginTop: '6px' } }, v.tagline) : null,
      h('div', { style: { fontSize: '12px', opacity: .85, marginTop: '8px' } }, [place, price].filter(Boolean).join('  ·  '))))
  return card
}
export function previewCard(C, H) {
  return h('div', { class: 'sec' },
    h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'What couples see')),
    previewCardEl(C))
}

// Size guide for uploads. Cards are portrait, so portrait photos fill the whole card.
export function imageGuide() {
  const frame = (w, hgt, label, sub, good) => h('div', { style: { textAlign: 'center', flex: 1 } },
    h('div', { style: { width: w + 'px', height: hgt + 'px', margin: '0 auto 6px', borderRadius: '8px', border: '2px solid ' + (good ? '#8fa0a8' : '#d4718a'), background: good ? '#e2f4ff' : '#fbeef2' } }),
    h('div', { style: { fontSize: '12px', fontWeight: 600 } }, label), h('div', { class: 'muted', style: { fontSize: '11px' } }, sub))
  return h('div', { style: { border: '1px solid #c8d6de', borderRadius: '12px', padding: '14px', marginBottom: '14px', background: '#fbf8f3' } },
    h('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '10px' } },
      frame(36, 64, 'Best', '9:16 portrait', true), frame(40, 50, 'Good', '4:5', true), frame(64, 40, 'Gets cropped', 'Landscape', false)),
    h('p', { class: 'muted', style: { fontSize: '12px', margin: 0 } }, 'Couples swipe through full-screen portrait cards. Upload portrait photos at least 1080 × 1920 px so they fill the card sharp. Landscape photos get cropped at the sides.'))
}


/* ===================================================================
   Exact copy of the app's swipe card and swipe-up profile, for vendors.
   Mirrors SwipeScreen (card face) and VendorDetailSheet (About, Packages,
   Reviews, Details). Same colours, type, spacing and behaviour.
   =================================================================== */
const SVGNS = 'http://www.w3.org/2000/svg'
function ic(d, size, color, fill) {
  const s = document.createElementNS(SVGNS, 'svg')
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size)
  s.setAttribute('fill', fill ? color : 'none'); s.setAttribute('stroke', color); s.setAttribute('stroke-width', '1.6'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round')
  s.style.flexShrink = '0'
  d.split('|').forEach(p => { const e = document.createElementNS(SVGNS, 'path'); e.setAttribute('d', p); s.appendChild(e) })
  return s
}
const IC = {
  home: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z|M9 22V12h6v10',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  expand: 'M15 3h6v6|M9 21H3v-6|M21 3l-7 7|M3 21l7-7',
  map: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z',
  award: 'M12 14a6 6 0 100-12 6 6 0 000 12z|M8.21 13.89L7 23l5-3 5 3-1.21-9.12',
  travel: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  dollar: 'M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6',
  globe: 'M12 22a10 10 0 100-20 10 10 0 000 20z|M2 12h20|M12 2a15 15 0 014 10 15 15 0 01-4 10 15 15 0 01-4-10 15 15 0 014-10z',
  insta: 'M17.5 6.5h.01|M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5z|M16 11.37a4 4 0 11-7.914 1.174A4 4 0 0116 11.37z',
  chev: 'M9 18l6-6-6-6',
  camera: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z|M12 17a4 4 0 100-8 4 4 0 000 8z',
  heart: 'M12 21C12 21 3 14 3 8a5 5 0 019-3 5 5 0 019 3c0 6-9 13-9 13z',
  phone: 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z',
}
const CATS = {"venues": "Venues", "photographers": "Photographers", "videographers": "Videographers", "celebrants": "Celebrants", "planners": "Wedding Planners", "coordinator": "Day Coordinators", "catering": "Catering", "hair": "Hair", "makeup": "Makeup Artists", "wellness": "Beauty & Wellness", "spray-tan": "Spray Tan", "bridal-stylist": "Bridal Stylists", "bridal-gowns": "Bridal Boutiques", "formalwear": "Formalwear", "bridesmaid-dresses": "Bridesmaid Dresses", "jewellery": "Jewellery", "rings": "Rings & Bands", "accessories": "Accessories", "florists": "Florists", "wedding-stylist": "Wedding Stylists", "decorations": "Decorations", "hire": "Event Hire", "lighting": "Lighting", "signage": "Signage", "stationery": "Stationery & Invitations", "dj": "DJs", "live-band": "Live Bands", "acoustic": "Acoustic Musicians", "mc": "MCs", "performer": "Specialty Performers", "photo-booths": "Photo Booths", "hens-bucks": "Hens & Bucks", "cakes": "Cake Designers", "dessert-bar": "Dessert Bars", "bar": "Bar & Beverages", "mobile-bar": "Mobile Bar", "food-truck": "Food Trucks", "content-creator": "Content Creators", "drone": "Drone Operators", "video-booth": "Video Booths", "audio-guestbook": "Audio Guestbooks", "transport": "Wedding Cars", "accommodation": "Accommodation", "childcare": "On-site Childcare", "pet-attendant": "Pet Attendants", "security": "Event Security", "favours": "Custom Favours", "gifts": "Gifts & Keepsakes", "registry": "Gift Registry", "live-painter": "Live Wedding Painters", "tattoo": "Tattoo Artists", "dance": "Dance Lessons", "honeymoon": "Honeymoon & Travel", "elopement": "Elopement Packages", "micro-wedding": "Micro Weddings"}
const TIER = { budget: ['$', 'Budget-friendly'], mid: ['$$', 'Moderate'], premium: ['$$$', 'Premium'], luxury: ['$$$$', 'Luxury'] }
const cap = (t) => String(t).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
const css = (el, o) => { Object.assign(el.style, o); return el }
const DM = "'DM Sans', system-ui, sans-serif", CG = "'Cormorant', Georgia, serif"
const W = 390, HGT = 780, HEAD = 52

function stars(r, size, onLight) {
  const w = h('span', { style: { display: 'inline-flex', gap: '2px' } })
  for (let i = 1; i <= 5; i++) w.appendChild(ic(IC.star, size, i <= Math.round(r) ? (onLight ? '#c3a475' : '#b7c2c8') : (onLight ? '#c8d6de' : 'rgba(255,255,255,.4)'), i <= Math.round(r)))
  return w
}

export function buildAppPreview(v, pkgs, catSlug, reviews) {
  const photos = [...(v.cover_photo_url ? [v.cover_photo_url] : []), ...((v.portfolio_photos || []).filter(p => p !== v.cover_photo_url))]
  if (!photos.length) photos.push('https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80')
  const featured = !!v.is_featured
  const location = [v.suburb, v.city, v.state].filter(Boolean).join(', ')
  const catLabel = CATS[catSlug] || ''
  let idx = 0

  const frame = css(h('div', { class: 'ap-frame' }), { position: 'relative', width: W + 'px', height: HGT + 'px', overflow: 'hidden', background: '#352219', fontFamily: DM, color: '#352219' })
  const scroll = css(h('div', { class: 'ap-scroll' }), { position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', scrollSnapType: 'y proximity', scrollbarWidth: 'none' })
  frame.appendChild(scroll)

  /* ---------- card face ---------- */
  const face = css(h('div'), { position: 'relative', width: W + 'px', height: HGT + 'px', scrollSnapAlign: 'start', overflow: 'hidden', background: '#352219' })
  const media = css(h('div'), { position: 'absolute', inset: 0 })
  const dots = css(h('div'), { position: 'absolute', left: 0, right: 0, top: (HEAD + 10) + 'px', display: 'flex', justifyContent: 'center', gap: '5px', pointerEvents: 'none' })
  const drawMedia = () => {
    media.textContent = ''
    if (idx === 0 && v.portfolio_video_url) {
      const vid = h('video', { src: v.portfolio_video_url, muted: true, loop: true, playsinline: true, autoplay: true })
      vid.muted = true; css(vid, { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }); media.appendChild(vid); vid.play && vid.play().catch(() => {})
    } else media.appendChild(css(h('img', { src: photos[idx], alt: '' }), { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }))
    dots.textContent = ''
    if (photos.length > 1) photos.forEach((_, i) => dots.appendChild(css(h('div'), { height: '5px', width: i === idx ? '16px' : '5px', borderRadius: i === idx ? '3px' : '50%', background: i === idx ? '#fff' : 'rgba(255,255,255,.35)' })))
  }
  face.appendChild(media)
  if (photos.length > 1) {
    face.appendChild(css(h('div', { onclick: () => { idx = (idx - 1 + photos.length) % photos.length; drawMedia(); drawCar() } }), { position: 'absolute', top: 0, left: 0, bottom: 0, width: '40%', cursor: 'pointer' }))
    face.appendChild(css(h('div', { onclick: () => { idx = (idx + 1) % photos.length; drawMedia(); drawCar() } }), { position: 'absolute', top: 0, right: 0, bottom: 0, width: '40%', cursor: 'pointer' }))
  }
  face.appendChild(css(h('div'), { position: 'absolute', left: 0, right: 0, top: 0, height: '160px', background: 'linear-gradient(rgba(26,26,26,.55), transparent)', pointerEvents: 'none' }))
  face.appendChild(css(h('div'), { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 0%, transparent 40%, rgba(26,26,26,.55) 68%, rgba(26,26,26,.96) 100%)', pointerEvents: 'none' }))
  if (featured) face.appendChild(css(h('div', null, '★ Featured'), { position: 'absolute', left: '16px', top: (HEAD + 12) + 'px', background: '#b7c2c8', borderRadius: '100px', padding: '5px 12px', fontSize: '11px', fontWeight: 600, color: '#352219', letterSpacing: '.3px' }))
  if (v.average_rating != null) face.appendChild(css(h('div', null, ic(IC.star, 11, '#e2f4ff', true), h('span', null, Number(v.average_rating).toFixed(1))), { position: 'absolute', right: '52px', top: (HEAD + 12) + 'px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(53,34,25,.7)', borderRadius: '100px', padding: '5px 10px', fontSize: '11px', fontWeight: 500, color: '#fbf8f3' }))
  face.appendChild(dots)
  face.appendChild(css(h('button', { 'aria-label': 'Expand photo', onclick: () => lightbox(photos, idx) }, ic(IC.expand, 14, '#fff')), { position: 'absolute', right: '12px', top: (HEAD + 10) + 'px', width: '34px', height: '34px', borderRadius: '50%', border: 0, background: 'rgba(53,34,25,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 3 }))
  const bottom = css(h('div'), { position: 'absolute', left: '20px', right: '20px', bottom: '92px', pointerEvents: 'none' })
  if (catLabel) bottom.appendChild(css(h('div'), { display: 'flex', gap: '8px', marginBottom: '10px' })).appendChild(css(h('div', null, catLabel), { background: 'rgba(183,194,200,.25)', border: '1px solid rgba(183,194,200,.4)', borderRadius: '100px', padding: '5px 12px', fontSize: '12px', fontWeight: 500, color: '#fbf8f3' }))
  bottom.appendChild(css(h('div', null, v.business_name || 'Your business'), { fontFamily: CG, fontWeight: 700, fontSize: '34px', lineHeight: '38px', marginBottom: '5px', color: featured ? '#b7c2c8' : '#fff' }))
  if (location) bottom.appendChild(css(h('div', null, ic(IC.home, 12, 'rgba(255,255,255,.6)'), h('span', null, location)), { display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px', fontSize: '13px', color: 'rgba(255,255,255,.7)' }))
  if (v.bio || v.tagline) bottom.appendChild(css(h('div', null, v.bio || v.tagline), { fontSize: '14px', lineHeight: '20px', color: featured ? 'rgba(183,194,200,.9)' : 'rgba(255,255,255,.75)', marginBottom: '10px', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }))
  bottom.appendChild(css(h('div', { class: 'ap-pulse' }, '↑  Swipe up for more'), { textAlign: 'center', fontSize: '13px', fontWeight: 500, color: '#e2f4ff', letterSpacing: '.3px', cursor: 'pointer', pointerEvents: 'auto' }))
  bottom.lastChild.addEventListener('click', () => { scroll.scrollTo({ top: HGT, behavior: 'smooth' }) })
  face.appendChild(bottom)
  scroll.appendChild(face)

  /* ---------- detail page ---------- */
  const detail = css(h('div'), { position: 'relative', minHeight: HGT + 'px', background: '#fbf8f3', scrollSnapAlign: 'start', paddingBottom: '90px' })
  // carousel
  const car = css(h('div'), { position: 'relative', height: '300px', overflow: 'hidden', background: '#352219' })
  const carImg = css(h('div'), { position: 'absolute', inset: 0 })
  const carDots = css(h('div'), { position: 'absolute', left: 0, right: 0, bottom: '14px', display: 'flex', justifyContent: 'center', gap: '5px', pointerEvents: 'none' })
  const count = css(h('div'), { position: 'absolute', right: '14px', top: '12px', display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(53,34,25,.5)', borderRadius: '20px', padding: '5px 10px', fontSize: '12px', color: '#fff', pointerEvents: 'none' })
  const drawCar = () => {
    carImg.textContent = ''
    carImg.appendChild(css(h('img', { src: photos[idx], alt: '' }), { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }))
    carDots.textContent = ''
    if (photos.length > 1) photos.slice(0, 10).forEach((_, i) => carDots.appendChild(css(h('div'), { height: '5px', width: i === idx ? '16px' : '5px', borderRadius: i === idx ? '3px' : '50%', background: i === idx ? '#fff' : 'rgba(255,255,255,.4)' })))
    count.textContent = ''; count.append(ic(IC.camera, 12, '#fff'), h('span', null, (idx + 1) + ' / ' + photos.length), h('span', { style: { color: 'rgba(255,255,255,.6)' } }, ' · Tap centre to view'))
  }
  car.appendChild(carImg)
  const zone = (w, fn) => css(h('div', { onclick: fn }), { position: 'absolute', top: 0, bottom: 0, width: w, cursor: 'pointer' })
  car.append(css(zone('40%', () => { idx = (idx - 1 + photos.length) % photos.length; drawMedia(); drawCar() }), { left: 0 }), css(zone('20%', () => lightbox(photos, idx)), { left: '40%' }), css(zone('40%', () => { idx = (idx + 1) % photos.length; drawMedia(); drawCar() }), { right: 0 }))
  car.appendChild(css(h('div'), { position: 'absolute', inset: 0, background: 'linear-gradient(rgba(53,34,25,.45), transparent 20%, transparent 65%, rgba(53,34,25,.82))', pointerEvents: 'none' }))
  car.append(carDots, count)
  const nameO = css(h('div'), { position: 'absolute', left: '20px', right: '20px', bottom: '20px', pointerEvents: 'none' })
  if (featured) nameO.appendChild(css(h('div', null, '★  Featured Vendor'), { display: 'inline-block', background: '#b7c2c8', borderRadius: '100px', padding: '4px 12px', marginBottom: '8px', fontSize: '11px', fontWeight: 600, color: '#352219', letterSpacing: '.3px' }))
  nameO.appendChild(css(h('div', null, v.business_name || 'Your business'), { fontFamily: CG, fontWeight: 700, fontSize: '30px', lineHeight: '34px', marginBottom: '3px', color: featured ? '#b7c2c8' : '#fff', textShadow: '0 1px 4px rgba(0,0,0,.65)' }))
  if (location) nameO.appendChild(css(h('div', null, location), { fontSize: '13px', color: 'rgba(255,255,255,.9)', textShadow: '0 1px 4px rgba(0,0,0,.5)' }))
  if (v.average_rating) nameO.appendChild(css(h('div', null, stars(v.average_rating, 13), h('span', null, Number(v.average_rating).toFixed(1) + ' · ' + (v.review_count || 0) + ' reviews')), { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '13px', color: 'rgba(255,255,255,.85)' }))
  car.appendChild(nameO)
  detail.appendChild(car)

  // tabs (sticky)
  const TABS = ['About', 'Packages', 'Reviews', 'Details']
  let tab = 'About'
  const tabs = css(h('div'), { display: 'flex', background: '#fff', borderBottom: '1px solid #c8d6de', position: 'sticky', top: 0, zIndex: 5 })
  const body = h('div')
  const drawTabs = () => {
    tabs.textContent = ''
    TABS.forEach(t => tabs.appendChild(css(h('button', { onclick: () => { tab = t; drawTabs(); drawBody() } }, t, tab === t ? css(h('span'), { position: 'absolute', bottom: 0, left: '12px', right: '12px', height: '2px', background: '#352219', borderRadius: '1px' }) : null),
      { flex: 1, position: 'relative', padding: '13px 0', border: 0, background: 'none', cursor: 'pointer', fontFamily: DM, fontSize: '13px', fontWeight: tab === t ? 500 : 400, color: tab === t ? '#352219' : '#8fa0a8' })))
  }
  detail.append(tabs, body)

  const sect = (label, ...kids) => css(h('div', null, css(h('div', null, label), { fontSize: '10px', fontWeight: 500, color: '#8fa0a8', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '12px' }), ...kids), { padding: '18px 20px 4px' })
  const chip = (t, dark) => css(h('span', null, t), { display: 'inline-block', background: dark ? '#352219' : '#fbf8f3', color: dark ? '#fff' : '#352219', border: dark ? 0 : '1px solid #c8d6de', borderRadius: '100px', padding: '7px 14px', fontSize: '13px', margin: '0 8px 8px 0' })

  const aboutTab = () => {
    const w = h('div')
    if (featured) w.appendChild(css(h('div', null,
      css(h('div', null, '★'), { width: '36px', height: '36px', borderRadius: '50%', background: '#b7c2c8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }),
      h('div', null, css(h('div', null, 'Featured Vendor'), { fontSize: '13px', fontWeight: 600, marginBottom: '3px' }), css(h('div', null, 'Verified and handpicked by the Aisle Match team for exceptional quality and service.'), { fontSize: '12px', color: '#6B5C52', lineHeight: '17px' }))),
      { display: 'flex', gap: '12px', background: '#e2f4ff', margin: '16px 16px 0', borderRadius: '14px', padding: '14px', border: '1px solid rgba(183,194,200,.5)' }))
    const stats = css(h('div'), { padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid #c8d6de' })
    const tier = TIER[v.price_range]
    if (tier) stats.appendChild(css(h('div', null, css(h('span', null, tier[0]), { fontFamily: CG, fontWeight: 700, fontSize: '20px' }), css(h('span', null, tier[1]), { fontSize: '13px', color: '#6B5C52' })), { display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '4px' }))
    const trav = { local: 'Local area', state: 'State-wide', national: 'Australia-wide', international: 'Worldwide' }
    const rows = []
    if (location) rows.push([IC.map, location])
    if (v.years_active) rows.push([IC.award, v.years_active + ' years experience'])
    if (v.travel_willingness) rows.push([IC.travel, trav[v.travel_willingness] || v.travel_willingness])
    if (v.starting_price) rows.push([IC.dollar, 'From $' + Number(v.starting_price).toLocaleString('en-AU')])
    rows.forEach(([d, t]) => stats.appendChild(css(h('div', null, ic(d, 16, '#6B5C52'), h('span', null, t)), { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' })))
    w.appendChild(stats)
    const bl = []
    if (v.lgbtq_affirming) bl.push('LGBTQ+ Affirming'); if (v.religion_friendly) bl.push('Religion Friendly')
    if (v.team_gender === 'female') bl.push('Female Led'); if (v.team_gender === 'male') bl.push('Male Led'); if (v.team_gender === 'mixed') bl.push('Mixed Team')
    if (bl.length) w.appendChild(css(h('div'), { display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 20px', borderBottom: '1px solid #c8d6de' })).append(...bl.map(t => css(h('span', null, t), { background: '#e2f4ff', borderRadius: '100px', padding: '5px 12px', fontSize: '12px', fontWeight: 500 })))
    if (v.bio) {
      const p = css(h('div', null, v.bio), { fontSize: '15px', lineHeight: '24px', whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: '5', WebkitBoxOrient: 'vertical', overflow: 'hidden' })
      const s = sect('About', p)
      if (v.bio.length > 200) { let ex = false; const b = css(h('button', { onclick: () => { ex = !ex; p.style.WebkitLineClamp = ex ? 'unset' : '5'; b.textContent = ex ? '− Show less' : '+ Read more' } }, '+ Read more'), { border: 0, background: 'none', padding: '8px 0 0', fontFamily: DM, fontSize: '14px', fontWeight: 500, textDecoration: 'underline', cursor: 'pointer', color: '#352219' }); s.appendChild(b) }
      w.appendChild(s)
    }
    const vibe = []
    const hm = { very_fun: 'Very funny', fun: 'Fun & light-hearted', balanced: 'Professional warmth', serious: 'Elegant & formal' }, en = { high: 'High energy', balanced: 'Balanced energy', calm: 'Calm & relaxed' }
    if (hm[v.humour_level]) vibe.push(hm[v.humour_level]); if (en[v.energy_level]) vibe.push(en[v.energy_level]); (v.personality_tags || []).forEach(t => vibe.push(cap(t)))
    if (vibe.length) w.appendChild(sect('Personality & Vibe', h('div', null, vibe.map(t => chip(t)))))
    if ((v.wedding_styles || []).length) w.appendChild(sect('Specialises In', h('div', null, v.wedding_styles.map(t => chip(cap(t), true)))))
    const langs = (v.languages || []).filter(l => String(l).toLowerCase() !== 'english')
    if (langs.length) w.appendChild(sect('Also Speaks', h('div', null, langs.map(t => chip(t)))))
    const link = (d, label, val) => css(h('div', null, css(ic(d, 16, '#352219'), {}), h('div', { style: { flex: 1 } }, css(h('div', null, label), { fontSize: '13px', fontWeight: 500 }), css(h('div', null, val), { fontSize: '12px', color: '#6B5C52' })), ic(IC.chev, 16, '#8fa0a8')), { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #c8d6de' })
    if (v.website_url || v.instagram) w.appendChild(sect('Find Us Online', v.website_url ? link(IC.globe, 'Website', String(v.website_url).replace(/https?:\/\//, '')) : null, v.instagram ? link(IC.insta, 'Instagram', '@' + String(v.instagram).replace(/^@/, '').replace(/https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')) : null))
    if (photos.length > 1) {
      const t = Math.floor((W - 40 - 8) / 3)
      w.appendChild(sect('Portfolio', css(h('div', null, photos.map((u, i) => css(h('img', { src: u, alt: '', onclick: () => lightbox(photos, i) }), { width: t + 'px', height: t + 'px', objectFit: 'cover', borderRadius: '10px', background: '#e2f4ff', cursor: 'pointer' }))), { display: 'flex', flexWrap: 'wrap', gap: '4px' })))
    }
    w.appendChild(css(h('div'), { height: '20px' }))
    return w
  }

  const packagesTab = () => {
    if (!pkgs.length) return css(h('div', null, css(h('div', null, 'Custom pricing'), { fontFamily: CG, fontWeight: 700, fontSize: '24px' }), css(h('div', null, v.starting_price ? 'Starting from $' + Number(v.starting_price).toLocaleString('en-AU') + ' — reach out for a personalised quote.' : 'This vendor provides personalised quotes based on your wedding requirements.'), { fontSize: '14px', color: '#6B5C52', marginTop: '10px' })), { padding: '40px', textAlign: 'center' })
    const stack = css(h('div'), { padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '16px' })
    pkgs.forEach((p, i) => {
      const br = i % 2 === 0
      const main = br ? '#fff' : '#352219', muted = br ? 'rgba(255,255,255,.68)' : 'rgba(53,34,25,.68)'
      const inc = []
      if (p.duration_hours) inc.push(p.duration_hours + 'hr coverage'); if (p.edited_count) inc.push(p.edited_count + ' edited files'); if (p.turnaround_days) inc.push(p.turnaround_days + ' day turnaround')
      if (p.max_guests) inc.push('Up to ' + p.max_guests + ' guests'); if (p.performance_hours) inc.push(p.performance_hours + 'hr performance'); if (p.set_count) inc.push(p.set_count + ' sets')
      if (p.travel_included) inc.push(p.travel_km ? 'Travel up to ' + p.travel_km + 'km' : 'Travel included'); if (p.includes_engagement) inc.push('Engagement session'); if (p.album_included) inc.push('Album included')
      if (p.trials_included) inc.push('Trial included'); if (p.equipment_included) inc.push('Equipment included'); if (p.chauffeur_included) inc.push('Chauffeur'); if (p.custom_design) inc.push('Custom design'); if (p.rush_available) inc.push('Rush orders available')
      const card = css(h('div'), { borderRadius: '22px', overflow: 'hidden', border: '1.5px solid ' + (br ? 'rgba(183,194,200,.35)' : 'rgba(53,34,25,.18)'), background: br ? '#352219' : '#e2f4ff', boxShadow: '0 8px 18px rgba(53,34,25,.14)' })
      if (p.is_most_popular) card.appendChild(css(h('div', null, 'Most Popular'), { padding: '8px 0', textAlign: 'center', fontSize: '11px', fontWeight: 500, letterSpacing: '.6px', textTransform: 'uppercase', background: br ? 'rgba(255,255,255,.14)' : 'rgba(53,34,25,.12)', color: br ? '#fff' : '#352219' }))
      const inner = css(h('div'), { padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px' })
      inner.appendChild(css(h('div', null, css(h('div', null, p.name), { fontFamily: CG, fontWeight: 700, fontSize: '28px', lineHeight: '32px', flex: 1, color: main }), css(h('div', null, p.price ? '$' + Number(p.price).toLocaleString('en-AU') : (p.price_label || 'POA')), { fontFamily: CG, fontWeight: 700, fontSize: '24px', color: main, flexShrink: 0 })), { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }))
      if (p.description) inner.appendChild(css(h('div', null, p.description), { fontSize: '14px', lineHeight: '21px', color: muted }))
      if (inc.length) inner.appendChild(css(h('div', null, inc.map(t => css(h('div', null, css(h('span'), { width: '5px', height: '5px', borderRadius: '50%', background: br ? 'rgba(255,255,255,.55)' : 'rgba(53,34,25,.45)', flexShrink: 0 }), css(h('span', null, t), { fontSize: '14px', color: muted })), { display: 'flex', alignItems: 'center', gap: '9px' }))), { display: 'flex', flexDirection: 'column', gap: '9px', marginTop: '6px' }))
      if (p.deposit_type && p.deposit_type !== 'none' && p.deposit_value) inner.appendChild(css(h('div', null, (/percent/i.test(p.deposit_type) ? p.deposit_value + '%' : '$' + p.deposit_value) + ' deposit to secure your date'), { fontSize: '12px', fontStyle: 'italic', marginTop: '10px', color: muted }))
      card.appendChild(inner)
      card.appendChild(css(h('div', null, css(h('span', null, 'Enquire about this package'), {}), ic(IC.chev, 15, br ? '#352219' : '#fff')), { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '8px 20px 20px', borderRadius: '100px', padding: '15px 0', fontSize: '14px', fontWeight: 500, background: br ? '#fff' : '#352219', color: br ? '#352219' : '#fff' }))
      stack.appendChild(card)
    })
    return css(h('div', null, css(h('div', null, 'Packages'), { fontSize: '10px', fontWeight: 500, color: '#8fa0a8', letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 12px 20px' }), stack), { padding: '20px 0' })
  }

  const reviewsTab = () => {
    if (!reviews.length) return css(h('div', null, css(h('div', null, 'No reviews yet'), { fontFamily: CG, fontWeight: 700, fontSize: '24px' }), css(h('div', null, 'Reviews from couples appear here once their wedding is complete.'), { fontSize: '14px', color: '#6B5C52', marginTop: '10px' })), { padding: '40px', textAlign: 'center' })
    const avg = reviews.reduce((a, r) => a + (r.overall_rating || 0), 0) / reviews.length
    const w = css(h('div'), { padding: '20px' })
    w.appendChild(css(h('div', null, css(h('div', null, avg.toFixed(1)), { fontFamily: CG, fontWeight: 700, fontSize: '44px', lineHeight: 1 }), h('div', null, stars(avg, 14, true), css(h('div', null, reviews.length + ' review' + (reviews.length === 1 ? '' : 's')), { fontSize: '13px', color: '#6B5C52', marginTop: '4px' }))), { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '18px' }))
    reviews.slice(0, 6).forEach(r => {
      const u = r.couples && r.couples.users
      const name = u && u.first_name ? u.first_name + (u.last_name ? ' ' + u.last_name[0] + '.' : '') : 'A couple'
      w.appendChild(css(h('div', null, css(h('div', null, css(h('b', null, name), { fontSize: '14px' }), stars(r.overall_rating || 0, 12, true)), { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }), r.title ? css(h('div', null, r.title), { fontWeight: 500, marginTop: '6px', fontSize: '14px' }) : null, r.body ? css(h('div', null, r.body), { fontSize: '14px', lineHeight: '21px', color: '#4a3328', marginTop: '4px' }) : null, r.vendor_reply ? css(h('div', null, css(h('b', null, 'Reply from ' + (v.business_name || 'the vendor')), { display: 'block', fontSize: '12px', marginBottom: '2px' }), r.vendor_reply), { marginTop: '10px', padding: '10px 12px', background: '#e2f4ff', borderRadius: '10px', fontSize: '13px' }) : null), { padding: '16px 0', borderTop: '1px solid #c8d6de' }))
    })
    return w
  }

  const detailsTab = () => {
    const attrs = v.vendor_attributes || {}
    const facts = []
    if (location) facts.push(['Based in', location]); if (v.years_active) facts.push(['Experience', v.years_active + (v.years_active === 1 ? ' year' : ' years')])
    if (v.starting_price) facts.push(['Starting from', '$' + Number(v.starting_price).toLocaleString('en-AU')]); else if (v.price_range) facts.push(['Price range', String(v.price_range)])
    if (v.travel_willingness) facts.push(['Travel', cap(v.travel_willingness)]); if (v.team_gender) facts.push(['Team', cap(v.team_gender)]); if (pkgs.length) facts.push(['Packages', pkgs.length + ' available'])
    const arrays = Object.entries(attrs).filter(([, val]) => Array.isArray(val) && val.length)
    const bools = Object.entries(attrs).filter(([, val]) => val === true).map(([k]) => cap(k))
    if (v.lgbtq_affirming) bools.push('LGBTQ+ Affirming'); if (v.religion_friendly) bools.push('Religion Friendly')
    const w = h('div')
    if (facts.length) w.appendChild(css(h('div', null, facts.map(([k, val]) => css(h('div', null, css(h('span', null, k), { color: '#6B5C52', fontSize: '13px' }), css(h('span', null, val), { fontSize: '14px', fontWeight: 500 })), { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #c8d6de' }))), { padding: '8px 20px' }))
    arrays.forEach(([k, val]) => w.appendChild(sect(cap(k), h('div', null, val.map(t => chip(cap(t)))))))
    if (bools.length) w.appendChild(sect('Good to know', h('div', null, bools.map(t => chip(t)))))
    if (!facts.length && !arrays.length && !bools.length) w.appendChild(css(h('div', null, 'No extra details yet'), { padding: '40px', textAlign: 'center', fontFamily: CG, fontWeight: 700, fontSize: '22px' }))
    w.appendChild(css(h('div'), { height: '20px' }))
    return w
  }
  const drawBody = () => { body.textContent = ''; body.appendChild(tab === 'About' ? aboutTab() : tab === 'Packages' ? packagesTab() : tab === 'Reviews' ? reviewsTab() : detailsTab()) }

  // bottom bar (inactive in preview, like the app)
  const bar = css(h('div', null,
    css(h('div', null, ic(IC.heart, 22, '#352219')), { width: '46px', height: '46px', borderRadius: '50%', border: '1.5px solid rgba(183,194,200,.6)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }),
    css(h('div', null, ic(IC.phone, 20, '#352219')), { width: '46px', height: '46px', borderRadius: '50%', border: '1.5px solid #c8d6de', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }),
    css(h('div', null, 'Book now'), { flex: 1, background: '#352219', color: '#fff', borderRadius: '14px', padding: '13px 0', textAlign: 'center', fontSize: '15px', fontWeight: 500, letterSpacing: '.3px' })),
    { position: 'absolute', left: 0, right: 0, bottom: 0, display: 'none', alignItems: 'center', gap: '10px', padding: '12px 20px 16px', background: 'rgba(255,255,255,.97)', opacity: .5, zIndex: 6 })
  frame.appendChild(bar)
  scroll.addEventListener('scroll', () => { bar.style.display = scroll.scrollTop > HGT * 0.6 ? 'flex' : 'none' })
  scroll.appendChild(detail)

  /* ---------- lightbox ---------- */
  function lightbox(list, start) {
    let i = start
    const ov = css(h('div'), { position: 'absolute', inset: 0, background: 'rgba(20,12,8,.96)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' })
    const im = css(h('img', { src: list[i], alt: '' }), { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' })
    const x = css(h('button', { onclick: () => ov.remove(), 'aria-label': 'Close' }, '×'), { position: 'absolute', top: '14px', right: '14px', width: '36px', height: '36px', borderRadius: '50%', border: 0, background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: '22px', cursor: 'pointer' })
    const nav = (d, side) => css(h('button', { onclick: () => { i = (i + d + list.length) % list.length; im.src = list[i] }, 'aria-label': d > 0 ? 'Next' : 'Previous' }, d > 0 ? '›' : '‹'), { position: 'absolute', top: '50%', [side]: '10px', width: '36px', height: '36px', borderRadius: '50%', border: 0, background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: '24px', cursor: 'pointer' })
    ov.append(im, x); if (list.length > 1) ov.append(nav(-1, 'left'), nav(1, 'right'))
    frame.appendChild(ov)
  }

  drawMedia(); drawCar(); drawTabs(); drawBody()
  return frame
}

export async function renderPreview(C, view) {
  view.appendChild(h('div', { class: 'pagehead' }, h('div', { class: 'eyebrow' }, 'Your listing'), h('h1', { class: 'h1' }, 'What couples see'),
    h('p', null, 'This is your card exactly as it appears in the app. Tap the photo sides to flick through, and swipe up (or scroll) for your full profile.')))
  const host = h('div'); view.appendChild(host)
  host.appendChild(h('div', { class: 'skel' }))
  const v = C.vendor
  const [H, pk, links, rv] = await Promise.all([
    computeHealth(C),
    C.sb.from('vendor_packages').select('*').eq('vendor_id', v.id).order('sort_order').then(r => (r.data || []).filter(p => p.is_active !== false)).catch(() => []),
    C.sb.from('vendor_category_links').select('category_id').eq('vendor_id', v.id).then(r => r.data || []).catch(() => []),
    C.sb.from('reviews').select('id, overall_rating, title, body, vendor_reply, created_at, couples(partner_name, users(first_name, last_name))').eq('vendor_id', v.id).eq('is_published', true).order('created_at', { ascending: false }).limit(20).then(r => r.data || []).catch(() => []),
  ])
  let slug = ''
  try {
    const ids = links.map(l => l.category_id)
    if (ids.length) { const { data } = await C.sb.from('categories').select('slug').in('id', ids).limit(1); slug = (data && data[0] && data[0].slug) || '' }
  } catch (e) { /* label is optional */ }
  clear(host)
  const wrap = h('div', { class: 'ap-stage' })
  const box = h('div', { class: 'ap-phone' })
  const inner = buildAppPreview(v, pk, slug, rv)
  box.appendChild(inner); wrap.appendChild(box)
  host.appendChild(h('div', { class: 'ap-layout' }, wrap,
    h('div', { class: 'ap-side' },
      h('div', { class: 'pv-sec' }, h('h3', { class: 'h3', style: { marginBottom: '6px' } }, 'Make it better'),
        h('p', { class: 'muted small' }, 'The first photo is your cover. Portrait photos at least 1080 × 1920 px fill the whole card. A video, if you add one, plays first.'),
        h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => C.go('profile') }, 'Edit my profile'), h('button', { class: 'btn ghost', onclick: () => C.go('packages') }, 'Edit packages'))),
      healthCard(C, H))))
  // fit the phone to narrow screens
  const fit = () => { const w = wrap.clientWidth; const s = Math.min(1, (w || W) / (W + 18)); box.style.transform = 'scale(' + s + ')'; box.style.transformOrigin = 'top center'; wrap.style.height = Math.round((HGT + 18) * s) + 'px' }
  fit(); window.addEventListener('resize', fit)
  return () => window.removeEventListener('resize', fit)
}

// Overview hero: wedding pattern, profile strength, jump to preview.
export function heroCard(C, H) {
  const v = C.vendor || {}
  const next = H.items.find(i => !i.ok)
  return h('div', { class: 'hero' },
    h('h2', { class: 'hl' }, H.pct >= 100 ? 'Your profile is complete' : 'Your profile is ' + H.pct + '% complete'),
    h('p', { class: 'hs' }, H.pct >= 100 ? 'Couples see you at your best. Keep your photos fresh and reply fast.' : 'Complete profiles get saved far more often. ' + (next ? 'Next up: ' + next.label.toLowerCase() + '.' : '')),
    h('div', { class: 'hbar' }, h('i', { style: { width: H.pct + '%' } })),
    h('div', { class: 'hrow' },
      h('button', { class: 'btn', onclick: () => C.go('preview') }, 'See what couples see'),
      next ? h('button', { class: 'btn ghost', onclick: () => { if (next.sec) C.jump = next.sec; C.go(next.route || 'profile') } }, 'Finish: ' + next.label) : null))
}
