import { createClient } from '@supabase/supabase-js'
import CSS from './style.css'
import { h, clear, icon, toast as mkToast, sheet } from './lib.js'
import { friendlyError } from './data.js'
import { renderAuth } from './auth.js'
import { renderOverview } from './overview.js'
import { renderLeads } from './leads.js'
import { renderMessages } from './messages.js'
import { renderCalendar } from './calendar.js'
import { renderRunsheet } from './runsheet.js'
import { renderProfile } from './profile.js'
import { renderPackages } from './packages.js'
import { renderReviews } from './reviews.js'
import { renderNotifications, renderSettings, renderBilling } from './more.js'

const LOGO = 'https://res.cloudinary.com/dw7kndjnv/image/upload/v1782650520/Untitled_design_48_n1o4xm.png'
const FONTS = 'https://fonts.googleapis.com/css2?family=Cormorant:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap'

const NAV = [
  { id: 'overview', label: 'Overview', short: 'Home', icon: 'home' },
  { id: 'leads', label: 'Leads', short: 'Leads', icon: 'heart' },
  { id: 'messages', label: 'Messages', short: 'Messages', icon: 'chat' },
  { id: 'calendar', label: 'Calendar', short: 'Calendar', icon: 'cal' },
  { id: 'runsheet', label: 'Runsheet', icon: 'book' },
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'packages', label: 'Packages', icon: 'box' },
  { id: 'reviews', label: 'Reviews', icon: 'star' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
  { id: 'billing', label: 'Billing', icon: 'card' },
]
const VIEWS = {
  overview: renderOverview, leads: renderLeads, messages: renderMessages, calendar: renderCalendar, runsheet: renderRunsheet,
  profile: renderProfile, packages: renderPackages, reviews: renderReviews, notifications: renderNotifications, settings: renderSettings, billing: renderBilling,
}
const OPEN_WHEN_LOCKED = ['billing', 'settings']

function boot(cfg) {
  if (!cfg || !cfg.supabaseUrl || !cfg.anonKey) { console.error('[Aisle Match portal] Missing config'); return }
  if (window.__aislePortal) return
  window.__aislePortal = true

  // fonts live at document level so the shadow tree can use them
  if (!document.querySelector('link[data-aisle-fonts]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS; l.setAttribute('data-aisle-fonts', '1')
    document.head.appendChild(l)
  }
  const prevOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'
  document.body && (document.body.style.overflow = 'hidden')

  const host = document.createElement('div')
  host.id = 'aisle-portal-host'
  Object.assign(host.style, { position: 'fixed', left: '0', right: '0', top: '0', height: '100dvh', zIndex: '2147483000', display: 'block' })
  document.body.appendChild(host)
  // hide whatever the Webflow page shows behind it
  const hideStyle = document.createElement('style')
  hideStyle.textContent = 'body > *:not(#aisle-portal-host):not(script):not(style):not(link){visibility:hidden!important}'
  document.head.appendChild(hideStyle)

  const vv = window.visualViewport
  const fit = () => {
    if (!vv) return
    host.style.height = vv.height + 'px'
    host.style.top = vv.offsetTop + 'px'
  }
  if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit() }

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style'); style.textContent = CSS
  shadow.appendChild(style)
  const root = h('div', { class: 'root' })
  shadow.appendChild(root)

  const sb = createClient(cfg.supabaseUrl, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'aislematch-portal-auth' },
  })

  const C = {
    sb, cfg, root, user: null, vendor: null, access: null, badges: { msgs: 0, notifs: 0 },
    cleanup: null, channels: [], recovering: false,
    toast: (m, bad) => mkToast(root, m, bad),
    sheet: (o) => sheet(root, o),
    go: (path) => { if (location.hash !== '#/' + path) location.hash = '#/' + path; else route() },
    immersive: (on) => root.classList.toggle('immersive', !!on),
    err: (e) => friendlyError(e),
  }

  /* ---------- session + vendor ---------- */
  async function loadVendor() {
    const { data, error } = await sb.from('vendor_profiles').select('*').eq('user_id', C.user.id).maybeSingle()
    if (error) throw error
    C.vendor = data
    if (data) {
      const r = await sb.rpc('get_vendor_access', { p_vendor_id: data.id })
      C.access = (r && r.data) || { access: 'full' }
    }
    return data
  }
  C.refreshVendor = async () => { await loadVendor(); refreshChrome() }

  async function afterSignIn(session) {
    C.user = session.user
    let v = null
    try { v = await loadVendor() } catch (e) { showAuth('login', 'We could not load your account. ' + friendlyError(e)); return }
    if (!v) { await sb.auth.signOut(); showAuth('login', 'This login does not have a vendor profile. Couples use the Aisle Match app.'); return }
    startRealtime()
    buildShell()
    refreshBadges()
    if (!location.hash || location.hash === '#' || location.hash === '#/') location.hash = '#/overview'
    route()
  }

  function showAuth(mode, notice) {
    stopRealtime(); cleanup(); root.classList.remove('immersive')
    clear(root)
    root.appendChild(renderAuth(C, mode, notice))
  }
  C.showAuth = showAuth

  C.signOut = async () => {
    stopRealtime(); cleanup()
    try { await sb.auth.signOut() } catch (e) { /* ignore */ }
    C.user = null; C.vendor = null
    location.hash = ''
    showAuth('login')
  }

  /* ---------- shell ---------- */
  let els = {}
  function navBtn(n, cls, short) {
    const b = h('button', { class: cls, 'data-id': n.id, onclick: () => C.go(n.id) }, icon(n.icon), h('span', null, short ? n.short : n.label))
    return b
  }
  function buildShell() {
    clear(root)
    const side = h('aside', { class: 'side' },
      h('div', { class: 'brand' }, h('img', { src: LOGO, alt: 'Aisle Match' })),
      h('div', { class: 'sub' }, 'Vendor portal'),
      h('nav', { 'aria-label': 'Main' }, NAV.map(n => navBtn(n, 'nav', false))),
      h('div', { class: 'foot' },
        h('div', { class: 'who' }, (C.vendor && C.vendor.business_name) || ''),
        h('button', { class: 'btn ghost sm block', onclick: C.signOut }, 'Sign out')))
    const top = h('header', { class: 'top' },
      h('div', { class: 'brand' }, h('img', { src: LOGO, alt: 'Aisle Match' })),
      h('button', { class: 'iconbtn', 'aria-label': 'Notifications', 'data-id': 'notifications', onclick: () => C.go('notifications') }, icon('bell')))
    const main = h('main', { class: 'main', id: 'main' })
    const tabs = h('nav', { class: 'tabs', 'aria-label': 'Main' },
      NAV.slice(0, 4).map(n => navBtn(n, 'tab', true)),
      h('button', { class: 'tab', 'data-id': 'more', onclick: openMore }, icon('more'), h('span', null, 'More')))
    const shell = h('div', { class: 'shell' }, top, main, tabs)
    root.appendChild(side); root.appendChild(shell)
    els = { side, top, main, tabs }
    refreshChrome()
  }

  function openMore() {
    const items = NAV.slice(4)
    const s = C.sheet({
      title: (C.vendor && C.vendor.business_name) || 'More',
      body: h('div', { class: 'menu' },
        items.map(n => h('button', { class: 'mi', onclick: () => { s.close(); C.go(n.id) } }, icon(n.icon), n.label,
          n.id === 'notifications' && C.badges.notifs ? h('span', { class: 'dot' }, String(C.badges.notifs)) : null)),
        h('button', { class: 'mi', onclick: () => { s.close(); C.signOut() } }, icon('out'), 'Sign out')),
    })
  }

  function refreshChrome() {
    if (!els.side) return
    const cur = currentId()
    const setDot = (btn, n) => {
      let d = btn.querySelector('.dot')
      if (n > 0) { if (!d) { d = h('span', { class: 'dot' }); btn.appendChild(d) } d.textContent = n > 99 ? '99+' : String(n) }
      else if (d) d.remove()
    }
    root.querySelectorAll('[data-id]').forEach(b => {
      const id = b.getAttribute('data-id')
      if (id === cur) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current')
      if (id === 'messages') setDot(b, C.badges.msgs)
      if (id === 'notifications' && b.classList.contains('nav')) setDot(b, C.badges.notifs)
    })
    const more = els.tabs && els.tabs.querySelector('[data-id="more"]')
    if (more) {
      if (['runsheet', 'profile', 'packages', 'reviews', 'notifications', 'settings', 'billing'].includes(cur)) more.setAttribute('aria-current', 'page'); else more.removeAttribute('aria-current')
      setDot(more, C.badges.notifs)
    }
  }

  async function refreshBadges() {
    if (!C.vendor) return
    try {
      const [c, n] = await Promise.all([
        sb.from('conversations').select('vendor_unread_count').eq('vendor_id', C.vendor.id).eq('is_archived_by_vendor', false),
        sb.from('vendor_notifications').select('id').eq('vendor_id', C.vendor.id).eq('is_read', false),
      ])
      C.badges.msgs = ((c.data) || []).reduce((a, r) => a + (r.vendor_unread_count || 0), 0)
      C.badges.notifs = ((n.data) || []).length
      refreshChrome()
    } catch (e) { /* badges are best effort */ }
  }
  C.refreshBadges = refreshBadges

  function startRealtime() {
    stopRealtime()
    if (!C.vendor) return
    const id = C.vendor.id
    const ch = sb.channel('portal:' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: 'vendor_id=eq.' + id }, () => { refreshBadges(); C.onConvChange && C.onConvChange() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_notifications', filter: 'vendor_id=eq.' + id }, () => { refreshBadges(); C.onNotifChange && C.onNotifChange() })
      .subscribe()
    C.channels.push(ch)
  }
  function stopRealtime() {
    C.channels.forEach(ch => { try { sb.removeChannel(ch) } catch (e) { /* ignore */ } })
    C.channels = []
  }

  /* ---------- router ---------- */
  function currentId() {
    const p = (location.hash.replace(/^#\/?/, '') || 'overview').split('/')[0]
    return VIEWS[p] ? p : 'overview'
  }
  function cleanup() {
    if (typeof C.cleanup === 'function') { try { C.cleanup() } catch (e) { /* ignore */ } }
    C.cleanup = null; C.onConvChange = null; C.onNotifChange = null
  }
  function route() {
    if (!C.user || !C.vendor || !els.main) return
    cleanup()
    const parts = (location.hash.replace(/^#\/?/, '') || 'overview').split('/')
    const id = VIEWS[parts[0]] ? parts[0] : 'overview'
    const main = els.main
    root.querySelectorAll('.scrim, .toast').forEach(n => n.remove())
    main.classList.remove('msgmode', 'rel')
    root.classList.remove('immersive')
    clear(main)
    main.scrollTop = 0
    refreshChrome()
    const locked = C.access && C.access.access === 'none' && !OPEN_WHEN_LOCKED.includes(id)
    if (locked) {
      main.appendChild(h('div', { class: 'view' },
        h('div', { class: 'pagehead' }, h('div', { class: 'eyebrow' }, 'Account'), h('h1', { class: 'h1' }, 'Your plan is not active')),
        h('div', { class: 'note bad' }, h('b', null, 'Your subscription needs attention. '), 'Choose a plan to switch your listing and leads back on.',
          h('div', { class: 'actions' }, h('button', { class: 'btn sm', onclick: () => C.go('billing') }, 'Go to billing')))))
      return
    }
    const v = h('div', { class: 'view' })
    main.appendChild(v)
    try {
      const r = VIEWS[id](C, v, parts.slice(1), main)
      if (typeof r === 'function') C.cleanup = r
      else if (r && typeof r.then === 'function') r.then(fn => { if (typeof fn === 'function') { if (currentId() === id) C.cleanup = fn; else fn() } }).catch(e => failView(v, e))
    } catch (e) { failView(v, e) }
  }
  function failView(v, e) {
    console.error('[portal]', e)
    clear(v)
    v.appendChild(h('div', { class: 'empty' }, h('h2', { class: 'h3' }, 'Something went wrong'), h('p', null, friendlyError(e)),
      h('div', { class: 'sp16' }), h('button', { class: 'btn sm', onclick: route }, 'Try again')))
  }
  window.addEventListener('hashchange', () => { if (C.user && !C.recovering) route() })

  /* ---------- auth events ---------- */
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { C.recovering = true; showAuth('reset'); return }
    if (event === 'SIGNED_OUT' && C.user) { C.user = null; C.vendor = null; showAuth('login') }
  })
  C.signedIn = async (session) => { C.recovering = false; await afterSignIn(session) }

  // first paint
  root.appendChild(h('div', { class: 'spin', role: 'status', 'aria-label': 'Loading' }))
  setTimeout(async () => {
    if (C.recovering) return
    try {
      const { data } = await sb.auth.getSession()
      if (C.recovering) return
      if (data && data.session) await afterSignIn(data.session)
      else showAuth('login')
    } catch (e) { showAuth('login') }
  }, 60)

}

window.AislePortal = { init: boot }
if (window.AISLE_PORTAL) {
  const go = () => boot(window.AISLE_PORTAL)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go()
}
