import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Tooltip({ text, children }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState(null)
  const triggerRef = useRef(null)
  const timerRef = useRef(null)

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({
      top: rect.top - 6,
      left: rect.left + rect.width / 2,
    })
  }, [])

  const show = () => {
    timerRef.current = setTimeout(() => {
      updatePosition()
      setVisible(true)
    }, 250)
  }

  const hide = () => {
    clearTimeout(timerRef.current)
    setVisible(false)
  }

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        className="inline-flex"
      >
        {children}
      </div>
      {visible && pos && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)' }}
        >
          <div className="relative bg-[#1a1a2e] text-white px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap shadow-xl">
            {text}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-[3px] w-[6px] h-[6px] bg-[#1a1a2e] rotate-45" />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
