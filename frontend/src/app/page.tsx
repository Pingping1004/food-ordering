import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { Logo } from '@/components/Logo'

const previewShops = [
  { name: 'ร้านตามสั่ง', wait: 'รอ ~8–12 นาที', tile: 'bg-brand-orange-light' },
  { name: 'ร้านก๋วยเตี๋ยว', wait: 'รอ ~10–15 นาที', tile: 'bg-primary-light' },
  { name: 'มุมเครื่องดื่ม', wait: 'รอ ~4–6 นาที', tile: 'bg-success-light' },
]

const audiences = [
  { title: 'นักเรียน', tile: 'bg-primary-light text-primary-dark', icon: 'M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5',
    points: ['สั่งจากห้องเรียน ไม่ต้องยืนต่อแถว', 'เลือกเวลารับ รู้ว่าอาหารจะพร้อมกี่โมง', 'แจ้งเตือนทันทีเมื่ออาหารเสร็จ'] },
  { title: 'ร้านค้า', tile: 'bg-brand-orange-light text-brand-orange-text', icon: 'M6 13.9A4 4 0 0 1 8 6.1a5 5 0 0 1 8 0 4 4 0 0 1 2 7.8V21H6zM6 17h12',
    points: ['รู้ล่วงหน้าว่าต้องทำอะไร ไม่ฉุกละหุก', 'ตัวอักษรใหญ่ ปุ่มใหญ่ มีเสียงเตือน', 'ระบบตรวจสลิปและยอดเงินให้'] },
  { title: 'โรงเรียน', tile: 'bg-success-light text-success-main', icon: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6',
    points: ['ดูภาพรวมโรงอาหารรายสัปดาห์', 'จัดการร้านค้า เวลาเปิด และวันหยุด', 'ไม่เปิดเผยข้อมูลส่วนตัวนักเรียน'] },
]

const steps = [
  { n: 1, title: 'เลือกร้านและเมนู', body: 'เปิดเว็บจากมือถือ เห็นเวลารอของแต่ละร้านทันที' },
  { n: 2, title: 'เลือกเวลารับ', body: 'เลือกเวลาที่จะไปถึง ร้านจะทำให้เสร็จพอดี' },
  { n: 3, title: 'จ่ายผ่าน QR', body: 'สแกนจ่าย แล้วส่งสลิป ระบบตรวจให้อัตโนมัติ' },
  { n: 4, title: 'เดินไปรับได้เลย', body: 'แสดงเลขออเดอร์ให้ร้านดู แล้วรับอาหาร' },
]

const schoolStats = [
  { label: 'ออเดอร์ต่อสัปดาห์', value: '[X]' },
  { label: 'นักเรียนที่ใช้งาน', value: '[X]%' },
  { label: 'ออเดอร์สำเร็จ', value: '[X]%' },
  { label: 'เวลาที่ประหยัดได้', value: '[X] นาที' },
]

const faq = [
  { q: 'ต้องโหลดแอปไหม?', a: 'ไม่ต้อง PromptServe เป็นเว็บแอป สแกน QR หรือเปิดลิงก์จากมือถือก็ใช้ได้เลย' },
  { q: 'เลือกเวลารับอาหารได้ไหม?', a: 'ได้ เลือกเวลาที่สะดวกตอนยืนยันออเดอร์ ร้านจะทำให้เสร็จพอดี' },
  { q: 'ร้านรับออเดอร์อย่างไร?', a: 'ร้านเห็นออเดอร์บนมือถือพร้อมเสียงเตือน กดรับแล้วเริ่มทำได้ทันที' },
  { q: 'ยกเลิกหรือขอคืนเงินได้ไหม?', a: 'ถ้าร้านไม่รับออเดอร์ ระบบจะยกเลิกให้ และคุณกดขอคืนเงินได้จากหน้าออเดอร์' },
  { q: 'มีค่าใช้จ่ายไหม?', a: 'ช่วงทดลองใช้ ทั้งนักเรียนและร้านค้าใช้ได้ฟรี' },
]

const section = 'mx-auto max-w-[1200px] px-6 py-14 md:py-24'
const eyebrow = 'text-sm font-bold tracking-[0.06em]'
const h2 = 'text-[28px] md:text-[40px] font-bold leading-[1.3]'
const btnPrimary = 'flex h-14 items-center rounded-2xl bg-primary-main px-6 text-[17px] font-bold text-white hover:bg-primary-dark'

export default function Home() {
  return (
    <main className="bg-white font-app text-brand-dark">
      <Navbar />

      <section id="top" className="bg-[#F5F8FF]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-12 px-6 py-10 md:py-24">
          <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-[22px]">
            <span className="self-start rounded-full border border-[#C9D7F2] bg-white px-3.5 py-1.5 text-sm font-semibold text-primary-dark">
              ระบบสั่งอาหารล่วงหน้าสำหรับโรงอาหารโรงเรียน
            </span>
            <h1 className="text-[clamp(36px,5.5vw,64px)] font-bold leading-[1.2] tracking-tight">
              ข้ามคิวไปเลย<br />ด้วยการสั่งล่วงหน้า<br /><span className="text-primary-main">ไม่ต้องรอ</span>
            </h1>
            <p className="max-w-[560px] text-[clamp(17px,1.6vw,20px)] leading-[1.7] text-[#344054]">
              สั่งจากห้องเรียน ร้านทำให้ทันเวลาพัก แล้วเดินไปรับได้เลย ร้านค้าใช้ง่าย ตัวอักษรใหญ่ ส่วนโรงเรียนเห็นภาพรวมโรงอาหารทุกสัปดาห์
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/user/restaurant" className={btnPrimary}>เริ่มสั่งอาหาร</Link>
              <a href="#schools" className="flex h-14 items-center rounded-2xl border-[1.5px] border-brand-dark px-6 text-[17px] font-semibold hover:bg-white">
                นัดคุยสำหรับโรงเรียน
              </a>
            </div>
          </div>

          <div aria-hidden="true" className="flex min-w-0 flex-[1_1_340px] justify-center">
            <div className="flex w-[300px] flex-col overflow-hidden rounded-[36px] border-[10px] border-brand-dark bg-ground">
              <div className="flex flex-col gap-1 bg-primary-main px-[18px] py-5 text-white">
                <span className="text-[13px] opacity-90">โรงอาหารกลาง</span>
                <span className="text-xl font-bold">วันนี้กินอะไรดี?</span>
              </div>
              <div className="flex flex-col gap-2.5 p-3.5">
                <div className="flex flex-col gap-1 rounded-[14px] border-[1.5px] border-primary-main bg-white p-3">
                  <span className="text-[13px] font-bold">ออเดอร์ A42 · กำลังทำ</span>
                  <span className="h-1.5 rounded-full bg-primary-light"><span className="block h-full w-[62%] rounded-full bg-primary-main" /></span>
                  <span className="text-xs text-brand-muted">พร้อมรับประมาณ 12:28</span>
                </div>
                {previewShops.map((m) => (
                  <div key={m.name} className="flex items-center gap-2.5 rounded-[14px] bg-white p-3">
                    <span className={`h-10 w-10 rounded-[10px] ${m.tile}`} />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold">{m.name}</span>
                      <span className="text-xs text-brand-muted">{m.wait}</span>
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-2.5 rounded-[14px] bg-success-main p-3 text-white">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                  <span className="text-sm font-bold">อาหารพร้อมแล้ว! รับที่ล็อก 5</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${section} flex flex-col gap-8`}>
        <div className="flex max-w-[720px] flex-col gap-2.5">
          <span className={`${eyebrow} text-primary-dark`}>ทุกคนในโรงอาหารได้ประโยชน์</span>
          <h2 className={h2}>ออกแบบให้ทั้งนักเรียน ร้านค้า และโรงเรียนใช้ได้จริง</h2>
        </div>
        <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {audiences.map((a) => (
            <article key={a.title} className="flex flex-col gap-4 rounded-3xl border border-line-soft bg-white p-7">
              <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${a.tile}`}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={a.icon} /></svg>
              </span>
              <h3 className="text-[22px] font-bold">{a.title}</h3>
              <ul className="flex flex-col gap-2.5">
                {a.points.map((p) => (
                  <li key={p} className="flex gap-2.5 text-base leading-[1.55]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-[3px] shrink-0"><path d="M20 6 9 17l-5-5" /></svg>
                    {p}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="bg-brand-light">
        <div className={`${section} flex flex-col gap-8`}>
          <div className="flex flex-col gap-2.5">
            <span className={`${eyebrow} text-brand-orange-text`}>วิธีใช้งาน</span>
            <h2 className={h2}>4 ขั้นตอน ไม่ต้องโหลดแอป</h2>
          </div>
          <ol className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
            {steps.map((s) => (
              <li key={s.n} className="flex flex-col gap-3 rounded-[20px] border border-[#F1E6D6] bg-white p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-orange text-lg font-bold text-brand-dark">{s.n}</span>
                <h3 className="text-[19px] font-bold">{s.title}</h3>
                <p className="text-base leading-[1.6] text-[#344054]">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="shops" className={`${section} flex flex-wrap items-center gap-12`}>
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
          <span className={`${eyebrow} text-primary-dark`}>สำหรับร้านค้า</span>
          <h2 className={h2}>ตัวใหญ่ ปุ่มใหญ่ กดแค่ “รับ” กับ “เสร็จ”</h2>
          <p className="text-lg leading-[1.7] text-[#344054]">
            ออเดอร์เข้ามามีเสียงเตือน เห็นเลขออเดอร์ เวลารับ และหมายเหตุชัดเจน ระบบตรวจสลิปให้อัตโนมัติ ไม่ต้องเช็กยอดเอง
          </p>
          <Link href="/signup" className={`${btnPrimary} self-start`}>สมัครเป็นร้านค้า</Link>
        </div>
        <div aria-hidden="true" className="flex min-w-0 max-w-[440px] flex-[1_1_360px] flex-col gap-4 rounded-3xl border-2 border-brand-orange bg-white p-6">
          <div className="flex items-start justify-between">
            <span className="text-[40px] font-bold leading-none">A42</span>
            <span className="flex flex-col items-end">
              <span className="text-[15px] text-brand-muted">มารับเวลา</span>
              <span className="text-[30px] font-bold text-primary-dark">12:30</span>
            </span>
          </div>
          <span className="text-[21px]">2 × ข้าวกะเพราไก่ ไข่ดาว</span>
          <div className="flex gap-3">
            <span className="flex h-16 flex-1 items-center justify-center rounded-2xl border-2 border-line text-xl font-semibold">ปฏิเสธ</span>
            <span className="flex h-16 flex-[2] items-center justify-center rounded-2xl bg-primary-main text-[22px] font-bold text-white">รับออเดอร์</span>
          </div>
        </div>
      </section>

      <section id="schools" className="bg-brand-dark text-white">
        <div className={`${section} flex flex-wrap items-center gap-12`}>
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
            <span className={`${eyebrow} text-[#9DB8E8]`}>สำหรับโรงเรียน</span>
            <h2 className={h2}>โครงสร้างพื้นฐานดิจิทัลของโรงอาหาร พร้อมรายงานทุกสัปดาห์</h2>
            <p className="text-lg leading-[1.7] text-line">
              ทดลองใช้ฟรี 1 เดือน ดูข้อมูลจริงก่อนตัดสินใจ ทั้งจำนวนผู้ใช้ ความตรงเวลา และความเห็นนักเรียน โดยไม่เปิดเผยข้อมูลส่วนตัว
            </p>
            <Link href="/login" className="flex h-14 items-center self-start rounded-2xl bg-white px-6 text-[17px] font-bold text-brand-dark hover:bg-ground">
              เข้าสู่ระบบโรงเรียน
            </Link>
          </div>
          <div aria-hidden="true" className="grid min-w-0 flex-[1_1_380px] grid-cols-2 gap-3.5">
            {schoolStats.map((k) => (
              <div key={k.label} className="flex flex-col gap-1.5 rounded-[18px] bg-[#2A2A2E] p-5">
                <span className="text-sm text-line">{k.label}</span>
                <span className="text-[30px] font-bold">{k.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto flex max-w-[880px] flex-col gap-6 px-6 py-14 md:py-24">
        <h2 className={h2}>คำถามที่พบบ่อย</h2>
        <div className="flex flex-col gap-3">
          {faq.map((f) => (
            <details key={f.q} className="rounded-2xl border border-line-soft bg-white px-5 py-1">
              <summary className="flex min-h-14 cursor-pointer items-center text-[17px] font-bold">{f.q}</summary>
              <p className="pb-[18px] text-base leading-[1.7] text-[#344054]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-line-soft">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-6 py-7 text-sm text-brand-muted">
          <div className="flex items-center gap-2.5">
            <Logo size={24} />
            <span className="font-bold text-brand-dark">PromptServe</span>
          </div>
          <span>© 2026 PromptServe</span>
        </div>
      </footer>
    </main>
  )
}
