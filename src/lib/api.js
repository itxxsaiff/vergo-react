const REMOTE_API_BASE_URL = 'https://work.vergo.ch/panel/public/api'

// In dev the Vite server proxies /api to `php artisan serve` (see vite.config.js),
// so a relative base URL keeps the port correct and avoids CORS entirely.
// Set VITE_API_BASE_URL in .env.local to point at any other backend.
const DEV_API_BASE_URL = '/api'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  (import.meta.env.DEV ? DEV_API_BASE_URL : REMOTE_API_BASE_URL)

let authToken = null

export function setAuthToken(token) {
  authToken = token
}

async function request(path, options = {}) {
  const headers = { 
    Accept: 'application/json',
    ...(options.headers ?? {}),
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const firstValidationMessage = payload.errors
      ? Object.values(payload.errors).flat().find(Boolean)
      : null
    const message = firstValidationMessage ?? payload.message ?? 'Request failed'
    const error = new Error(message)
    error.status = response.status
    error.errors = payload.errors ?? {}
    error.payload = payload
    throw error
  }

  return payload
}

async function download(path, fallbackFileName = 'document') {
  const headers = {}

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { headers })

  if (!response.ok) {
    throw new Error('Document download failed')
  }

  const blob = await response.blob()
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fallbackFileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(objectUrl)
}

async function upload(path, formData) {
  return request(path, {
    method: 'POST',
    body: formData,
  })
}

async function openPdfInNewTab(path) {
  const headers = {}

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { headers })

  if (!response.ok) {
    throw new Error('PDF could not be generated')
  }

  const blob = await response.blob()
  const objectUrl = window.URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = objectUrl
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl)
  }, 60000)
}

export const api = {
  login(data) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  requestUserOtp(data) {
    return request('/auth/user/request-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  verifyUserOtp(data) {
    return request('/auth/user/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  checkManagerLi(data) {
    return request('/auth/manager/check-li', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  requestManagerOtp(data) {
    return request('/auth/manager/request-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  verifyManagerOtp(data) {
    return request('/auth/manager/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  resetPassword(data) {
    return request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  getMe() {
    return request('/auth/me')
  },
  logout() {
    return request('/auth/logout', {
      method: 'POST',
    })
  },
  getDashboardOverview() {
    return request('/dashboard/overview')
  },
  getDatabaseBackups() {
    return request('/database-backups')
  },
  createDatabaseBackup() {
    return request('/database-backups', {
      method: 'POST',
    })
  },
  uploadDatabaseBackup(formData) {
    return upload('/database-backups/upload', formData)
  },
  downloadDatabaseBackup(fileName) {
    return download(`/database-backups/${encodeURIComponent(fileName)}/download`, fileName)
  },
  restoreDatabaseBackup(fileName) {
    return request(`/database-backups/${encodeURIComponent(fileName)}/restore`, {
      method: 'POST',
    })
  },
  deleteDatabaseBackup(fileName) {
    return request(`/database-backups/${encodeURIComponent(fileName)}`, {
      method: 'DELETE',
    })
  },
  getNotifications() {
    return request('/notifications')
  },
  markAllNotificationsRead() {
    return request('/notifications/mark-all-read', {
      method: 'POST',
    })
  },
  getOwners() {
    return request('/owners')
  },
  getUserDirectoryOwners() {
    return request('/user-directory/owners')
  },
  getUserDirectoryServiceProviders() {
    return request('/user-directory/service-providers')
  },
  getUserDirectoryAdmins() {
    return request('/user-directory/admins')
  },
  createOwner(data) {
    return request('/owners', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  updateOwner(id, data) {
    return request(`/owners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  deleteOwner(id) {
    return request(`/owners/${id}`, {
      method: 'DELETE',
    })
  },
  getEmployees() {
    return request('/employees')
  },
  createEmployee(data) {
    return request('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  updateEmployee(id, data) {
    return request(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  sendEmployeePasswordReset(id) {
    return request(`/employees/${id}/send-password-reset`, {
      method: 'POST',
    })
  },
  deleteEmployee(id) {
    return request(`/employees/${id}`, {
      method: 'DELETE',
    })
  },
  getProperties() {
    return request('/properties')
  },
  getProperty(id) {
    return request(`/properties/${id}`)
  },
  openPropertyPdf(id, language = 'de') {
    return openPdfInNewTab(`/properties/${id}/pdf?language=${encodeURIComponent(language)}`)
  },
  comparePropertyPrice(id) {
    return request(`/properties/${id}/compare-price`, {
      method: 'POST',
    })
  },
  createProperty(data) {
    return request('/properties', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  updateProperty(id, data) {
    return request(`/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  deleteProperty(id) {
    return request(`/properties/${id}`, {
      method: 'DELETE',
    })
  },
  getOrders() {
    return request('/orders')
  },
  getDeletedOrders() {
    return request('/orders/deleted')
  },
  getOrder(id) {
    return request(`/orders/${id}`)
  },
  createOrder(data) {
    return request('/orders', {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
    })
  },
  updateOrder(id, data) {
    return request(`/orders/${id}`, {
      method: 'PUT',
      body: data instanceof FormData ? data : JSON.stringify(data),
    })
  },
  downloadOrderAttachment(id, fileName) {
    return download(`/orders/${id}/attachment`, fileName || 'order-attachment')
  },
  completeOrder(id) {
    return request(`/orders/${id}/complete`, {
      method: 'POST',
    })
  },
  publishQuoteRequest(id, data = null) {
    return request(`/orders/${id}/publish-quote-request`, {
      method: 'POST',
      ...(data ? { body: JSON.stringify(data) } : {}),
    })
  },
  createProviderReview(orderId, data) {
    return request(`/orders/${orderId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  deleteOrder(id) {
    return request(`/orders/${id}`, {
      method: 'DELETE',
    })
  },
  restoreOrder(id) {
    return request(`/orders/${id}/restore`, {
      method: 'POST',
    })
  },
  compareOrderBids(id) {
    return request(`/orders/${id}/compare-bids`, {
      method: 'POST',
    })
  },
  compareOrderPrice(id) {
    return request(`/orders/${id}/compare-price`, {
      method: 'POST',
    })
  },
  assignProviderOrder(id, data = {}) {
    return request(`/orders/${id}/provider-assign`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  getServiceProviders() {
    return request('/service-providers')
  },
  createServiceProvider(data) {
    return request('/service-providers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  updateServiceProvider(id, data) {
    return request(`/service-providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  deleteServiceProvider(id) {
    return request(`/service-providers/${id}`, {
      method: 'DELETE',
    })
  },
  getCompanyAdditionRequests() {
    return request('/company-addition-requests')
  },
  createCompanyAdditionRequest(data) {
    return request('/company-addition-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  updateCompanyAdditionRequest(id, data) {
    return request(`/company-addition-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  getSupportTickets() {
    return request('/support-tickets')
  },
  createSupportTicket(data) {
    return request('/support-tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  createPublicSupportTicket(data) {
    return request('/public/support-tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  updateSupportTicket(id, data) {
    return request(`/support-tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  getPropertyManagers() {
    return request('/property-managers')
  },
  createPropertyManager(data) {
    return request('/property-managers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  updatePropertyManager(id, data) {
    return request(`/property-managers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  deletePropertyManager(id) {
    return request(`/property-managers/${id}`, {
      method: 'DELETE',
    })
  },
  getAllowedDomains() {
    return request('/allowed-domains')
  },
  createAllowedDomain(data) {
    return request('/allowed-domains', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  updateAllowedDomain(id, data) {
    return request(`/allowed-domains/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  deleteAllowedDomain(id) {
    return request(`/allowed-domains/${id}`, {
      method: 'DELETE',
    })
  },
  getBids() {
    return request('/bids')
  },
  createBid(data) {
    return request('/bids', {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
    })
  },
  updateBid(id, data) {
    return request(`/bids/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  saveBidDraft(id, data) {
    return request(`/bids/${id}/draft`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  deleteBid(id) {
    return request(`/bids/${id}`, {
      method: 'DELETE',
    })
  },
  downloadBidAttachment(id, fileName) {
    return download(`/bids/${id}/attachment`, fileName || 'bid-attachment')
  },
  getDocuments() {
    return request('/documents')
  },
  createDocument(formData) {
    return request('/documents', {
      method: 'POST',
      body: formData,
    })
  },
  deleteDocument(id) {
    return request(`/documents/${id}`, {
      method: 'DELETE',
    })
  },
  analyzeDocument(id) {
    return request(`/documents/${id}/analyze`, {
      method: 'POST',
    })
  },
  getAiAnalysis() {
    return request('/ai-analysis')
  },
  getBackgroundJobs() {
    return request('/background-jobs')
  },
  downloadDocument(id, fileName) {
    return download(`/documents/${id}/download`, fileName)
  },
  getPropertyObjects() {
    return request('/property-objects')
  },
  createPropertyObject(data) {
    return request('/property-objects', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  updatePropertyObject(id, data) {
    return request(`/property-objects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  deletePropertyObject(id) {
    return request(`/property-objects/${id}`, {
      method: 'DELETE',
    })
  },
}
