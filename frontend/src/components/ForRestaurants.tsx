export default function ForRestaurants() {
    const benefits = [
      { emoji: '📋', title: 'รู้ล่วงหน้าว่าต้องทำอะไร', desc: 'รับออเดอร์ล่วงหน้าได้ ไม่ต้องฉุกละหุกช่วงพักเที่ยง' },
      { emoji: '🧘‍♀️', title: 'ลดความวุ่นวายหน้าร้าน', desc: 'ลูกค้าไม่ต้องมายืนออหน้าร้าน ลดความกดดันตอนทำอาหาร' },
      { emoji: '📈', title: 'รับลูกค้าได้มากขึ้น', desc: 'เพิ่มยอดขายได้สบายๆ เพราะจัดการคิวได้ดีขึ้น' },
      { emoji: '📱', title: 'ใช้งานง่าย ไม่ซับซ้อน', desc: 'ระบบออกแบบมาให้ใช้งานง่าย คนทำอาหารดูออเดอร์ได้สบายๆ ตัวหนังสือใหญ่ชัดเจน' },
    ]
  
    return (
      <section className="py-24 px-4 sm:px-6 bg-primary-light">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <span className="text-primary-main font-semibold text-sm uppercase tracking-wider">สำหรับร้านค้า</span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl font-extrabold text-slate-900 text-center mb-3">
            จัดการร้านง่ายขึ้น<br /><span className="text-gradient">ยอดขายเพิ่มขึ้น</span>
          </h2>
          <p className="text-slate-500 text-center text-lg mb-14 max-w-xl mx-auto">
            ไม่ต้องปวดหัวกับคิวหน้าร้าน รับออเดอร์ง่าย ทำอาหารได้ลื่นไหลกว่าเดิม
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
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-300 to-blue-400 flex items-center justify-center text-2xl flex-shrink-0">🧑‍🍳</div>
            <div>
              <p className="text-slate-900 font-medium italic text-lg">
                {`"ตั้งแต่ใช้ระบบนี้ จัดการออเดอร์ช่วงพักเที่ยงได้สบายขึ้นเยอะ ไม่ต้องกดดันรีบทำออเดอร์ ส่วนลูกค้าก็ชอบเพราะไม่ต้องรอนาน"`}
              </p>
              <div className="mt-2 text-slate-500 text-sm">พนักงานร้านอาหารที่ศูนย์อาหาร</div>
            </div>
          </div>
        </div>
      </section>
    )
  }