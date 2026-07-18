// Property managers are stored one profile per email. A "company" (the main
// management the admin adds) is identified by its email domain (domain_suffix).
// Employees who log in with a matching-domain email nest under the same company.
// These helpers collapse the flat profile list into one entry per company so the
// admin list and the property-manager dropdowns show companies, not employees.

export function getManagerCompanyKey(manager) {
  const domain = String(manager?.domain_suffix ?? '').trim().toLowerCase()
  if (domain) return domain
  const emailDomain = String(manager?.email ?? '').split('@')[1]?.trim().toLowerCase()
  if (emailDomain) return `email:${emailDomain}`
  return `id:${manager?.id}`
}

export function buildManagerCompanies(list) {
  const groups = new Map()
  ;(list ?? []).forEach((manager) => {
    const key = getManagerCompanyKey(manager)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(manager)
  })

  return Array.from(groups.entries()).map(([key, employees]) => {
    // The "main" management is the one assigned to the most properties; if tied,
    // the oldest profile (lowest id) — that is the one the admin created first.
    const representative = [...employees].sort((a, b) => {
      const propsA = a.assigned_properties_count ?? 0
      const propsB = b.assigned_properties_count ?? 0
      if (propsB !== propsA) return propsB - propsA
      return (a.id ?? 0) - (b.id ?? 0)
    })[0]

    return {
      key,
      name: representative.name || 'Immobilienverwaltung',
      domain: representative.domain_suffix || key.replace(/^email:/, ''),
      canton: representative.canton || '',
      representative,
      employees,
      totalProperties: employees.reduce((sum, m) => sum + (m.assigned_properties_count ?? 0), 0),
      totalOrders: employees.reduce((sum, m) => sum + (m.orders_count ?? 0), 0),
      activeOrders: employees.reduce((sum, m) => sum + (m.active_orders_count ?? 0), 0),
    }
  })
}

// A property may currently point to any employee profile of a company. Map that
// id to the company's representative id so the company dropdown shows it selected.
export function resolveCompanyRepresentativeId(list, profileId) {
  if (!profileId) return ''
  const target = (list ?? []).find((manager) => String(manager.id) === String(profileId))
  if (!target) return String(profileId)
  const key = getManagerCompanyKey(target)
  const company = buildManagerCompanies(list).find((item) => item.key === key)
  return company ? String(company.representative.id) : String(profileId)
}
