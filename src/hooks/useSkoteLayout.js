import { useEffect } from 'react'

export function useSkoteLayout() {
  useEffect(() => {
    document.body.removeAttribute('data-sidebar')
    document.body.removeAttribute('data-layout-mode')
    document.body.classList.remove('vertical-collpsed', 'sidebar-enable')
  }, [])
}
