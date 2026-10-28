import { h } from './lib.js'

const LOGO = 'https://res.cloudinary.com/dw7kndjnv/image/upload/v1782650520/Untitled_design_48_n1o4xm.png'

function niceAuthError(e) {
  const m = String((e && e.message) || '')
  if (/invalid login credentials/i.test(m)) return 'That email and password do not match. Please try again.'
  if (/email not confirmed/i.test(m)) return 'Please confirm your email first. Check your inbox for the link we sent.'
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Please wait a minute and try again.'
  if (/Failed to fetch|network/i.test(m)) return 'No connection. Check your internet and try again.'
  if (/same password/i.test(m)) return 'Choose a password you have not used before.'
  if (/at least|weak|short/i.test(m)) return 'Your password needs at least 8 characters.'
  return m || 'Something went wrong. Please try again.'
}

export function renderAuth(C, mode, notice) {
  const wrap = h('div', { class: 'main', style: { height: '100%' } })
  const box = h('div', { class: 'auth' })
  wrap.appendChild(box)
  const sb = C.sb

  const errEl = h('div', { class: 'err', role: 'alert' }, notice || '')
  if (!notice) errEl.classList.add('hidden')
  const showErr = (m) => { errEl.textContent = m; errEl.classList.remove('hidden') }

  const logo = h('img', { class: 'logo', src: LOGO, alt: 'Aisle Match' })

  if (mode === 'login') {
    const email = h('input', { class: 'input', type: 'email', autocomplete: 'username', inputmode: 'email', autocapitalize: 'none', spellcheck: 'false', placeholder: 'you@business.com.au', required: true })
    const pass = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Your password', required: true })
    const btn = h('button', { class: 'btn block', type: 'submit' }, 'Sign in')
    const form = h('form', { novalidate: true },
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Email'), email),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Password'), pass),
      errEl, btn)
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault()
      if (!email.value.trim() || !pass.value) { showErr('Enter your email and password.'); return }
      btn.disabled = true; btn.textContent = 'Signing in'
      errEl.classList.add('hidden')
      const { data, error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value })
      if (error) { btn.disabled = false; btn.textContent = 'Sign in'; showErr(niceAuthError(error)); return }
      await C.signedIn(data.session)
    })
    box.append(logo,
      h('div', { class: 'eyebrow' }, 'Vendor portal'),
      h('h1', { class: 'h1' }, 'Welcome back'),
      h('p', { class: 'muted' }, 'Sign in to manage your leads, messages and bookings.'),
      form,
      h('div', { class: 'alt' },
        h('button', { class: 'linkbtn', type: 'button', onclick: () => C.showAuth('forgot') }, 'Forgot your password?')),
      h('div', { class: 'fine' }, 'New to Aisle Match? Create your vendor account in the Aisle Match app, then come back here to sign in. Same email and password.'))
  }

  if (mode === 'forgot') {
    const email = h('input', { class: 'input', type: 'email', autocomplete: 'username', inputmode: 'email', autocapitalize: 'none', placeholder: 'you@business.com.au', required: true })
    const btn = h('button', { class: 'btn block', type: 'submit' }, 'Send reset link')
    const done = h('div', { class: 'note hidden' }, h('b', null, 'Check your inbox. '), 'If that email has an account, a reset link is on its way. It can take a minute to arrive.')
    const form = h('form', { novalidate: true }, h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Email'), email), errEl, btn, h('div', { class: 'sp16' }), done)
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault()
      if (!email.value.trim()) { showErr('Enter the email you signed up with.'); return }
      btn.disabled = true; btn.textContent = 'Sending'
      errEl.classList.add('hidden')
      const redirectTo = location.origin + location.pathname
      const { error } = await sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo })
      btn.disabled = false; btn.textContent = 'Send reset link'
      if (error && !/not found/i.test(error.message)) { showErr(niceAuthError(error)); return }
      done.classList.remove('hidden')
    })
    box.append(logo,
      h('div', { class: 'eyebrow' }, 'Vendor portal'),
      h('h1', { class: 'h1' }, 'Reset your password'),
      h('p', { class: 'muted' }, 'We will email you a link to choose a new one.'),
      form,
      h('div', { class: 'alt' }, h('button', { class: 'linkbtn', type: 'button', onclick: () => C.showAuth('login') }, 'Back to sign in')))
  }

  if (mode === 'reset') {
    const p1 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', placeholder: 'At least 8 characters' })
    const p2 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', placeholder: 'Type it again' })
    const btn = h('button', { class: 'btn block', type: 'submit' }, 'Save new password')
    const form = h('form', { novalidate: true },
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'New password'), p1),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Confirm password'), p2),
      errEl, btn)
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault()
      if (p1.value.length < 8) { showErr('Your password needs at least 8 characters.'); return }
      if (p1.value !== p2.value) { showErr('The two passwords do not match.'); return }
      btn.disabled = true; btn.textContent = 'Saving'
      const { error } = await sb.auth.updateUser({ password: p1.value })
      if (error) { btn.disabled = false; btn.textContent = 'Save new password'; showErr(niceAuthError(error)); return }
      const { data } = await sb.auth.getSession()
      history.replaceState(null, '', location.pathname)
      if (data && data.session) await C.signedIn(data.session)
      else C.showAuth('login')
    })
    box.append(logo,
      h('div', { class: 'eyebrow' }, 'Vendor portal'),
      h('h1', { class: 'h1' }, 'Choose a new password'),
      h('p', { class: 'muted' }, 'Pick something you have not used before.'),
      form)
  }
  return wrap
}
