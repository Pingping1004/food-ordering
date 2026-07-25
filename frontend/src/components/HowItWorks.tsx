export default function HowItWorks() {
    const steps = [
      {
        number: '01',
        icon: '🍽️',
        title: 'ดูเมนูและเลือกร้าน',
        desc: 'เปิด PromptServe ดูเมนูจากร้านต่างๆ ในโรงอาหารได้ทันที',
        color: 'bg-blue-50',
        border: 'border-blue-200',
        accent: 'bg-primary-main',
      },
      {
        number: '02',
        icon: '🛒',
        title: 'กดสั่งและเลือกเวลารับ',
        desc: 'เลือกเมนูโปรด แล้วกำหนดเวลาที่จะมารับอาหารได้เลย',
        color: 'bg-yellow-50',
        border: 'border-yellow-200',
        accent: 'bg-yellow-500',
      },
      {
        number: '03',
        icon: '🧑‍🍳',
        title: 'ร้านอาหารเตรียมให้',
        desc: 'คุณป้าที่ร้านได้รับออเดอร์ปุ๊บ ก็จะกะเวลาทำอาหารให้เสร็จพอดีตอนที่คุณมารับ',
        color: 'bg-green-50',
        border: 'border-green-200',
        accent: 'bg-success-main',
      },
      {
        number: '04',
        icon: '🎉',
        title: 'มารับอาหารและทานได้เลย',
        desc: 'มาถึงหน้าร้านตามเวลาที่เลือกไว้ รับอาหารได้เลย ไม่ต้องต่อคิวให้เสียเวลา',
        color: 'bg-blue-50',
        border: 'border-blue-200',
        accent: 'bg-blue-500',
      },
    ]
  
    return (
      <section id="how-it-works" className="py-24 px-4 sm:px-6 bg-primary-light">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-primary-main font-semibold text-sm uppercase tracking-wider">ขั้นตอนง่ายๆ</span>
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold text-slate-900 mt-3">
              วิธี<span className="text-gradient">สั่งอาหาร</span>
            </h2>
            <p className="text-slate-500 mt-4 text-lg max-w-md mx-auto">
              แค่ 4 ขั้นตอน ใช้เวลาไม่ถึงนาที อาหารก็เสร็จรอคุณอยู่
            </p>
          </div>
  
          {/* Timeline */}
          <div className="relative">
            {/* Connector line (desktop) */}
            <div className="hidden lg:block absolute top-20 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-main via-yellow-400 to-success-main mx-24" />
  
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((step, i) => (
                <div key={step.number} className="relative">
                  {/* Mobile connector */}
                  {i < steps.length - 1 && (
                    <div className="lg:hidden absolute left-10 top-20 bottom-0 w-0.5 bg-gradient-to-b from-gray-200 to-gray-100" />
                  )}
  
                  <div className={`${step.color} border ${step.border} rounded-3xl p-6 relative bg-white card-hover`}>
                    {/* Number badge */}
                    <div className={`absolute -top-3 left-5 ${step.accent} text-white text-xs font-display font-bold px-2.5 py-1 rounded-full shadow`}>
                      {step.number}
                    </div>
  
                    <div className="text-4xl mb-4 mt-2">{step.icon}</div>
                    <h3 className="font-display font-bold text-slate-900 text-xl mb-2">{step.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
  
                    {/* Arrow (desktop, between steps) */}
                    {i < steps.length - 1 && (
                      <div className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-white border border-gray-100 rounded-full shadow items-center justify-center text-primary-main z-10">
                        →
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    )
  }