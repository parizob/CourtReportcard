import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

const VIEW_MARGIN = 8

// placement:
//   "center" (default) — above, centered on trigger
//   "left" — above, prefers extending left (near right edge)
//   "right" — above, prefers extending right (near left edge)
// After open, position is clamped so the bubble never leaves the viewport.
export default function Tooltip({ text, children, placement = 'center', className = '' }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState(null)
  const [arrowOffset, setArrowOffset] = useState(null)
  const triggerRef = useRef(null)
  const bubbleRef = useRef(null)
  const timerRef = useRef(null)

  const preferredAnchor = useCallback(() => {
    if (!triggerRef.current) return null
    const rect = triggerRef.current.getBoundingClientRect()
    if (placement === 'left') {
      return { top: rect.top - 6, left: rect.right, transform: 'translate(-100%, -100%)' }
    }
    if (placement === 'right') {
      return { top: rect.top - 6, left: rect.left, transform: 'translate(0, -100%)' }
    }
    return {
      top: rect.top - 6,
      left: rect.left + rect.width / 2,
      transform: 'translate(-50%, -100%)',
    }
  }, [placement])

  const clampToViewport = useCallback(() => {
    const bubble = bubbleRef.current
    const trigger = triggerRef.current
    if (!bubble || !trigger) return

    const triggerRect = trigger.getBoundingClientRect()
    const tipRect = bubble.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let top = tipRect.top
    let left = tipRect.left

    // Prefer above; flip below if the top would clip.
    if (top < VIEW_MARGIN) {
      top = triggerRect.bottom + 6
    }
    if (top + tipRect.height > vh - VIEW_MARGIN) {
      top = Math.max(VIEW_MARGIN, vh - VIEW_MARGIN - tipRect.height)
    }

    if (left < VIEW_MARGIN) left = VIEW_MARGIN
    if (left + tipRect.width > vw - VIEW_MARGIN) {
      left = Math.max(VIEW_MARGIN, vw - VIEW_MARGIN - tipRect.width)
    }

    setPos((prev) => {
      if (
        prev &&
        prev.transform === 'none' &&
        prev.top === top &&
        prev.left === left
      ) {
        return prev
      }
      return { top, left, transform: 'none' }
    })

    const triggerCenterX = triggerRect.left + triggerRect.width / 2
    const arrowX = Math.min(
      tipRect.width - 10,
      Math.max(10, triggerCenterX - left)
    )
    setArrowOffset((prev) => (prev === arrowX ? prev : arrowX))
  }, [])

  const show = () => {
    timerRef.current = setTimeout(() => {
      const anchor = preferredAnchor()
      if (!anchor) return
      setArrowOffset(null)
      setPos(anchor)
      setVisible(true)
    }, 250)
  }

  const hide = () => {
    clearTimeout(timerRef.current)
    setVisible(false)
    setPos(null)
    setArrowOffset(null)
  }

  useLayoutEffect(() => {
    if (!visible) return
    clampToViewport()
  }, [visible, text, clampToViewport])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        className={className ? `inline-flex ${className}` : 'inline-flex'}
      >
        {children}
      </div>
      {visible && pos && createPortal(
        <div className="fixed z-[9999] pointer-events-none" style={pos}>
          <div
            ref={bubbleRef}
            // inline-block + w-max: shrink-wrap short labels (Jump / Ignore).
            // max-w: long Found → Suggest copy wraps inside the viewport.
            className="relative inline-block w-max max-w-[min(18rem,calc(100vw-1rem))] bg-[#1a1a2e] text-white px-3 py-1.5 rounded-lg text-[11px] font-medium shadow-xl whitespace-normal break-words text-left leading-snug"
          >
            {text}
            <div
              className="absolute -bottom-[3px] w-[6px] h-[6px] bg-[#1a1a2e] rotate-45"
              style={
                arrowOffset != null
                  ? { left: arrowOffset, transform: 'translateX(-50%) rotate(45deg)' }
                  : placement === 'left'
                    ? { right: 8 }
                    : placement === 'right'
                      ? { left: 12 }
                      : { left: '50%', transform: 'translateX(-50%) rotate(45deg)' }
              }
            />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
