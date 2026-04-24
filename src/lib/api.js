const LOCAL_API_BASE_URL = '/api'
const REMOTE_API_BASE_URL = 'https://vergo.huzmark.tech/panel/public/api'

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])

const isLocalHost =
typeof window !== 'undefined' &&
LOCAL_HOSTNAMES.has(window.location.hostname)

const API_BASE_URL = isLocalHost
  ? LOCAL_API_BASE_URL
  : REMOTE_API_BASE_URL

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
  getOrder(id) {
    return request(`/orders/${id}`)
  },
  createOrder(data) {
    return request('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  updateOrder(id, data) {
    return request(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  completeOrder(id) {
    return request(`/orders/${id}/complete`, {
      method: 'POST',
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
  getPropertyManagers() {
    return request('/property-managers')
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
