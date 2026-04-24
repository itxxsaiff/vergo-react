const MOBILE_SIDEBAR_MAX_WIDTH = 1023
const SIDEBAR_STATE_STORAGE_KEY = 'vergo.sidebar.state'
const FULL_SIDEBAR_TYPE = 'full'
const MINI_SIDEBAR_TYPE = 'mini-sidebar'

function getMainWrapper() {
  return document.getElementById('main-wrapper')
}

function isBrowserEnvironment() {
  return typeof window !== 'undefined'
}

function isMobileSidebarViewport() {
  return window.innerWidth <= MOBILE_SIDEBAR_MAX_WIDTH
}

function setSidebarType(wrapper, type) {
  wrapper.setAttribute('data-sidebartype', type)
}

function isSupportedSidebarType(type) {
  return type === FULL_SIDEBAR_TYPE || type === MINI_SIDEBAR_TYPE
}

function getSavedSidebarType() {
  if (!isBrowserEnvironment()) {
    return FULL_SIDEBAR_TYPE
  }

  try {
    const savedSidebarType = window.localStorage.getItem(SIDEBAR_STATE_STORAGE_KEY)

    return isSupportedSidebarType(savedSidebarType) ? savedSidebarType : FULL_SIDEBAR_TYPE
  } catch {
    return FULL_SIDEBAR_TYPE
  }
}

function persistSidebarType(type) {
  if (!isBrowserEnvironment() || !isSupportedSidebarType(type)) {
    return
  }

  try {
    window.localStorage.setItem(SIDEBAR_STATE_STORAGE_KEY, type)
  } catch {
    // Ignore storage issues and keep the in-memory UI responsive.
  }
}

function applySidebarType(wrapper, type) {
  wrapper.classList.toggle('mini-sidebar', type === MINI_SIDEBAR_TYPE)
  setSidebarType(wrapper, type)
}

export function getInitialSidebarState() {
  const sidebarType = getSavedSidebarType()

  return {
    sidebarType,
    wrapperClassName: sidebarType === MINI_SIDEBAR_TYPE ? 'page-wrapper mini-sidebar' : 'page-wrapper',
  }
}

export function toggleSidebar() {
  const wrapper = getMainWrapper()

  if (!wrapper) {
    return
  }

  if (isMobileSidebarViewport()) {
    const isOpen = wrapper.classList.contains('show-sidebar') && wrapper.getAttribute('data-sidebartype') === FULL_SIDEBAR_TYPE

    if (isOpen) {
      closeSidebar({ persistState: true })
      return
    }

    applySidebarType(wrapper, FULL_SIDEBAR_TYPE)
    wrapper.classList.add('show-sidebar')
    persistSidebarType(FULL_SIDEBAR_TYPE)
    return
  }

  wrapper.classList.remove('show-sidebar')
  wrapper.classList.toggle('mini-sidebar')
  const sidebarType = wrapper.classList.contains('mini-sidebar') ? MINI_SIDEBAR_TYPE : FULL_SIDEBAR_TYPE
  setSidebarType(wrapper, sidebarType)
  persistSidebarType(sidebarType)
}

export function closeSidebar(options = {}) {
  const wrapper = getMainWrapper()

  if (!wrapper) {
    return
  }

  const persistState = Boolean(options?.persistState)

  wrapper.classList.remove('show-sidebar')

  if (isMobileSidebarViewport()) {
    const sidebarType = persistState ? MINI_SIDEBAR_TYPE : getSavedSidebarType()

    applySidebarType(wrapper, sidebarType)

    if (persistState) {
      persistSidebarType(sidebarType)
    }
  } else if (persistState) {
    const sidebarType = wrapper.classList.contains('mini-sidebar') ? MINI_SIDEBAR_TYPE : FULL_SIDEBAR_TYPE

    persistSidebarType(sidebarType)
  }
}
