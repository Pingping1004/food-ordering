'use client'

import { useEffect } from "react"

type Props = {
  isOpen: boolean
  onClose: () => void
}

export default function OrderBeforeLunchModal({ isOpen, onClose }: Props) {

  // Close when pressing ESC
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

      <div className="relative bg-white w-[90%] max-w-md rounded-xl shadow-xl p-8 z-[10000]">

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-black text-xl"
        >
          ✕
        </button>

        <div className="flex flex-col text-center gap-y-4">

          <h2 className="text-xl font-bold mb-2">สั่งอาหารก่อน 11:45</h2>

          <p className="text-gray-600 mb-4">กรุณาสั่งอาหารก่อนเวลา 11:45 น. เพื่อให้ร้านอาหารสามารถเตรียมอาหารของคุณได้ทันเวลา</p>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-primary-main text-white rounded-lg hover:bg-gray-800 font-bold"
          >
            เข้าใจแล้ว :)
          </button>

        </div>

      </div>
    </div>
  )
}