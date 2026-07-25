'use client'
import { useState } from 'react'

const faqs = [
  {
    q: 'ต้องโหลดแอปมั้ย?',
    a: 'สำหรับการสั่งอาหารทั่วไปไม่ต้องโหลด! PromptServe เป็นเว็บแอปพลิเคชัน แค่สแกนคิวอาร์โค้ดหรือคลิกลิงก์ผ่านมือถือก็ใช้งานได้เลย ไม่เปลืองพื้นที่เครื่อง',
  },
  {
    q: 'สั่งอาหารล่วงหน้าได้มั้ย?',
    a: 'ได้แน่นอน! คุณสามารถสั่งล่วงหน้าได้ แล้วยังสามารถเลือกเวลาที่จะมารับ',
  },
  {
    q: 'ร้านอาหารรับออเดอร์ยังไง?',
    a: 'คร้านจะได้รับออเดอร์ผ่านหน้าจอในครัว สามารถกดรับออเดอร์ และลูกค้าจะต้องชำระเงินหลังร้านรับออเดอร์',
  },
  {
    q: 'ยกเลิกออเดอร์ได้มั้ย?',
    a: 'คุณสามารถยกเลิกได้ผ่านการไม่ชำระเงินในช่วงเวลาที่กำหนด และร้านจะยังไม่เริ่มทำอาหาร',
  },
  {
    q: 'ใช้งานฟรีหรือเปล่า?',
    a: 'ใช่! ตอนนี้ทั้งร้านอาหารและนิสิตนักศึกษาสามารถใช้งานได้ฟรี 100% จนกว่าจะมีการเปลี่ยนแปลงจากทางPromptserveหรือมหาลัย',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="faq" className="py-24 px-4 sm:px-6 bg-primary-light">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-primary-main font-semibold text-sm uppercase tracking-wider">FAQ</span>
          <h2 className="font-display text-4xl sm:text-5xl font-extrabold text-slate-900 mt-3">
            คำถาม<span className="text-gradient">ที่พบบ่อย</span>
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className={`bg-white border rounded-2xl overflow-hidden transition-all ${open === i ? 'border-primary-main shadow-md shadow-blue-100' : 'border-gray-100 hover:border-blue-200'}`}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left"
              >
                <span className="font-semibold text-slate-900 text-base pr-4">{faq.q}</span>
                <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${open === i ? 'bg-primary-main text-white rotate-45' : 'bg-gray-100 text-slate-500'}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12M6 12h12" />
                  </svg>
                </span>
              </button>

              <div className={`accordion-content ${open === i ? 'open' : ''}`}>
                <div className="px-6 pb-5 text-slate-500 text-sm leading-relaxed border-t border-gray-50 pt-3">
                  {faq.a}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">
            ยังมีข้อสงสัยเพิ่มเติม?{' '}
            <a href="mailto:piyatanakj@gmail.com" className="text-primary-main font-semibold hover:underline">
              ติดต่อเรา →
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}