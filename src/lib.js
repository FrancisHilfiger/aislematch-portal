// Small DOM helpers. Text is always inserted as text nodes, never as HTML.
export function h(tag, props, ...kids) {
  const el = document.createElement(tag)
  if (props) {
    for (const k of Object.keys(props)) {
      const v = props[k]
      if (v === null || v === undefined || v === false) continue
      if (k === 'class') el.className = v
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v)
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v)
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected' || k === 'src' || k === 'href') el[k] = v
      else el.setAttribute(k, v === true ? '' : String(v))
    }
  }
  add(el, kids)
  return el
}
function add(el, kids) {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue
    if (Array.isArray(k)) add(el, k)
    else if (k instanceof Node) el.appendChild(k)
    else el.appendChild(document.createTextNode(String(k)))
  }
}
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild) }

// Icons are constant strings defined here, never user data.
const P = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z',
  chat: 'M4 5.5h16v10.5H9.5L5 19.5V16H4z',
  cal: 'M4 6.5h16V20H4zM4 10.5h16M8.5 4v4M15.5 4v4',
  more: 'M4.5 12a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0M10.9 12a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0M17.3 12a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0',
  user: 'M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c.8-3.6 3.6-5.5 7.5-5.5s6.7 1.9 7.5 5.5',
  box: 'M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4zM3.5 7.5 12 11.5l8.5-4M12 11.5v9',
  bell: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5h4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.3 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  card: 'M3 6.5h18v11H3zM3 10.5h18',
  out: 'M10 4.5H5v15h5M14.5 8.5 18 12l-3.5 3.5M18 12H9',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  chev: 'M9 5l7 7-7 7',
  back: 'M15 5l-7 7 7 7',
  send: 'M4 12 20 4l-5 16-3.5-6.5z',
  img: 'M3.5 5.5h17v13h-17zM3.5 16l5-5 4 4 3-3 5 5M9 9.5h.01',
  trash: 'M5 7h14M10 4h4M7 7l.8 12.5h8.4L17 7M10.5 11v5M13.5 11v5',
  book: 'M5 4.5h11a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
  chevd: 'M6 9l6 6 6-6',
  star: 'M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.9 6.9 19.5l1-5.7-4.1-4 5.7-.8z',
  attach: 'M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L15 7',
  tick: 'M5 12.5 10 17.5 19 7',
}
export function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  s.setAttribute('viewBox', '0 0 24 24')
  s.setAttribute('fill', 'none')
  s.setAttribute('stroke', 'currentColor')
  s.setAttribute('stroke-width', '1.5')
  s.setAttribute('stroke-linecap', 'round')
  s.setAttribute('stroke-linejoin', 'round')
  s.setAttribute('aria-hidden', 'true')
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  p.setAttribute('d', P[name] || P.more)
  s.appendChild(p)
  return s
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export { MON, MONL }
export function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
export function today() { return ymd(new Date()) }
export function fmtDate(iso) {
  if (!iso) return 'Date not set yet'
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (!y) return 'Date not set yet'
  return d + ' ' + MON[m - 1] + ' ' + y
}
export function fmtMoney(n) {
  if (n === null || n === undefined || n === '') return ''
  return '$' + Number(n).toLocaleString('en-AU', { maximumFractionDigits: 2 })
}
export function ago(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  if (s < 86400) return Math.floor(s / 3600) + 'h'
  if (s < 86400 * 7) return Math.floor(s / 86400) + 'd'
  const d = new Date(iso)
  return d.getDate() + ' ' + MON[d.getMonth()]
}
export function clock(iso) {
  const d = new Date(iso)
  let hh = d.getHours(); const mm = String(d.getMinutes()).padStart(2, '0')
  const ap = hh >= 12 ? 'pm' : 'am'
  hh = hh % 12 || 12
  return hh + ':' + mm + ap
}
export function initial(name) { return (String(name || '?').trim()[0] || '?').toUpperCase() }
export function daysUntil(iso) {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

// Cloudinary delivery: smaller, auto format. Leaves any other URL alone.
export function img(url, w) {
  if (!url) return ''
  const m = String(url).match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/)
  if (!m) return url
  if (/^(f_|q_|w_|c_)/.test(m[2])) return url
  return m[1] + 'f_auto,q_auto,w_' + (w || 600) + ',c_limit/' + m[2]
}

let toastTimer = null
export function toast(root, msg, bad) {
  const old = root.querySelector('.toast')
  if (old) old.remove()
  const t = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status' }, msg)
  root.appendChild(t)
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.remove(), bad ? 4500 : 2400)
}

// Bottom sheet on phones, centred dialog on larger screens.
export function sheet(root, { title, body, footer, onClose }) {
  const scrim = h('div', { class: 'scrim' })
  const close = () => { scrim.remove(); document.removeEventListener('keydown', esc); onClose && onClose() }
  const esc = (e) => { if (e.key === 'Escape') close() }
  document.addEventListener('keydown', esc)
  scrim.addEventListener('click', (e) => { if (e.target === scrim) close() })
  const sb = h('div', { class: 'sb' }, body)
  const box = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' },
    h('div', { class: 'grab' }),
    h('div', { class: 'sh' }, h('h2', { class: 'h3' }, title || ''), h('button', { class: 'iconbtn', 'aria-label': 'Close', onclick: close }, icon('x'))),
    sb,
    footer ? h('div', { class: 'sf' }, footer) : null)
  scrim.appendChild(box)
  root.appendChild(scrim)
  return { close, el: box, body: sb }
}

export function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), input, hint ? h('div', { class: 'hint' }, hint) : null)
}

export function toggle(on, onChange, label) {
  const b = h('button', { class: 'switch', role: 'switch', 'aria-checked': String(!!on), 'aria-label': label || 'Toggle', type: 'button' })
  b.addEventListener('click', () => {
    const next = b.getAttribute('aria-checked') !== 'true'
    b.setAttribute('aria-checked', String(next))
    onChange(next)
  })
  return b
}

export const LOGO = 'https://res.cloudinary.com/dw7kndjnv/image/upload/v1782650520/Untitled_design_48_n1o4xm.png'

// Branded date picker. Drop-in for <input type="date">: has .value (YYYY-MM-DD), .min, and fires 'change'.
export function datePicker(opts) {
  const o = opts || {}
  let val = o.value || '', minV = o.min || '', open = false
  const start = (val || today()).split('-').map(Number)
  let vy = start[0], vm = start[1] - 1
  const DOWS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const label = h('span', { class: 'dp-label' })
  const trig = h('button', { class: 'input dp-trig', type: 'button', 'aria-haspopup': 'dialog' }, label, icon('cal'))
  const panel = h('div', { class: 'dp-panel hidden' })
  const wrap = h('div', { class: 'dp' }, trig, panel)
  const pad = (n) => String(n).padStart(2, '0')
  const paintLabel = () => { label.textContent = val ? fmtDate(val) : (o.placeholder || 'Choose a date'); label.classList.toggle('ph', !val) }
  const paintPanel = () => {
    clear(panel)
    const first = new Date(vy, vm, 1), lead = (first.getDay() + 6) % 7, dim = new Date(vy, vm + 1, 0).getDate(), t = today()
    panel.appendChild(h('div', { class: 'dp-head' },
      h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Previous month', onclick: () => { vm--; if (vm < 0) { vm = 11; vy-- } paintPanel() } }, icon('back')),
      h('div', { class: 'dp-title' }, MONL[vm] + ' ' + vy),
      h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Next month', onclick: () => { vm++; if (vm > 11) { vm = 0; vy++ } paintPanel() } }, icon('chev'))))
    const grid = h('div', { class: 'dp-grid' }, DOWS.map(d => h('div', { class: 'dp-dow' }, d)))
    for (let i = 0; i < lead; i++) grid.appendChild(h('div'))
    for (let d = 1; d <= dim; d++) {
      const key = vy + '-' + pad(vm + 1) + '-' + pad(d)
      const dis = !!minV && key < minV
      grid.appendChild(h('button', { class: 'dp-day' + (key === val ? ' sel' : '') + (key === t ? ' today' : ''), type: 'button', disabled: dis, 'aria-label': fmtDate(key),
        onclick: () => { val = key; open = false; paintAll(); wrap.dispatchEvent(new Event('change')) } }, String(d)))
    }
    panel.appendChild(grid)
  }
  const paintAll = () => { paintLabel(); panel.classList.toggle('hidden', !open); trig.setAttribute('aria-expanded', String(open)); if (open) paintPanel() }
  trig.addEventListener('click', () => {
    open = !open
    if (open) { const b = (val || minV || today()).split('-').map(Number); vy = b[0]; vm = b[1] - 1 }
    paintAll()
  })
  wrap.addEventListener('click', (e) => e.preventDefault())
  Object.defineProperty(wrap, 'value', { get: () => val, set: (v) => { val = v || ''; paintAll() } })
  Object.defineProperty(wrap, 'min', { get: () => minV, set: (v) => { minV = v || ''; paintAll() } })
  paintAll()
  return wrap
}
