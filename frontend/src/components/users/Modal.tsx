import { useEffect } from "react"
import { Button } from "../Button"

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm?: () => void | Promise<void>
  title: string
  body: string
  confirmText?: string
}

export default function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  body,
  confirmText = "เข้าใจแล้ว"
}: Props) {

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    if (isOpen) {
      window.addEventListener("keydown", handleEsc)
    }

    return () => {
      window.removeEventListener("keydown", handleEsc)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">

      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-[90%] max-w-md rounded-xl shadow-xl p-8 z-[10000]">

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-black text-xl"
        >
          ✕
        </button>

        <div className="flex flex-col text-center gap-y-4">

          <h2 className="text-xl font-bold">{title}</h2>

          <p className="text-secondary whitespace-pre-line text-start">{body}</p>

          <Button
            onClick={async () => {
              if (onConfirm) await onConfirm();
              onClose();
            }}
            type="button"
            variant="primary"
            size="full"
          >
            {confirmText}
          </Button>

        </div>
      </div>
    </div>
  )
}