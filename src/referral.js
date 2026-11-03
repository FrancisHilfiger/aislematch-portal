import { h, fmtDate } from './lib.js'

// "Refer a vendor, get a free month" card for the vendor dashboard.
// Reads the vendor's own code and referrals (row level security limits this to their own rows).
export async function referralCard(C) {
  const v = C.vendor
  if (!v || !v.id) return null
  const { data: code } = await C.sb.from('referral_codes')
    .select('id, code, is_founding_vendor, max_free_months, free_months_earned, free_months_applied')
    .eq('vendor_profile_id', v.id).maybeSingle()
  if (!code) return null
  const { data: evs } = await C.sb.from('referral_events')
    .select('referred_business, status, signed_up_at, first_payment_at')
    .eq('referrer_code_id', code.id).order('created_at', { ascending: false }).limit(20)
  const list = evs || []
  const waiting = list.filter((e) => e.status === 'pending')
  const earned = code.free_months_earned || 0
  const applied = code.free_months_applied || 0
  const waitingApply = Math.max(0, earned - applied)
  const cap = code.is_founding_vendor ? null : (code.max_free_months || 3)
  const stat = (n, l) => h('div', { class: 'stat' }, h('div', { class: 'n' }, String(n)), h('div', { class: 'l' }, l))

  const copy = h('button', { class: 'btn sm ghost', type: 'button' }, 'Copy')
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(code.code); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy' }, 1800) } catch (e) { copy.textContent = 'Press and hold the code to copy' }
  }

  const label = (e) => e.status === 'pending' ? 'Signed up. Your free month arrives when they make their first payment.'
    : e.status === 'credited' ? 'Paid. You earned a free month.' : 'Paid. You have reached the free month limit.'
  const tone = (e) => e.status === 'credited' ? 'ok' : e.status === 'pending' ? 'warn' : ''

  return h('div', { class: 'sec refcard' },
    h('div', { class: 'sechead' }, h('h2', { class: 'h2' }, 'Refer a vendor, get a free month')),
    h('p', { class: 'refsub' }, 'Every time a vendor you refer makes their first payment, you earn one month free. ' + (cap ? 'You can earn up to ' + cap + ' free months.' : 'As a founding vendor there is no limit.')),
    h('div', { class: 'refcode' }, h('div', null, h('div', { class: 'refcap' }, 'Your referral code'), h('div', { class: 'refval' }, code.code)), copy),
    h('div', { class: 'stats' }, stat(earned, cap ? 'Free months earned (of ' + cap + ')' : 'Free months earned'), stat(waiting.length, 'Referred, waiting on first payment')),
    waiting.length ? h('div', { class: 'note' }, h('b', null, waiting.length === 1 ? '1 vendor you referred has signed up. ' : waiting.length + ' vendors you referred have signed up. '), 'You will get a free month for each one as soon as they make their first payment.') : null,
    waitingApply > 0 ? h('div', { class: 'note ok' }, h('b', null, waitingApply === 1 ? 'You have 1 free month waiting. ' : 'You have ' + waitingApply + ' free months waiting. '), 'It will be applied as soon as you make a payment.') : null,
    list.length ? h('div', { class: 'list', style: { borderTop: '0', marginTop: '12px' } }, list.slice(0, 6).map((e) =>
      h('div', { class: 'item' }, h('div', { class: 'body' }, h('div', { class: 't' }, e.referred_business || 'A vendor you referred'), h('div', { class: 's' }, label(e))),
        h('span', { class: 'tag ' + tone(e) }, e.status === 'pending' ? 'Waiting' : e.status === 'credited' ? 'Earned' : 'Paid')))) : null)
}
