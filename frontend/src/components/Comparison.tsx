import { Fragment } from 'react'

export default function Comparison() {
  const rows = [
    { without: '🚶 เดินไปโรงอาหาร', with: '📱 สั่งล่วงหน้าตั้งแต่เลิกเรียน' },
    { without: '🧍 ยืนต่อแถวรอคิว', with: '🍳 ร้านเริ่มทำอาหารรอไว้แล้ว' },
    { without: '⏳ ยืนรอสั่งหน้าตู้', with: '🏃 แวะรับอาหารได้เลย ไม่ต้องรอ' },
    { without: '❓ ไม่รู้ว่าต้องรอนานแค่ไหน', with: '⏱️ กะเวลามารับได้เป๊ะๆ' },
  ]

  return (
    <section className="py-24 px-4 sm:px-6 bg-slate-900 overflow-hidden relative">
      {/* Decoration */}
      <div className="absolute -top-20 right-0 w-64 h-64 bg-blue-500 rounded-full opacity-5 blur-3xl" />
      <div className="absolute -bottom-20 left-0 w-64 h-64 bg-yellow-400 rounded-full opacity-5 blur-3xl" />

      <div className="max-w-4xl mx-auto relative">
        <div className="text-center mb-12">
          <span className="text-primary-main font-semibold text-sm uppercase tracking-wider">เปรียบเทียบให้เห็นชัดๆ</span>
          <h2 className="font-display text-4xl sm:text-5xl font-extrabold text-white mt-3">
            ต่อแถวแบบเดิม vs<br /><span className="text-gradient">PromptServe</span>
          </h2>
          <p className="text-white/50 mt-4">เข้าใจง่ายๆ ใน 3 วินาที</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Headers */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <div className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1">แบบเดิม (ไม่ได้ใช้แอป)</div>
            <div className="text-2xl">😩</div>
          </div>
          <div className="bg-primary-main/20 border border-primary-main/30 rounded-2xl p-4 text-center">
            <div className="text-primary-main text-xs font-semibold uppercase tracking-wider mb-1">ใช้ PromptServe</div>
            <div className="text-2xl">😎</div>
          </div>

          {/* Rows */}
          {rows.map((row, i) => (
            <Fragment key={i}>
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-xl flex-shrink-0">{row.without.split(' ')[0]}</span>
                <span className="text-white/50 text-sm">{row.without.slice(row.without.indexOf(' ') + 1)}</span>
              </div>
              <div className="bg-primary-main/10 border border-primary-main/20 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-xl flex-shrink-0">{row.with.split(' ')[0]}</span>
                <span className="text-white text-sm font-medium">{row.with.slice(row.with.indexOf(' ') + 1)}</span>
              </div>
            </Fragment>
          ))}
        </div>

        {/* Bottom stat */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-left">
            <span className="text-3xl font-display font-extrabold text-white text-gradient">18 นาที</span>
            <span className="text-white/60 text-sm">เวลาเฉลี่ยที่คุณจะประหยัดได้ต่อมื้อ<br />เมื่อใช้งาน PromptServe</span>
          </div>
        </div>
      </div>
    </section>
  )
}