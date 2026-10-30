'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/auth/auth.hooks'
import { postLoginPath } from '@/auth/access'
import { THEME_KEY } from './boot'
import { ADMIN_STEPS, AUDIENCES, CONTACT_EMAIL, FAQ, HERO_LINES, ROLLOUT, SCHOOL_FEATURES, SLOGAN_LINES, SUPPORT, contactHref } from './content'
import { setupHeadline, setupIntro, setupPage, setupRail, setupScenes, setupSpiral, setupStack } from './motion'
import './landing.css'

/** Thai has no spaces, so automatic balancing splits words (ร้าน|ค้า). Headings break by hand: one phrase per span. */
const P = ({ children }: Readonly<{ children: React.ReactNode }>) => <span className="phrase">{children}</span>

function Icon({ d, size = 24, stroke = 'currentColor', width = 2 }: Readonly<{ d: string; size?: number; stroke?: string; width?: number }>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}
const CHECK = 'M20 6 9 17l-5-5'
const Check = () => <Icon d={CHECK} size={20} width={2.6} />

/** Glass navbar: fades in once the intro hands over. The toggle overrides the system light/dark and is remembered. */
function TopNav() {
  const { user } = useAuth()
  const toggleTheme = () => {
    const html = document.documentElement
    const dark = html.dataset.lpTheme ? html.dataset.lpTheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    html.dataset.lpTheme = dark ? 'light' : 'dark'
    try { localStorage.setItem(THEME_KEY, html.dataset.lpTheme) } catch { /* this visit only */ }
  }
  return (
    <header className="topnav glassy">
      <a className="brand" href="#top"><Logo size={28} className="logo" />PromptServe</a>
      <nav aria-label="เมนูหน้าแรก">
        <a href="#schools">สำหรับโรงเรียน</a>
        <a href="#support">ทีมดูแล</a>
        <a href="#how">เริ่มใช้งาน</a>
        <a href="#shops">ร้านค้า</a>
        <a href="#faq">คำถาม</a>
        <button className="theme" type="button" aria-label="สลับโหมดสว่าง/มืด" onClick={toggleTheme}>
          <svg className="moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
          <svg className="sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" /></svg>
        </button>
        {/* signed in → straight to the role's own home */}
        <Link className="login" href={user ? postLoginPath(user) : '/login'} data-lean>{user ? 'หน้าหลักของฉัน' : 'เข้าสู่ระบบ'}</Link>
      </nav>
    </header>
  )
}

/** Typed lines: the hidden ghost reserves the final size, so the layout never shifts while typing. */
function Typed({ text, id, attr }: Readonly<{ text: string; id: string; attr: 'data-type' | 'data-intro' }>) {
  return <><span className="ghost">{text}</span><span className="typed" {...{ [attr]: id }} /></>
}

/** One screen of the school admin app, inside a laptop. Drawn at 800×500 and scaled to the screen. */
function AdminView({ step }: Readonly<{ step: number }>) {
  switch (step) {
    case 0: return (
      <section className="view">
        <div className="vh"><h3>ตั้งค่าโรงอาหาร</h3></div>
        <div className="card field"><label>ชื่อโรงอาหาร</label><div className="input"><span className="type-name">โรงอาหารกลาง</span></div></div>
        <div className="card row">
          <div className="field"><label>เปิดรับออเดอร์</label><div className="input">07:30</div></div>
          <div className="field"><label>ปิดรับออเดอร์</label><div className="input">13:00</div></div>
        </div>
        <div className="card field"><label>วันที่เปิด</label><div className="days">{['จ', 'อ', 'พ', 'พฤ', 'ศ'].map((d) => <span key={d} className="day">{d}</span>)}</div></div>
        <span className="abtn press">บันทึก</span>
        <div className="toast">✓ บันทึกโรงอาหารแล้ว</div>
      </section>
    )
    case 1: return (
      <section className="view">
        <div className="vh"><h3>รหัสเชิญร้านค้า</h3><span className="abtn press" style={{ animationDelay: '.5s' }}>+ สร้างรหัสใหม่</span></div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          <span className="kind">รหัสสำหรับร้านค้า · โรงอาหารกลาง</span>
          <div className="code">{[...'PS-7K2Q9'].map((c, i) => <span key={i}>{c}</span>)}</div>
          <span style={{ color: 'var(--muted)', fontSize: 14 }}>ส่งรหัสนี้ให้ร้านค้า เพื่อสมัครเข้าโรงอาหารของโรงเรียน</span>
        </div>
        <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="thumb" style={{ background: 'var(--success-light)' }} /><span style={{ fontSize: 14 }}>แชร์ในกลุ่ม LINE ร้านค้า หรือพิมพ์เป็น QR ติดหน้าโรงอาหาร</span></div>
        <div className="toast" style={{ animationDelay: '2.4s' }}>✓ คัดลอกรหัสแล้ว</div>
      </section>
    )
    case 2: return (
      <section className="view">
        <div className="vh"><h3>ร้านค้าในโรงอาหาร</h3><span className="kind">สมัครด้วยรหัสเชิญ</span></div>
        <div className="card list">
          {[['ร้านข้าวมันไก่ป้าแดง', 'var(--orange-light)'], ['ก๋วยเตี๋ยวลุงชัย', 'var(--primary-light)'], ['มุมเครื่องดื่ม', 'var(--success-light)']].map(([name, bg]) => (
            <div key={name} className="shop"><span className="thumb" style={{ background: bg }} /><span><b>{name}</b><small>สมัครเมื่อสักครู่</small></span><span className="status"><span className="a">รออนุมัติ</span><span className="b">เปิดขายแล้ว</span></span></div>
          ))}
        </div>
      </section>
    )
    default: return (
      <section className="view">
        <div className="vh"><h3>คำร้องและความเห็น</h3><span className="tag">ไม่บังคับ</span></div>
        <div className="card list">
          {[['คำขอคืนเงิน · ออเดอร์ A42', 'ร้านปิดก่อนเวลา ยังไม่ได้รับอาหาร', 'อนุมัติคืนเงิน', 'คืนเงินแล้ว'],
            ['ความเห็นจากนักเรียน', 'อยากให้มีเมนูมังสวิรัติเพิ่ม', 'ส่งต่อร้านค้า', 'ส่งแล้ว'],
            ['ร้านค้าแจ้ง', 'ขอปิดร้านวันศุกร์นี้', 'รับทราบ', 'ตอบแล้ว']].map(([kind, text, act, done]) => (
            <div key={kind} className="req"><span><span className="kind">{kind}</span><p>{text}</p></span><span className="mini">{act}<span className="done">{done}</span></span></div>
          ))}
        </div>
      </section>
    )
  }
}

const ADMIN_NAV = ['ตั้งค่าโรงอาหาร', 'รหัสเชิญ', 'ร้านค้า', 'คำร้องและความเห็น', 'รายงาน']

function Laptop({ step }: Readonly<{ step: number }>) {
  return (
    <div className="laptop">
      <div className="lid">
        <div className="bezel">
          <div className="screen">
            <span className="cam" />
            <div className="app">
              <aside className="side">
                <div className="brand"><Logo size={28} className="logo" />PromptServe</div>
                {ADMIN_NAV.map((n, j) => <div key={n} className={j === step ? 'nav on' : 'nav'}>{n}</div>)}
              </aside>
              <div className="main"><AdminView step={step} /></div>
            </div>
          </div>
        </div>
      </div>
      <div className="base" />
      <div className="lap-shadow" />
    </div>
  )
}

type Feature = (typeof SCHOOL_FEATURES)[number]
const TONE_PILL: Record<string, string> = { ok: 'ok', warn: 'warn', bad: 'bad' }
const WEEK = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']
const BARS = [48, 70, 56, 88, 100]

/** The example content inside each bento tile, picked by the feature's `kind`. */
function TilePreview({ f }: Readonly<{ f: Feature }>) {
  const rows = f.sheets as readonly (readonly string[])[]
  switch (f.kind) {
    case 'time': return (
      <div className="bn-demo">
        <p className="bn-hours">{rows[0][0]} <b>{rows[0][1]}</b></p>
        <div className="bn-cal">{WEEK.map((d, i) => <span key={d} className={i > 2 && i !== 4 ? 'off' : undefined}>{d}</span>)}</div>
        <small>{rows[1][0]} {rows[1][1]}</small>
      </div>
    )
    case 'report': return (
      <div className="bn-demo">
        <div className="bn-kpi"><b>96%</b>ตรงเวลา</div>
        <div className="bn-bars" aria-hidden="true">{BARS.map((h) => <i key={h} style={{ '--h': `${h}%` } as CSSProperties} />)}</div>
      </div>
    )
    case 'voice': return (
      <div className="bn-demo">
        {rows.slice(0, 2).map(([t, m]) => <div key={t} className="bn-quote">{t}<small>{m}</small></div>)}
      </div>
    )
    case 'admin': return (
      <div className="bn-demo">
        {rows.slice(0, 2).map(([t, m], i) => (
          <div key={t} className="bn-row"><span className="bn-who"><span className={i ? 'bn-av b' : 'bn-av'}>{t.replace('ครู', '')[0]}</span><b>{t}</b></span><small>{m}</small></div>
        ))}
        <div className="bn-log">{rows[2][0]} {rows[2][1]}</div>
      </div>
    )
    default: return (
      <div className="bn-demo">
        {rows.map(([t, m, tone]) => (
          <div key={t} className="bn-row"><b>{t}</b><span className={`bn-pill ${TONE_PILL[tone] ?? ''}`}>{m}</span></div>
        ))}
      </div>
    )
  }
}

/** One glass tile in the school-features bento grid. */
function Tile({ f }: Readonly<{ f: Feature }>) {
  return (
    <article className={`bn-tile bn-${f.kind}`}>
      <div className="bn-head">
        <div><h3>{f.title}</h3>{f.kind !== 'time' && f.kind !== 'report' && <p>{f.body}</p>}</div>
        <span className="bn-key"><Icon d={f.icon} /></span>
      </div>
      <TilePreview f={f} />
    </article>
  )
}

const Person = ({ me }: Readonly<{ me?: boolean }>) => (
  <svg className={me ? 'pp me' : 'pp'} viewBox="0 0 16 26"><circle cx="8" cy="5" r="4.2" fill="currentColor" /><path d="M1 25v-7a7 7 0 0 1 14 0v7z" fill="currentColor" /></svg>
)

/** The motion graphic on each benefit card (animated by setupScenes). */
function Scene({ kind }: Readonly<{ kind: (typeof AUDIENCES)[number]['scene'] }>) {
  if (kind === 'crowd') return (
    <div className="scene" data-scene="crowd">
      <div className="sc-head">ความแออัดช่วงพักเที่ยง<span className="sc-legend"><span><i style={{ background: '#A9AFBC' }} />แบบเดิม</span><span><i style={{ background: '#006CFE' }} />PromptServe</span></span></div>
      <div style={{ position: 'relative' }}>
        <svg className="sc-chart" viewBox="0 0 280 112">
          <path d="M10 106H270" stroke="#E3E6EC" strokeWidth="2" />
          <path className="c-area" d="M10 104 C40 100 60 80 90 76 C120 72 160 72 190 76 C220 80 240 100 270 104 L270 106 L10 106Z" fill="#006CFE" opacity="0" />
          <path className="c-old" pathLength={1} d="M10 104 C60 103 90 100 110 70 C125 40 130 10 140 10 C150 10 155 40 170 70 C190 100 220 103 270 104" fill="none" stroke="#A9AFBC" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset="1" />
          <path className="c-new" pathLength={1} d="M10 104 C40 100 60 80 90 76 C120 72 160 72 190 76 C220 80 240 100 270 104" fill="none" stroke="#006CFE" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset="1" />
          <g className="c-peak" opacity="0"><circle cx="140" cy="10" r="5" fill="#E5484D" /><circle cx="140" cy="10" r="10" fill="#E5484D" opacity=".2" /></g>
          <path className="c-drop" d="M140 18V66" stroke="#006CFE" strokeWidth="2" strokeDasharray="3 4" opacity="0" />
        </svg>
        <span className="sc-chip" style={{ left: 'calc(50% + 14px)', top: '30%' }}>คนไม่กระจุกช่วงพีค</span>
      </div>
      <div className="sc-x"><span>11:30</span><span>12:00</span><span>12:30</span><span>13:00</span></div>
    </div>
  )
  if (kind === 'prep') return (
    <div className="scene" data-scene="prep">
      <div className="sc-head">เวลาเตรียมอาหาร</div>
      <div className="sc-row"><b>สั่งหน้าร้าน</b><div className="sc-track"><div className="sc-fill" style={{ width: '20%', background: '#A9AFBC' }}>สั้น</div></div></div>
      <div className="sc-row"><b>สั่งล่วงหน้า</b><div className="sc-track"><div className="sc-fill p-long" style={{ width: 0, background: 'linear-gradient(90deg,#FFB38F,#FF5C1A)' }}>รู้ตั้งแต่เช้า</div></div></div>
      <div className="sc-head" style={{ marginTop: 2 }}>ออเดอร์รอบ 12:10<span className="sc-legend"><span className="p-count">0 ออเดอร์</span></span></div>
      <div className="sc-tickets">
        {[['#A07', 'ข้าวกะเพราไก่ ×2'], ['#A08', 'ก๋วยเตี๋ยวเส้นเล็ก ×1'], ['#A09', 'ข้าวไข่เจียว ×3']].map(([no, item]) => (
          <div key={no} className="sc-ticket"><span className="no">{no}</span>{item}<span className="slot">12:10</span></div>
        ))}
      </div>
    </div>
  )
  return (
    <div className="scene" data-scene="queue">
      <div className="sc-head">คิวหน้าร้าน<span className="sc-legend"><span className="q-label">ต่อแถวยาว</span></span></div>
      <div className="sc-queue">
        <span className="sc-counter"><Icon d="M3 11h18M5 11V7a7 7 0 0 1 14 0v4M4 15h16v4H4z" size={20} width={2.2} /></span>
        <Person me />
        {Array.from({ length: 8 }, (_, i) => <Person key={i} />)}
      </div>
      <div className="sc-row"><b>เวลายืนรอ</b><div className="sc-track"><div className="sc-fill q-wait" style={{ width: '100%', background: '#E5484D' }}>นาน</div></div></div>
      <div className="sc-toast"><span><Icon d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" size={15} stroke="#fff" width={2.4} /></span>อาหารของคุณพร้อมรับแล้ว</div>
    </div>
  )
}

export default function Landing() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const cleanups = [setupIntro, setupHeadline, setupSpiral, setupRail, setupStack, setupScenes, setupPage].map((setup) => setup(root))
    return () => cleanups.forEach((c) => c())
  }, [])

  return (
    <div className="lp" ref={ref}>
      <div className="bgfield" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <TopNav />

      <div className="page">
        {/* Cinematic intro: the slogan types, a glass card rises and grows into the hero. Once per session; tap to skip. */}
        <div className="intro" aria-hidden="true">
          <div className="intro-pin">
            <p className="slogan">
              <span className="s1 tline"><Typed text={SLOGAN_LINES[0]} id="1" attr="data-intro" /></span>
              <span className="s2 tline"><Typed text={SLOGAN_LINES[1]} id="2" attr="data-intro" /></span>
            </p>
            <span className="scroll-hint">แตะเพื่อข้าม</span>
            <div className="reveal"><span className="reveal-mark"><Logo size={44} className="logo" />PromptServe สำหรับโรงเรียน</span></div>
          </div>
        </div>

        <section className="hero" id="top">
          <div className="wrap hero-grid">
            <div className="copy">
              <span className="pill" data-lean>ระบบโรงอาหารดิจิทัลสำหรับโรงเรียน</span>
              <h1 aria-label={HERO_LINES.join(' ')}>
                <span className="tline" aria-hidden="true"><Typed text={HERO_LINES[0]} id="1" attr="data-type" /></span>
                <span className="tline blue" aria-hidden="true"><Typed text={HERO_LINES[1]} id="2" attr="data-type" /></span>
              </h1>
              <p className="lede">นักเรียนสั่งอาหารล่วงหน้าจากมือถือ ร้านทำทันเวลาพัก ส่วนโรงเรียนตั้งค่าโรงอาหาร ชวนร้านค้าเข้าระบบ และดูแลคำร้องได้ในที่เดียว โดยมีทีม PromptServe ช่วยตั้งค่าให้</p>
              <div className="ctas">
                <a className="btn primary" href={contactHref} data-lean>นัดคุย ทดลองใช้ฟรี 1 เดือน</a>
                <Link className="btn btn-outline" href="/login" data-lean>เข้าสู่ระบบโรงเรียน</Link>
              </div>
              <Link className="student" href="/user/restaurant">นักเรียน: เริ่มสั่งอาหาร →</Link>
            </div>

            {/* Spiral of laptops, one per admin step. Auto-plays; wheel or drag inside it moves it without moving the page. */}
            <div className="stage">
              <span className="stage-hint glassy"><span className="hint-mouse">↕ เลื่อนในกรอบนี้เพื่อดูทีละขั้น</span><span className="hint-touch">↔ ปัดซ้าย-ขวาเพื่อดูทีละขั้น</span></span>
              <div className="helix" aria-hidden="true">
                {ADMIN_STEPS.map((s, i) => <Laptop key={s.title} step={i} />)}
              </div>
              <div className="glass" data-lean>
                <span className="gstep">ขั้นที่ 1 จาก 4</span>
                <span className="gtitle">{ADMIN_STEPS[0].title}</span>
                <span className="gbody">{ADMIN_STEPS[0].body}</span>
                <div className="bars" role="group" aria-label="ขั้นตอนการเริ่มใช้งาน">
                  {ADMIN_STEPS.map((s, i) => <button key={s.title} className="bar" type="button" aria-label={`ขั้นที่ ${i + 1} ${s.title}`}><i /></button>)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="features" id="schools">
          <div className="wrap">
            <span className="eyebrow">สำหรับผู้ดูแลโรงเรียน</span>
            <h2><P>โรงเรียนควบคุม</P><P>โรงอาหารได้เอง</P> <P>ทุกเรื่องอยู่ในหน้าเดียว</P></h2>
            <p className="sub">ไม่ต้องรวบรวมข้อมูลจากหลายร้าน ไม่ต้องตามเรื่องจากแชต ผู้ดูแลเห็นและตัดสินใจได้จากแดชบอร์ดของโรงเรียน</p>
            <ul className="sr">{SCHOOL_FEATURES.map((f) => <li key={f.title}>{f.title}: {f.body}</li>)}</ul>
            <div className="bento">
              {SCHOOL_FEATURES.map((f) => <Tile key={f.title} f={f} />)}
            </div>
          </div>
        </section>

        <section className="sec" id="support">
          <div className="wrap">
            <div className="panel night rv">
              <div className="support-grid">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
                  <span className="eyebrow">ทีม PromptServe ดูแลอยู่เบื้องหลัง</span>
                  <h2 style={{ margin: 0 }}><P>โรงเรียนไม่ต้องมีทีมไอที</P> <P>เราช่วยตั้งแต่วันแรก</P></h2>
                  <p style={{ margin: 0, fontSize: 18, lineHeight: 1.7 }}>ทีมงานตั้งค่าระบบ พาร้านค้าเข้าระบบ และช่วยแก้ปัญหาให้ โดยโรงเรียนยังเป็นเจ้าของข้อมูลและการตัดสินใจทั้งหมด</p>
                  <a className="btn light" href={contactHref} data-lean style={{ alignSelf: 'flex-start' }}>นัดคุยกับทีม</a>
                  <span className="mail">หรืออีเมล <b>{CONTACT_EMAIL}</b></span>
                </div>
                <ul className="glass-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))' }}>
                  {SUPPORT.map((s) => (
                    <li key={s.title} className="sitem"><Icon d={CHECK} size={20} stroke="#9DC1FF" width={2.6} /><b>{s.title}</b><span>{s.body}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits as stacking glass cards: one at a time; the page moves on only after the last card lands. */}
        <section className="sec stack-sec">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">ทุกคนในโรงอาหารได้ประโยชน์</span>
              <h2 className="grad" style={{ margin: 0 }}><P>ออกแบบให้ทั้ง</P><P>โรงเรียน</P> <P>ร้านค้า และนักเรียน</P><P>ใช้ได้จริง</P></h2>
            </div>
            <div className="stack">
              {AUDIENCES.map((a, i) => (
                <div key={a.title} className="stack-item">
                  <article className="stack-card" style={{ '--i': i, '--t1': a.tint[0], '--t2': a.tint[1] } as CSSProperties}>
                    <div className="stack-copy">
                      <span className="stack-icon"><Icon d={a.icon} size={30} /></span>
                      <h3>{a.title}</h3>
                      <ul>{a.points.map((p) => <li key={p} className="chk"><Check />{p}</li>)}</ul>
                    </div>
                    <div className="stack-art" aria-hidden="true">
                      <Scene kind={a.scene} />
                      <span className="stack-word">{a.caption}</span>
                    </div>
                  </article>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec" id="how">
          <div className="wrap">
            <div className="sec-head rv">
              <span className="eyebrow" style={{ color: 'var(--orange-text)' }}>เริ่มใช้งานที่โรงเรียน</span>
              <h2 className="grad" style={{ margin: 0 }}><P>4 ขั้นตอน</P> <P>จากนัดคุยถึงใช้งานจริง</P></h2>
            </div>
            <div className="steps-wrap rv">
              <ol className="steps">
                {ROLLOUT.map((s) => <li key={s.title} className="step gcard glassy" data-lean><h3>{s.title}</h3><p>{s.body}</p></li>)}
              </ol>
              <div className="rail" aria-hidden="true">
                <svg>
                  <path className="r-hi" transform="translate(1.6 1.6)" />
                  <path className="r-lo" transform="translate(-1.6 -1.6)" />
                  <path className="r-base" />
                  <path className="r-fill" pathLength={1} style={{ strokeDasharray: 1, strokeDashoffset: 1 }} />
                </svg>
                {ROLLOUT.map((s, i) => <span key={s.title} className="node">{i + 1}</span>)}
              </div>
            </div>
          </div>
        </section>

        <section className="sec" id="shops">
          <div className="wrap shop-grid">
            <div className="rv" style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <span className="eyebrow">สำหรับร้านค้า</span>
              <h2 className="grad" style={{ margin: 0 }}><P>ตัวใหญ่ ปุ่มใหญ่</P> <P>กดแค่ “รับ” กับ “เสร็จ”</P></h2>
              <p className="sub">ออเดอร์เข้ามามีเสียงเตือน เห็นเลขออเดอร์ เวลารับ และหมายเหตุชัดเจน ระบบตรวจสลิปให้อัตโนมัติ ไม่ต้องเช็กยอดเอง</p>
              <Link className="btn primary" href="/signup" data-lean style={{ alignSelf: 'flex-start' }}>สมัครเป็นร้านค้า</Link>
            </div>
            <div className="ticket2 glassy rv" data-tilt data-lean aria-hidden="true">
              <div className="top"><span className="code2">A42</span><span className="when">มารับเวลา<b>12:30</b></span></div>
              <span style={{ fontSize: 21 }}>2 × ข้าวกะเพราไก่ ไข่ดาว</span>
              <div className="acts"><span className="no">ปฏิเสธ</span><span className="yes">รับออเดอร์</span></div>
            </div>
          </div>
        </section>

        <section className="sec" id="faq">
          <div className="wrap">
            <div className="sec-head rv" style={{ marginInline: 'auto', maxWidth: 860 }}><h2 className="grad" style={{ margin: 0 }}>คำถามจากโรงเรียน</h2></div>
            <div className="faq">
              {FAQ.map((f) => <details key={f.q} className="glassy rv"><summary>{f.q}</summary><p>{f.a}</p></details>)}
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <div className="panel finale rv">
              <span className="halo" aria-hidden="true" />
              <h2><P>พร้อมให้โรงอาหารของโรงเรียน</P><P>ไม่ต้องต่อคิวแล้วหรือยัง?</P></h2>
              <p>ทดลองใช้ฟรี 1 เดือน ทีมงานตั้งค่าให้ทั้งหมด</p>
              <div className="ctas finale-ctas">
                <a className="btn light" href={contactHref} data-lean>นัดคุยกับทีม</a>
                <Link className="btn on-blue" href="/login" data-lean>เข้าสู่ระบบโรงเรียน</Link>
              </div>
            </div>
            <footer className="foot">
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, color: 'var(--ink)' }}><Logo size={28} className="logo" />PromptServe</span>
              <span>© 2026 PromptServe</span>
            </footer>
          </div>
        </section>
      </div>
    </div>
  )
}
