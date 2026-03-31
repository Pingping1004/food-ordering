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
      className={`relative bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-lg p-4
      ${isLargeTextMode ? "text-lg" : "text-md"} ${className}`}
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-yellow-200 bg-yellow-700 hover:bg-yellow-900 rounded-4xl px-2 py-1 text-sm"
        aria-label="Close"
      >
        ✕
      </button>

      <p>
        ⚠ ต้องกดรับออเดอร์ภายใน 5 นาที มิฉะนั้น
        <br />
        ระบบจะยกเลิกออเดอร์อัตโนมัติ
      </p>
      <p>⚠ แจ้งล่าช้าได้ภายใน 10 นาทีหลังรับออเดอร์</p>
      <p>⚠ แจ้งล่าช้าได้ภายใน 5 นาทีก่อนลูกค้าจะมารับ</p>
    </div>
  )
}