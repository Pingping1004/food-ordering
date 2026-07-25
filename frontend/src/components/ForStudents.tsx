export default function ForStudents() {
    const benefits = [
      { emoji: '🚫', title: 'ไม่ต้องรอคิวนานๆ', desc: 'ไม่ต้องรอคิว 20 นาทีอีกต่อไป เดินเข้ามา หยิบอาหาร แล้วไปต่อได้เลย' },
      { emoji: '⏰', title: 'ประหยัดเวลาระหว่างคาบ', desc: 'เอาเวลาพักไปพักผ่อน ไม่ใช่ไปยืนต่อแถวซื้อข้าว' },
      { emoji: '🔔', title: 'รู้ทันทีเมื่ออาหารเสร็จ', desc: 'มีแจ้งเตือนทันทีที่อาหารเสร็จพร้อมรับ' },
      { emoji: '🎯', title: 'กะเวลาได้เป๊ะๆ', desc: 'ไม่ต้องลุ้นช่วงพักเที่ยงอีกต่อไป รู้เลยว่าต้องรอกี่นาที' },
    ]
  
    return (
      <section className="py-24 px-4 sm:px-6 bg-primary-light">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <span className="text-primary-main font-semibold text-sm uppercase tracking-wider">สำหรับนักศึกษา</span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl font-extrabold text-slate-900 text-center mb-3">
            ประหยัดเวลา<br /><span className="text-gradient">เอาไปทำอย่างอื่นได้อีกเยอะ</span>
          </h2>
          <p className="text-slate-500 text-center text-lg mb-14 max-w-xl mx-auto">
            ทุกนาทีมีค่า PromptServe คืนเวลาพักเที่ยงให้คุณ
          </p>
  
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {benefits.map((b, i) => (
              <div
                key={b.title}
                className="bg-white border border-gray-100 rounded-3xl p-6 card-hover group"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl mb-5 group-hover:bg-blue-100 transition-colors">{b.emoji}</div>
                <h3 className="font-display font-bold text-slate-900 text-lg mb-2">{b.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
  
          {/* Student testimonial strip */}
          <div className="mt-10 bg-primary-main/5 border border-blue-100 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-300 to-blue-400 flex items-center justify-center text-2xl flex-shrink-0">🧑‍🎓</div>
            <div>
              <p className="text-slate-900 font-medium italic text-lg">
                {`"เมื่อก่อนต้องรอนานต้องมานั่งต่อแถว เดี๋ยวนี้สั่งไว้ก่อนลงมาพัก เลิกเรียนปุ๊บก็เดินไปรับได้เลย สะดวกขึ้นเยอะค่ะ"`}
              </p>
              <div className="mt-2 text-slate-500 text-sm">นักศึกษาปี 2</div>
            </div>
          </div>
        </div>
      </section>
    )
  }