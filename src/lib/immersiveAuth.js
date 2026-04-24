import { useEffect, useMemo, useState } from 'react'

function getAuthBackgroundImage(hour) {
  if (hour >= 0 && hour < 8) {
    return '/assets/images/login/first.jpeg'
  }

  if (hour >= 8 && hour < 17) {
    return '/assets/images/login/second.jpeg'
  }

  return '/assets/images/login/third.jpeg'
}

export const immersiveAuthShellProps = {
  shellClassName: 'vergo-type-shell',
  cardClassName: 'vergo-type-auth-card',
  bodyClassName: 'vergo-type-auth-body',
  headerClassName: 'text-center mb-4',
  columnClassName: 'col-11 col-sm-10 col-md-8 col-lg-6 col-xl-5 col-xxl-4',
}

export function useImmersiveAuthBackgroundStyle() {
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentHour(new Date().getHours())
    }, 60 * 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const backgroundImage = useMemo(() => getAuthBackgroundImage(currentHour), [currentHour])

  return useMemo(() => ({
    backgroundColor: '#0f172a',
    backgroundImage: `linear-gradient(135deg, rgba(15, 23, 42, 0.58), rgba(15, 23, 42, 0.28)), url("${backgroundImage}")`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
  }), [backgroundImage])
}
