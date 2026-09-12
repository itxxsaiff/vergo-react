// Below this width the sidebar slides in over the page; above it, it is always
// shown in full. Keep in step with the 1199px breakpoint in App.css.
const MOBILE_SIDEBAR_MAX_WIDTH = 1199
// The old icon-only "mini" state was remembered here. It no longer exists, so
// the stored value is cleared rather than read.
const LEGACY_SIDEBAR_STATE_STORAGE_KEY = 'vergo.sidebar.state'

function getMainWrapper() {
  return document.getElementById('main-wrapper')
}

function isMobileSidebarViewport() {
  return typeof window !== 'undefined' && window.innerWidth <= MOBILE_SIDEBAR_MAX_WIDTH
}

function forgetLegacySidebarState() {
  try {
    window.localStorage.removeItem(LEGACY_SIDEBAR_STATE_STORAGE_KEY)
  } catch {
    // Storage can be blocked; there is nothing to clean up then.
  }
}

/**
 * The sidebar has one shape: full width. On desktop it is always open; on a
 * phone it is hidden until the menu button opens it.
 */
export function getInitialSidebarState() {
  if (typeof window !== 'undefined') {
    forgetLegacySidebarState()
  }

  return {
    sidebarType: 'full',
    wrapperClassName: 'page-wrapper',
  }
}

export function toggleSidebar() {
  const wrapper = getMainWrapper()

  if (!wrapper || !isMobileSidebarViewport()) {
    return
  }

  wrapper.classList.toggle('show-sidebar')
}

export function closeSidebar() {
  getMainWrapper()?.classList.remove('show-sidebar')
}
