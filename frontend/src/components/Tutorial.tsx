export default function Tutorial() {
    const steps = [
      {
        step: 1,
        title: 'เปิดแอป PromptServe',
        desc: 'เข้าเว็บแอปหรือสแกนคิวอาร์โค้ดเพื่อเริ่มใช้งานผ่านเบราว์เซอร์ได้ทันที',
        screen: {
          bg: 'bg-primary-main',
          content: (
            <div className="text-center py-6 px-4">
              <div className="text-4xl mb-3">🍽️</div>
              <div className="text-white font-display font-bold text-xl">PromptServe</div>
              <div className="text-white/70 text-sm mt-1">ระบบสั่งอาหารมหาลัย</div>
              <div className="mt-4 bg-white rounded-xl px-4 py-2.5 text-primary-main font-semibold text-sm text-center">
                เริ่มต้นใช้งาน
              </div>
            </div>
          )
        }
      },
      {
        step: 2,
        title: 'เลือกร้านอาหาร',
        desc: 'ดูร้านอาหารใกล้คุณ เช็คเวลาที่ต้องรอ เมนู ก่อนตัดสินใจ',
        screen: {
          bg: 'bg-primary-light',
          content: (
            <div className="py-3 px-3 space-y-2">
              <div className="text-slate-900 font-semibold text-xs mb-2">📍 มหาวิทยาลัยของคุณ</div>
              {['โรงอาหารกลาง 🍛', 'มุมกาแฟ ☕', 'ร้านก๋วยเตี๋ยว 🍜'].map(r => (
                <div key={r} className="bg-white rounded-xl px-3 py-2 flex items-center justify-between shadow-sm">
                  <span className="text-xs font-medium text-slate-900">{r}</span>
                  <span className="text-[10px] text-success-main font-bold">เปิดอยู่</span>
                </div>
              ))}
            </div>
          )
        }
      },
      {
        step: 3,
        title: 'เลือกเมนูอาหาร',
        desc: 'เลือกอาหาร เพิ่มท็อปปิ้งหรือสั่งพิเศษตามใจชอบ แล้วกดลงตะกร้า',
        screen: {
          bg: 'bg-primary-light',
          content: (
            <div className="py-3 px-3 space-y-2">
              <div className="text-slate-900 font-semibold text-xs">🍛 โรงอาหารกลาง</div>
              {[
                { name: 'ข้าวผัดปู', price: '45 ฿' },
                { name: 'ไก่ทอด', price: '20 ฿' },
                { name: 'ชานมเย็น', price: '25 ฿' },
              ].map(item => (
                <div key={item.name} className="bg-white rounded-xl px-3 py-2 flex items-center justify-between shadow-sm">
                  <span className="text-xs font-medium text-slate-900">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">{item.price}</span>
                    <span className="text-primary-main text-sm font-bold">+</span>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      },
      {
        step: 4,
        title: 'ยืนยันการสั่งซื้อ',
        desc: 'ตรวจสอบออเดอร์และกดยืนยัน เลือกเวลาที่คุณสะดวกมารับอาหาร',
        screen: {
          bg: 'bg-primary-light',
          content: (
            <div className="py-3 px-3">
              <div className="text-slate-900 font-semibold text-xs mb-2">🛒 ออเดอร์ของคุณ</div>
              <div className="bg-white rounded-xl p-3 shadow-sm space-y-1.5 text-xs text-slate-500">
                <div className="flex justify-between"><span>ข้าวผัดปู</span><span>45 ฿</span></div>
                <div className="flex justify-between"><span>ชานมเย็น</span><span>25 ฿</span></div>
                <div className="border-t pt-1.5 flex justify-between font-bold text-slate-900"><span>รวม</span><span>70 ฿</span></div>
              </div>
              <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-primary-main font-medium">
                ⏰ เวลารับ: 12:30
              </div>
            </div>
          )
        }
      },
      {
        step: 5,
        title: 'ชำระเงิน',
        desc: 'จ่ายผ่านQR Codeทางออนไลน์ สะดวก รวดเร็ว และปลอดภัย',
        screen: {
          bg: 'bg-primary-light',
          content: (
            <div className="py-3 px-3">
              <div className="text-slate-900 font-semibold text-xs mb-3">💳 การชำระเงิน</div>
              <div className="space-y-2">
                {['ชำระผ่านQR Code'].map((m, i) => (
                  <div key={m} className={`rounded-xl px-3 py-2 flex items-center gap-2 ${i === 2 ? 'bg-primary-main text-white' : 'bg-white shadow-sm'}`}>
                    <div className={`w-3 h-3 rounded-full border-2 ${i === 2 ? 'border-white bg-white' : 'border-gray-300'}`} />
                    <span className={`text-xs font-medium ${i === 2 ? 'text-white' : 'text-slate-900'}`}>{m}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        }
      },
      {
        step: 6,
        title: 'รับอาหารของคุณ',
        desc: 'รอรับการแจ้งเตือน เดินไปที่หน้าร้าน โชว์หมายเลขออเดอร์ แล้วรับอาหารได้เลย!',
        screen: {
          bg: 'bg-green-50',
          content: (
            <div className="py-4 px-4 text-center">
              <div className="text-4xl mb-2">✅</div>
              <div className="text-success-main font-display font-bold text-base">อาหารเสร็จแล้ว!</div>
              <div className="text-slate-500 text-xs mt-1">ร้านตามสั่ง</div>
              <div className="mt-3 bg-slate-900 rounded-xl px-3 py-2">
                <div className="text-white text-xs font-mono font-bold tracking-widest">DA42</div>
              </div>
              <div className="mt-4 text-[10px] text-primary-main font-bold">โชว์หน้านี้ให้คุณป้าที่ร้านดูได้เลย</div>
            </div>
          )
        }
      },
    ]
  
    return (
      <section className="py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-primary-main font-semibold text-sm uppercase tracking-wider">ทำตามได้ง่ายๆ</span>
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold text-slate-900 mt-3">
              วิธีใช้งาน<br /><span className="text-gradient">PromptServe</span>
            </h2>
          </div>
  
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {steps.map((s) => (
              <div key={s.step} className="border border-gray-100 rounded-3xl overflow-hidden card-hover bg-white shadow-sm">
                {/* Phone screen mockup */}
                <div className={`${s.screen.bg} relative h-48 overflow-hidden`}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-40 bg-white rounded-2xl shadow-xl overflow-hidden">
                      {s.screen.content}
                    </div>
                  </div>
                  {/* Step badge */}
                  <div className="absolute top-3 left-3 bg-slate-900 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center font-display">
                    {s.step}
                  </div>
                </div>
  
                {/* Text */}
                <div className="p-5">
                  <h3 className="font-display font-bold text-slate-900 text-lg mb-1.5">{s.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }