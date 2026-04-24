import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

function TopProgressBar() {
  const location = useLocation()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(true)
  const intervalRef = useRef(null)
  const finishRef = useRef(null)
  const hideRef = useRef(null)

  useEffect(() => {
    function clearTimers() {
      clearInterval(intervalRef.current)
      clearTimeout(finishRef.current)
      clearTimeout(hideRef.current)
    }

    clearTimers()
    setVisible(true)
    setProgress(14)

    intervalRef.current = setInterval(() => {
      setProgress((current) => {
        if (current >= 84) {
          return current
        }

        return Math.min(current + (current < 50 ? 11 : 5), 84)
      })
    }, 110)

    finishRef.current = setTimeout(() => {
      clearInterval(intervalRef.current)
      setProgress(100)

      hideRef.current = setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 220)
    }, 520)

    return clearTimers
  }, [location.key, location.pathname])

  return (
    <div
      className={`top-progress-bar ${visible ? 'is-visible' : ''}`}
      style={{ transform: `scaleX(${progress / 100})` }}
    />
  )
}

export default TopProgressBar
