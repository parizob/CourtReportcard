import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

// placement: "center" (default) | "left" (anchors to right edge, extends left)
export default function Tooltip({ text, children, placement = 'center' }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState(null)
  const triggerRef = useRef(null)
  const timerRef = useRef(null)

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    if (placement === 'left') {
      setPos({ top: rect.top - 6, left: rect.right })
    } else {
      setPos({ top: rect.top - 6, left: rect.left + rect.width / 2 })
    }
  }, [placement])

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

  const style = placement === 'left'
    ? { top: pos?.top, left: pos?.left, transform: 'translate(-100%, -100%)' }
    : { top: pos?.top, left: pos?.left, transform: 'translate(-50%, -100%)' }

  const arrowClass = placement === 'left'
    ? 'absolute right-2 -bottom-[3px] w-[6px] h-[6px] bg-[#1a1a2e] rotate-45'
    : 'absolute left-1/2 -translate-x-1/2 -bottom-[3px] w-[6px] h-[6px] bg-[#1a1a2e] rotate-45'

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
        <div className="fixed z-[9999] pointer-events-none" style={style}>
          <div className="relative bg-[#1a1a2e] text-white px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap shadow-xl">
            {text}
            <div className={arrowClass} />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
