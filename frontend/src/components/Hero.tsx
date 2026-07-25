'use client'

import { Button } from "./Button"
import { useRouter } from "next/navigation"

export default function Hero() {
  const router = useRouter();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-primary-light pt-16">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-200 rounded-full opacity-30 blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-20 -left-40 w-80 h-80 bg-yellow-200 rounded-full opacity-40 blur-3xl animate-float-delayed" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-green-100 rounded-full opacity-20 blur-3xl" />
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: 'linear-gradient(#FF5C1A 1px, transparent 1px), linear-gradient(90deg, #FF5C1A 1px, transparent 1px)', backgroundSize: '60px 60px'}} />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-primary-main text-xs font-semibold px-3 py-1.5 rounded-full mb-6 animate-fade-in">
              <span className="w-1.5 h-1.5 bg-primary-main rounded-full animate-pulse" />
              สั่งอาหารโรงอาหารล่วงหน้า
            </div>

            {/* Headline */}
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 leading-[1.05] tracking-tight mb-6">
              ข้ามคิวไปเลย<br />
              ด้วยการ<span className="text-gradient">สั่งล่วงหน้า</span><br />
              <span className="relative inline-block">
                ไม่ต้องรอ
                <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 12" fill="none">
                  <path d="M2 8 Q50 2 100 8 Q150 14 198 8" stroke="#FFD700" strokeWidth="3" strokeLinecap="round" fill="none"/>
                </svg>
              </span>
            </h1>

            {/* Sub */}
            <p className="text-lg text-slate-500 leading-relaxed mb-8 max-w-md mx-auto lg:mx-0 font-body">
              สั่งอาหารจากโรงอาหารมหาลัยก่อนไปถึง พอทำเสร็จก็แวะรับได้เลย ไม่ต้องยืนต่อคิวให้เมื่อยอีกต่อไป
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Button type="button" size="lg" onClick={() => router.push("/user/restaurant")}>เริ่มสั่งอาหารเลย</Button>

              <a
                href="#how-it-works"
                className="group border-2 border-slate-900/10 text-slate-900 font-semibold px-7 py-4 rounded-2xl hover:border-primary-main hover:text-primary-main transition-all flex items-center justify-center gap-2 bg-white/60"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ดูวิธีใช้งาน
              </a>
            </div>

            {/* Trust badge */}
            <div className="flex items-center gap-3 mt-10 justify-center lg:justify-start animate-fade-in" style={{animationDelay: '0.4s'}}>
              <div className="flex items-center gap-3 px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-default">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                  TU
                </div>
                <div className="text-left">
                  <div className="text-[11px] text-slate-500 font-medium tracking-wide">ออกแบบและพัฒนาเพื่อ</div>
                  <div className="text-sm font-extrabold text-slate-900">นักศึกษามหาวิทยาลัยธรรมศาสตร์</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Phone mockup */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative animate-float">
              {/* Phone */}
              <div className="relative w-64 sm:w-72 bg-slate-900 rounded-[3rem] p-3 shadow-2xl shadow-black/30">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-slate-900 rounded-b-2xl z-10" />
                <div className="bg-primary-light rounded-[2.4rem] overflow-hidden" style={{aspectRatio:'9/19.5'}}>
                  {/* Status bar */}
                  <div className="bg-primary-main px-5 pt-8 pb-5">
                    <div className="text-white/70 text-xs font-body">สวัสดีตอนบ่าย Mike 👋</div>
                    <div className="text-white font-display font-bold text-xl mt-1">วันนี้กินอะไรดี?</div>
                    <div className="mt-3 bg-white/20 backdrop-blur rounded-xl px-3 py-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span className="text-white/70 text-xs">ค้นหาร้านอาหาร, เมนู...</span>
                    </div>
                  </div>
                  {/* Content */}
                  <div className="px-3 py-3 space-y-3">
                    <div className="text-xs font-semibold text-slate-500 font-body">ร้านใกล้คุณ</div>
                    {[
                      { name: 'ร้านตามสั่ง', time: '8–12 นาที', emoji: '🍛', color: 'bg-blue-50', tag: 'ตามสั่ง' },
                      { name: 'ร้านน้ำ', time: '4–6 นาที', emoji: '☕', color: 'bg-amber-50', tag: 'เครื่องดื่ม' },
                      { name: 'ร้านก๋วยเตี๋ยว', time: '10–15 นาที', emoji: '🍜', color: 'bg-yellow-50', tag: '' },
                    ].map((r) => (
                      <div key={r.name} className={`${r.color} rounded-2xl p-2.5 flex items-center gap-2.5 cursor-pointer hover:shadow-md transition-shadow`}>
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm flex-shrink-0">{r.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-900 font-body truncate">{r.name}</div>
                          <div className="text-[10px] text-slate-500">รอประมาณ {r.time}</div>
                        </div>
                        {r.tag && (
                          <span className="text-[9px] font-bold bg-primary-main text-white px-1.5 py-0.5 rounded-full">{r.tag}</span>
                        )}
                      </div>
                    ))}

                    {/* Order tracking card */}
                    <div className="bg-slate-900 rounded-2xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white text-[11px] font-semibold font-body">ออเดอร์ของคุณ DA42</span>
                        <span className="text-success-main text-[10px] font-bold bg-green-900/40 px-2 py-0.5 rounded-full">กำลังทำ</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {['สั่งแล้ว','กำลังทำ','เสร็จแล้ว','รับแล้ว'].map((step, i) => (
                          <div key={step} className="flex items-center flex-1">
                            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${i <= 1 ? 'bg-primary-main' : 'bg-white/20'}`} />
                            {i < 3 && <div className={`flex-1 h-0.5 ${i < 1 ? 'bg-primary-main' : 'bg-white/20'}`} />}
                          </div>
                        ))}
                      </div>
                      <div className="text-white text-[9px] mt-1 text-center">คาดว่าเสร็จเวลา: 12:35</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <div className="absolute -left-12 top-20 bg-white rounded-2xl shadow-xl px-3 py-2 flex items-center gap-2 animate-float-delayed">
                <span className="text-lg">⚡</span>
                <div>
                  <div className="text-xs font-bold text-slate-900">ประหยัดเวลา 18 นาที</div>
                  <div className="text-[10px] text-slate-500">วันนี้</div>
                </div>
              </div>
              <div className="absolute -right-10 bottom-32 bg-white rounded-2xl shadow-xl px-3 py-2 flex items-center gap-2 animate-float">
                <span className="text-lg">✅</span>
                <div>
                  <div className="text-xs font-bold text-slate-900">อาหารเสร็จแล้ว!</div>
                  <div className="text-[10px] text-slate-500">โรงอาหารกลาง</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce opacity-50">
        <span className="text-xs text-slate-500 font-body">เลื่อนลง</span>
        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </section>
  )
}