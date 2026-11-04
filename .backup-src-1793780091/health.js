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
    h('span', { class: 'goic' }, i.ok ? '✓' : ''), h('span', { class: 'gol' }, i.label),
    i.ok ? null : h('button', { class: 'linkbtn', onclick: () => { if (i.sec) C.jump = i.sec; C.go(i.route || 'profile') } }, 'Fix')))
  return h('div', { class: 'sec' },
    h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'Profile health'), h('span', { class: 'small' }, H.pct + '%')),
    h('div', { class: 'bar' }, h('i', { style: { width: H.pct + '%' } })),
    H.pct < 100 ? h('div', { class: 'golist', style: { marginTop: '12px' } }, rows) : h('p', { class: 'muted small', style: { marginTop: '10px' } }, 'Your profile is complete.'))
}

// What a couple sees on the swipe card.
export function previewCard(C, H) {
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
  return h('div', { class: 'sec' },
    h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'What couples see')),
    h('p', { class: 'muted small', style: { marginBottom: '14px' } }, 'This is your card when a couple swipes through vendors in the app.'),
    card)
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
