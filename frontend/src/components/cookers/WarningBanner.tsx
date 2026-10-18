type Props = {
  isLargeTextMode?: boolean
  onClose: () => void
  className?: string
}

export default function WarningBanner({
  isLargeTextMode = false,
  onClose,
  className = "",
}: Props) {
  return (
    <div
      role="note"
      className={`relative flex flex-col gap-1 rounded-2xl bg-[#FFF8E6] py-3.5 pl-4 pr-14 leading-snug text-brand-dark
      ${isLargeTextMode ? "text-lg" : "text-base"} ${className}`}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-xl text-[#8A5A00] hover:bg-black/5"
        aria-label="ปิดคำเตือน"
      >
        ✕
      </button>
      <p><b>กดรับภายใน 3 นาที</b> ไม่อย่างนั้นระบบจะยกเลิกให้อัตโนมัติ</p>
      <p>แจ้งล่าช้าได้ภายใน 5 นาทีหลังรับออเดอร์ และก่อนลูกค้ามารับ 5 นาที</p>
    </div>
  )
}
