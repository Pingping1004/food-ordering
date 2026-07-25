export default function WhatIs() {
    const features = [
      {
        icon: '📱',
        title: 'สั่งล่วงหน้า',
        desc: 'ดูเมนูและกดสั่งจากที่ไหนก็ได้ — ในห้องเรียน, ที่หอพัก หรือระหว่างเดินไป',
        color: 'bg-blue-50',
        border: 'border-blue-200',
        accent: 'text-primary-main',
      },
      {
        icon: '⚡',
        title: 'รับอาหารไวขึ้น',
        desc: 'เดินตรงไปหน้าร้านแล้วรับได้เลย อาหารเสร็จพอดีตอนที่คุณไปถึง',
        color: 'bg-yellow-50',
        border: 'border-yellow-200',
        accent: 'text-yellow-600',
      },
      {
        icon: '📡',
        title: 'ดูสถานะแบบเรียลไทม์',
        desc: 'ดูได้เลยว่าออเดอร์ถึงไหนแล้ว สั่งแล้ว → กำลังทำ → เสร็จแล้ว ไม่ต้องเดาเอาเอง',
        color: 'bg-green-50',
        border: 'border-green-200',
        accent: 'text-success-main',
      },
    ]
  
    return (
      <section id="features" className="py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-primary-main font-semibold text-sm uppercase tracking-wider">PromptServe คืออะไร?</span>
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold text-slate-900 mt-3 mb-4">
              ระบบสั่งอาหารโรงอาหาร<br />แบบใหม่<span className="text-gradient">ที่ฉลาดกว่าเดิม</span>
            </h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              PromptServe เป็นแพลตฟอร์มสั่งอาหารล่วงหน้าที่ออกแบบมาเพื่อโรงอาหารในมหาวิทยาลัยโดยเฉพาะ นิสิต/นักศึกษาสั่งล่วงหน้าได้ ร้านค้าก็จัดการออเดอร์ง่าย ทุกคนประหยัดเวลา
            </p>
          </div>
  
          {/* Flow infographic */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-0 mb-16 bg-primary-light rounded-3xl p-6 sm:p-8">
            {[
              { emoji: '📚', label: 'อยู่ในห้องเรียน', sub: 'เลือกร้านและกดสั่ง' },
              { arrow: true },
              { emoji: '🍳', label: 'ในครัว', sub: 'คุณป้ากำลังทำอาหาร' },
              { arrow: true },
              { emoji: '🏃', label: 'รับอาหาร', sub: 'หยิบแล้วไปได้เลย' },
            ].map((item, i) =>
              item.arrow ? (
                <div key={i} className="text-primary-main text-2xl sm:mx-3 rotate-90 sm:rotate-0">→</div>
              ) : (
                <div key={i} className="text-center px-4 sm:px-6">
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-md flex items-center justify-center text-2xl mx-auto mb-2">{item.emoji}</div>
                  <div className="font-display font-bold text-slate-900 text-sm">{item.label}</div>
                  <div className="text-slate-500 text-xs">{item.sub}</div>
                </div>
              )
            )}
          </div>
  
          {/* Feature cards */}
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className={`${f.color} border ${f.border} rounded-3xl p-7 card-hover`}>
                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-2xl mb-5">{f.icon}</div>
                <h3 className={`font-display text-xl font-bold ${f.accent} mb-2`}>{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }