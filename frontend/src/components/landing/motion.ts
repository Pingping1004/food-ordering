/**
 * Imperative motion for the landing page. Each setup takes the page root, wires its part, and returns a cleanup that
 * stops every timer, frame loop, listener and observer (React runs effects twice in development).
 * Everything here only animates what the markup already renders; with reduced motion each part shows its end state.
 */
import { INTRO_SEEN_KEY } from './boot'
import { ADMIN_STEPS, HERO_LINES, SLOGAN_LINES } from './content'

type Cleanup = () => void

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const $ = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T
const $$ = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => [...root.querySelectorAll(sel)] as T[]

/** Thai stacks vowels and tone marks on a consonant: type whole grapheme clusters, never half a syllable. */
const graphemes = (s: string) => {
  try { return [...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(s)].map((g) => g.segment) }
  catch { return Array.from(s) }
}
const caret = (color?: string) => `<span class="caret"${color ? ` style="background:${color}"` : ''}></span>`

/** setTimeout-based sleep whose pending timers are all cancelled by stop(); a stopped coroutine simply never resumes. */
function timers() {
  const ids = new Set<number>()
  return {
    sleep: (ms: number) => new Promise<void>((resolve) => { const id = window.setTimeout(() => { ids.delete(id); resolve() }, ms); ids.add(id) }),
    stop: () => { ids.forEach(clearTimeout); ids.clear() },
  }
}

/** A requestAnimationFrame loop that can be cancelled. */
function frames(fn: (now: number) => void) {
  let id = requestAnimationFrame(function loop(now) { fn(now); id = requestAnimationFrame(loop) })
  return () => cancelAnimationFrame(id)
}

/* ---------- hero headline: types, holds, erases, forever ---------- */
export function setupHeadline(root: HTMLElement): Cleanup {
  const [el1, el2] = [$(root, '[data-type="1"]'), $(root, '[data-type="2"]')]
  const [L1, L2] = HERO_LINES.map(graphemes)
  if (reduced()) { el1.textContent = HERO_LINES[0]; el2.textContent = HERO_LINES[1]; return () => undefined }
  const t = timers()
  ;(async () => {
    for (;;) {
      for (let i = 0; i <= L1.length; i++) { el1.innerHTML = L1.slice(0, i).join('') + caret(); el2.textContent = ''; await t.sleep(85) }
      el1.textContent = HERO_LINES[0]
      for (let i = 0; i <= L2.length; i++) { el2.innerHTML = L2.slice(0, i).join('') + caret(); await t.sleep(85) }
      await t.sleep(2600)
      for (let i = L2.length; i >= 0; i--) { el2.innerHTML = L2.slice(0, i).join('') + caret(); await t.sleep(32) }
      el2.textContent = ''
      for (let i = L1.length; i >= 0; i--) { el1.innerHTML = L1.slice(0, i).join('') + caret(); await t.sleep(32) }
      await t.sleep(450)
    }
  })()
  return t.stop
}

/* ---------- cinematic intro: slogan types, a glass card rises and fills the screen, then dissolves into the hero ---------- */
export function setupIntro(root: HTMLElement): Cleanup {
  const html = document.documentElement
  const finish = () => { html.classList.remove('lp-intro-lock'); html.classList.add('lp-nav-on') }
  let seen = html.classList.contains('lp-intro-seen')
  try { seen ||= sessionStorage.getItem(INTRO_SEEN_KEY) === '1' } catch { /* storage blocked: play it */ }
  if (seen || reduced()) { html.classList.add('lp-intro-seen'); finish(); return () => undefined }

  const intro = $(root, '.intro'), pin = intro.firstElementChild as HTMLElement
  const reveal = $(root, '.reveal'), slogan = $(root, '.slogan'), hint = $(root, '.scroll-hint'), mark = $(root, '.reveal-mark')
  const [i1, i2] = [$(root, '[data-intro="1"]'), $(root, '[data-intro="2"]')]
  const [S1, S2] = SLOGAN_LINES.map(graphemes)
  const ease = (x: number) => 1 - Math.pow(1 - x, 3)
  const t = timers(), ac = new AbortController()
  let skip = false, raf = 0

  function frame(p: number) {
    const vw = intro.clientWidth, vh = pin.clientHeight
    const rise = ease(clamp01(p / 0.35)), grow = ease(clamp01((p - 0.3) / 0.6))
    const w0 = Math.min(560, vw * 0.78), h0 = Math.min(320, vh * 0.4)
    const y = (1 - rise) * (vh * 0.75) + (1 - grow) * (vh * 0.22)
    reveal.style.width = `${w0 + (vw + 2 - w0) * grow}px`
    reveal.style.height = `${h0 + (vh + 2 - h0) * grow}px`
    reveal.style.borderRadius = `${28 * (1 - grow)}px`
    reveal.style.transform = `translate(-50%, calc(-50% + ${y}px))`
    mark.style.opacity = String(1 - clamp01((grow - 0.4) / 0.4))
    pin.style.setProperty('--clear', String(1 - clamp01((grow - 0.55) / 0.45)))
    const fade = clamp01((p - 0.18) / 0.4)
    slogan.style.opacity = String(1 - fade)
    slogan.style.filter = `blur(${fade * 10}px)`
    slogan.style.transform = `translateY(${-fade * 60}px) scale(${1 - fade * 0.08})`
    hint.style.visibility = p > 0.02 ? 'hidden' : 'visible'
  }

  html.classList.add('lp-intro-lock')
  scrollTo(0, 0)
  frame(0)
  for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown']) addEventListener(type, () => { skip = true }, { passive: true, signal: ac.signal })
  const wait = (ms: number) => (skip ? Promise.resolve() : t.sleep(ms))

  ;(async () => {
    await wait(350)
    for (let i = 0; i <= S1.length; i++) { i1.innerHTML = S1.slice(0, i).join('') + caret(); await wait(95) }
    i1.textContent = SLOGAN_LINES[0]
    await wait(180)
    for (let i = 0; i <= S2.length; i++) { i2.innerHTML = S2.slice(0, i).join('') + caret('#0052C2'); await wait(95) }
    for (let k = 0; k < 18 && !skip; k++) await t.sleep(50)              // a short hold, cut short by a skip
    const dur = skip ? 700 : 2400, t0 = performance.now()
    await new Promise<void>((done) => {
      raf = requestAnimationFrame(function f(now) {
        const p = Math.min(1, (now - t0) / dur)
        frame(p)
        if (p < 1) raf = requestAnimationFrame(f); else done()
      })
    })
    intro.classList.add('done')
    finish()
    try { sessionStorage.setItem(INTRO_SEEN_KEY, '1') } catch { /* plays again next time */ }
    await t.sleep(900)
    html.classList.add('lp-intro-seen')
  })()

  return () => { t.stop(); cancelAnimationFrame(raf); ac.abort(); html.classList.remove('lp-intro-lock') }
}

/* ---------- hero spiral: one laptop per admin step on a vertical helix; auto-plays, and the visitor can scroll it ---------- */
export function setupSpiral(root: HTMLElement): Cleanup {
  const N = ADMIN_STEPS.length, STEP_MS = 5600, reduce = reduced()
  const stage = $(root, '.stage'), helix = $(root, '.helix')
  const laptops = $$(helix, '.laptop'), views = laptops.map((l) => $(l, '.view'))
  const apps = laptops.map((l) => $(l, '.app')), screens = laptops.map((l) => $(l, '.screen'))
  const bars = $$<HTMLButtonElement>(root, '.bars .bar'), fills = bars.map((b) => $(b, 'i'))
  const gstep = $(root, '.gstep'), gtitle = $(root, '.gtitle'), gbody = $(root, '.gbody')
  const ac = new AbortController(), on = { signal: ac.signal }
  const mod = (x: number) => ((x % N) + N) % N
  let step = -1, started = performance.now(), cur = reduce ? 0 : -1.2  // starts below the first laptop: spirals in on load
  let target = 0, userUntil = 0, snapTimer = 0

  const ro = new ResizeObserver(() => apps.forEach((a, i) => { a.style.transform = `scale(${screens[i].clientWidth / 800})` }))
  ro.observe(screens[0])

  function setActive(i: number) {                                   // what the front laptop and the glass card show
    if (i === step) return
    step = i
    views.forEach((v, j) => { v.classList.remove('on'); if (j === i) { void v.offsetWidth; v.classList.add('on') } })
    fills.forEach((f, j) => { f.style.width = j < i ? '100%' : '0' })
    const s = ADMIN_STEPS[i]
    gstep.innerHTML = `ขั้นที่ ${i + 1} จาก ${N}` + ('optional' in s ? ' <span class="opt">ไม่บังคับ</span>' : '')
    gtitle.textContent = s.title
    gbody.textContent = s.body
  }
  function goTo(i: number) {                                         // auto-play and the bars always spiral forward
    const base = Math.round(target)
    target = base + mod(i - mod(base))
    setActive(i)
    started = performance.now()
  }
  function nudge(delta: number) {                                    // wheel/drag inside the stage moves the spiral, not the page
    target += delta
    userUntil = performance.now() + 3500                            // auto-play waits while the visitor is in control
    setActive(mod(Math.round(target)))
    clearTimeout(snapTimer)
    snapTimer = window.setTimeout(() => { target = Math.round(target); started = performance.now() }, 320)
  }
  function place() {
    const gapY = helix.clientHeight * 0.21
    laptops.forEach((el, k) => {
      let d = ((k - cur) % N + N) % N; if (d > N / 2) d -= N        // −2 … 2: <0 already shown (above), >0 coming (below)
      const a = Math.abs(d)
      const op = d < 0 ? Math.max(0, 1 + d * 1.6) : Math.max(0, 1 - Math.max(0, d - 1.4) * 1.6)
      el.style.transform = `translateX(-50%) translateY(${d * gapY}px) rotateY(${-d * 38}deg) rotateZ(${d * 4}deg) scale(${1 - Math.min(a, 2) * 0.16})`
      el.style.opacity = op.toFixed(3)
      el.style.zIndex = String(20 - Math.round(a * 5))
      el.style.setProperty('--dim', (Math.min(1, a) * 0.28).toFixed(3))
    })
  }

  bars.forEach((b, i) => b.addEventListener('click', () => goTo(i), on))
  goTo(0)
  let stopFrames: Cleanup = () => undefined
  if (reduce) place()
  else stopFrames = frames((now) => {
    cur += (target - cur) * 0.085
    if (now < userUntil) started = now                             // hold the timer while scrolled by hand
    const p = Math.min(1, (now - started) / STEP_MS)
    fills[step].style.width = `${p * 100}%`
    if (p >= 1) goTo(mod(step + 1))
    place()
  })
  document.addEventListener('visibilitychange', () => { if (!document.hidden) started = performance.now() }, on)

  stage.addEventListener('wheel', (e) => {
    e.preventDefault()
    nudge((Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) / 380)
  }, { passive: false, signal: ac.signal })
  let drag: { id: number; x: number; y: number; touch: boolean } | null = null
  helix.addEventListener('pointerdown', (e) => {
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' }
    helix.setPointerCapture(e.pointerId)
    helix.classList.add('dragging')
  }, on)
  helix.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    drag.x = e.clientX; drag.y = e.clientY
    nudge(drag.touch ? -dx / 200 : -dy / 220)                      // touch: swipe left = next (vertical swipes scroll the page)
  }, on)
  const endDrag = () => { drag = null; helix.classList.remove('dragging') }
  helix.addEventListener('pointerup', endDrag, on)
  helix.addEventListener('pointercancel', endDrag, on)

  return () => { stopFrames(); ac.abort(); ro.disconnect(); clearTimeout(snapTimer) }
}

/* ---------- 4-step rail: a neumorphic groove through the step numbers, filled in primary blue from 1 to 4, looping ---------- */
export function setupRail(root: HTMLElement): Cleanup {
  const wrap = $(root, '.steps-wrap'), steps = $$(wrap, '.step')
  const paths = $$<SVGPathElement>(wrap, '.rail path'), fill = paths[3], nodes = $$(wrap, '.node')
  let thr = [0, 1 / 3, 2 / 3, 1]
  function geom() {
    const ol = steps[0].parentElement as HTMLElement
    const stacked = steps[0].offsetLeft === steps[1].offsetLeft       // one column: the rail runs in the left gutter
    const pts = steps.map((el) => {
      const x = ol.offsetLeft + el.offsetLeft, y = ol.offsetTop + el.offsetTop
      return stacked ? { x: x - 34, y: y + 44 } : { x: x + 46, y: y + 46 }
    })
    const d = 'M' + pts.map((p) => `${p.x} ${p.y}`).join(' L')
    paths.forEach((p) => p.setAttribute('d', d))
    nodes.forEach((n, i) => { n.style.left = `${pts[i].x}px`; n.style.top = `${pts[i].y}px` })
    const seg = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y)), total = seg.reduce((a, b) => a + b, 0) || 1
    let acc = 0
    thr = [0, ...seg.map((l) => (acc += l) / total)]
  }
  const ro = new ResizeObserver(geom)
  ro.observe(wrap)
  geom()
  const set = (t: number) => { fill.style.strokeDashoffset = String(1 - t); nodes.forEach((n, i) => n.classList.toggle('on', t >= thr[i] - 0.002)) }
  if (reduced()) { set(1); return () => ro.disconnect() }

  const FILL = 4200, HOLD = 1300, RESET = 600, CYCLE = FILL + HOLD + RESET
  let visible = false, t0 = 0
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !visible) t0 = performance.now(); visible = e.isIntersecting }, { threshold: 0.35 })
  io.observe(wrap)
  const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)
  const stop = frames((now) => {
    if (!visible) return
    const k = (now - t0) % CYCLE
    if (k < FILL) { set(ease(k / FILL)); fill.style.opacity = '1' }
    else if (k < FILL + HOLD) set(1)
    else { fill.style.opacity = String(1 - (k - FILL - HOLD) / RESET); nodes.forEach((n, i) => i && n.classList.remove('on')) }
  })
  return () => { stop(); ro.disconnect(); io.disconnect() }
}

/* ---------- stacking cards: as the next card slides in, the one it covers shrinks back, blurs and fades out ---------- */
export function setupStack(root: HTMLElement): Cleanup {
  const cards = $$(root, '.stack-card')
  if (reduced() || !cards.length) return () => undefined
  let queued = 0
  function frame() {
    queued = 0
    const vh = innerHeight
    cards.forEach((c, i) => {
      const next = cards[i + 1]
      const over = next ? clamp01(1 - (next.getBoundingClientRect().top - parseFloat(getComputedStyle(next).top)) / (vh * 0.6)) : 0
      c.style.transform = over ? `scale(${(1 - over * 0.12).toFixed(4)}) translateY(${(-over * 24).toFixed(1)}px)` : ''
      c.style.opacity = over ? (1 - over).toFixed(3) : ''
      c.style.filter = over ? `blur(${(over * 6).toFixed(2)}px)` : ''
      c.style.visibility = over >= 0.999 ? 'hidden' : ''
    })
  }
  const ac = new AbortController()
  addEventListener('scroll', () => { if (!queued) queued = requestAnimationFrame(frame) }, { passive: true, signal: ac.signal })
  addEventListener('resize', frame, { signal: ac.signal })
  frame()
  return () => { ac.abort(); cancelAnimationFrame(queued) }
}

/* ---------- benefit scenes: short looping motion graphics, animated only while on screen ---------- */
export function setupScenes(root: HTMLElement): Cleanup {
  const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
  const seg = (t: number, a: number, b: number) => ease(clamp01((t - a) / (b - a)))
  const scenes: Record<string, (el: HTMLElement, t: number) => void> = {
    crowd(el, t) {   // the old lunch spike draws, then the PromptServe curve spreads the same crowd across the break
      const old = $(el, '.c-old'), next = $(el, '.c-new')
      old.setAttribute('stroke-dashoffset', String(1 - seg(t, 0.04, 0.32)))   // unitless: attribute, not style
      old.style.opacity = String(1 - 0.55 * seg(t, 0.4, 0.6))
      $(el, '.c-peak').style.opacity = String(seg(t, 0.28, 0.34) * (1 - 0.6 * seg(t, 0.4, 0.6)))
      next.setAttribute('stroke-dashoffset', String(1 - seg(t, 0.4, 0.68)))
      $(el, '.c-area').style.opacity = String(0.14 * seg(t, 0.55, 0.75))
      $(el, '.c-drop').style.opacity = String(seg(t, 0.68, 0.74))
      $(el, '.sc-chip').classList.toggle('on', t > 0.72)
    },
    prep(el, t) {    // the pre-order bar grows to the full morning, then the 12:10 round fills up ticket by ticket
      $(el, '.p-long').style.width = `${100 * seg(t, 0.06, 0.36)}%`
      $$(el, '.sc-ticket').forEach((k, i) => { const v = seg(t, 0.42 + i * 0.1, 0.5 + i * 0.1); k.style.opacity = String(v); k.style.transform = `translateX(${(1 - v) * 28}px)` })
      $(el, '.p-count').textContent = `${Math.round(12 * seg(t, 0.42, 0.76))} ออเดอร์`
    },
    queue(el, t) {   // the line in front of you thins out, the wait bar shrinks, then the "ready" notification arrives
      $$(el, '.pp:not(.me)').reverse().forEach((p, i) => { const v = seg(t, 0.2 + i * 0.045, 0.26 + i * 0.045); p.style.opacity = String(1 - v); p.style.transform = `translateY(${-v * 14}px)` })
      const w = seg(t, 0.22, 0.6), wait = $(el, '.q-wait')
      wait.style.width = `${100 - 78 * w}%`
      wait.style.background = w > 0.5 ? '#15803D' : '#E5484D'
      wait.textContent = w > 0.5 ? 'สั้น' : 'นาน'
      $(el, '.q-label').textContent = w > 0.5 ? 'สั่งล่วงหน้า มารับตามเวลา' : 'ต่อแถวยาว'
      $(el, '.sc-toast').classList.toggle('on', t > 0.66)
    },
  }
  const els = $$(root, '[data-scene]')
  const run = (el: HTMLElement, t: number) => scenes[el.dataset.scene as string](el, t)
  if (reduced()) { els.forEach((el) => run(el, 0.9)); return () => undefined }
  const DUR = 7000, live = new Map<HTMLElement, number>()           // scene → when it came on screen, so each starts from the top
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const el = e.target as HTMLElement
    if (e.isIntersecting) { if (!live.has(el)) live.set(el, performance.now()) } else live.delete(el)
  }))
  els.forEach((el) => { io.observe(el); run(el, 0) })
  const stop = frames((now) => live.forEach((t0, el) => {
    const t = (Math.max(0, now - t0) % DUR) / DUR
    run(el, t)
    el.style.opacity = String(t > 0.95 ? 1 - (t - 0.95) / 0.05 : t < 0.03 ? t / 0.03 : 1)
  }))
  return () => { stop(); io.disconnect() }
}

/* ---------- page-wide: background hue drifts with scroll, glass highlight follows the pointer, gentle 3D tilt ---------- */
export function setupPage(root: HTMLElement): Cleanup {
  const ac = new AbortController(), on = { signal: ac.signal }
  const field = $(root, '.bgfield')
  const hue = () => {
    const max = document.documentElement.scrollHeight - innerHeight
    field.style.setProperty('--p', (max > 0 ? scrollY / max : 0).toFixed(3))
  }
  addEventListener('scroll', hue, { passive: true, signal: ac.signal })
  hue()
  root.addEventListener('pointermove', (e) => {
    const el = (e.target as Element).closest?.('[data-lean]') as HTMLElement | null
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`)
  }, { passive: true, signal: ac.signal })
  if (!reduced() && matchMedia('(pointer: fine)').matches) {
    $$(root, '[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
        el.style.transform = `perspective(900px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg) translateZ(6px)`
      }, on)
      el.addEventListener('pointerleave', () => { el.style.transform = '' }, on)
    })
  }
  return () => ac.abort()
}
