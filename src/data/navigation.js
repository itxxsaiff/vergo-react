export const navigationByRole = {
  admin: [
    {
      title: 'Immobilien',
      icon: 'ti ti-building-estate',
      children: [
        { title: 'Liegenschaften', href: '/properties' },
      ],
    },
    {
      title: 'Benutzer',
      icon: 'ti ti-users',
      children: [
        { title: 'Eigentümer', href: '/owners' },
        { title: 'Bewirtschaftung', href: '/property-managers' },
        { title: 'Dienstleister', href: '/service-providers' },
        { title: 'Admins', href: '/employees' },
        { title: 'Bewertungen', href: '/provider-ratings' },
      ],
    },
    {
      title: 'Dokumente',
      icon: 'ti ti-file-analytics',
      children: [
        { title: 'Rechnungen', href: '/documents?type=invoice' },
      ],
    },
    {
      // The owner report, across every owner, with a filter to narrow it down.
      title: 'Auswertungen',
      icon: 'ti ti-chart-histogram',
      href: '/owner-analytics',
    },
    {
      // Every order, filterable by status, company and period, with a PDF.
      title: 'Aufträge',
      icon: 'ti ti-checkbox',
      href: '/completed-jobs',
    },
    {
      title: 'Support-Tickets',
      icon: 'ti ti-ticket',
      href: '/support-tickets',
    },
  ],
  employee_admin: [
    {
      title: 'Immobilien',
      icon: 'ti ti-building-estate',
      children: [
        { title: 'Liegenschaften', href: '/properties' },
      ],
    },
    {
      title: 'Nutzer',
      icon: 'ti ti-users',
      children: [
        { title: 'Eigentümer', href: '/owners' },
        { title: 'Bewirtschaftung', href: '/property-managers' },
        { title: 'Dienstleister', href: '/service-providers' },
      ],
    },
    {
      title: 'Dokumente',
      icon: 'ti ti-file-analytics',
      children: [
        { title: 'Rechnungen', href: '/documents?type=invoice' },
      ],
    },
    {
      // Every order, filterable by status, company and period, with a PDF.
      title: 'Aufträge',
      icon: 'ti ti-checkbox',
      href: '/completed-jobs',
    },
    {
      title: 'Support-Tickets',
      icon: 'ti ti-ticket',
      href: '/support-tickets',
    },
  ],
  employee_power_user: [
    {
      title: 'Immobilien',
      icon: 'ti ti-building-estate',
      children: [
        { title: 'Liegenschaften', href: '/properties' },
      ],
    },
    {
      title: 'Nutzer',
      icon: 'ti ti-users',
      children: [
        { title: 'Eigentümer', href: '/owners' },
        { title: 'Bewirtschaftung', href: '/property-managers' },
        { title: 'Dienstleister', href: '/service-providers' },
        { title: 'Admins', href: '/employees' },
        { title: 'Bewertungen', href: '/provider-ratings' },
      ],
    },
    {
      title: 'Dokumente',
      icon: 'ti ti-file-analytics',
      children: [
        { title: 'Rechnungen', href: '/documents?type=invoice' },
      ],
    },
    {
      // The owner report, across every owner, with a filter to narrow it down.
      title: 'Auswertungen',
      icon: 'ti ti-chart-histogram',
      href: '/owner-analytics',
    },
    {
      // Every order, filterable by status, company and period, with a PDF.
      title: 'Aufträge',
      icon: 'ti ti-checkbox',
      href: '/completed-jobs',
    },
    {
      title: 'Support-Tickets',
      icon: 'ti ti-ticket',
      href: '/support-tickets',
    },
  ],
  employee: [
    {
      title: 'Immobilien',
      icon: 'ti ti-building-estate',
      children: [
        { title: 'Liegenschaften', href: '/properties' },
      ],
    },
    {
      title: 'Nutzer',
      icon: 'ti ti-users',
      children: [
        { title: 'Eigentümer', href: '/owners' },
        { title: 'Bewirtschaftung', href: '/property-managers' },
        { title: 'Dienstleister', href: '/service-providers' },
      ],
    },
    {
      title: 'Dokumente',
      icon: 'ti ti-file-analytics',
      children: [
        { title: 'Rechnungen', href: '/documents?type=invoice' },
      ],
    },
    {
      title: 'Support-Tickets',
      icon: 'ti ti-ticket',
      href: '/support-tickets',
    },
  ],
  owner: [
    {
      title: 'Dashboard',
      icon: 'ti ti-layout-dashboard',
      href: '/dashboard',
    },
    {
      title: 'Berichte',
      icon: 'ti ti-building-estate',
      children: [
        // The property list is the owner's starting point: from there they open
        // the objects of a property. The separate object page is gone.
        // The order the client asked for: properties, orders, analysis, reports.
        { title: 'Liegenschaften', href: '/properties' },
        { title: 'Aufträge', href: '/orders' },
        { title: 'Auswertungen', href: '/owner-analytics' },
        // Manager decisions with the reason that was given: rejected best
        // offers, cancellations and duplicates.
        { title: 'Berichte', href: '/owner-decisions' },
        // Only the owner's super users - the login addresses the admin listed
        // on the owner - see this entry.
        { title: 'Preisvergleich', href: '/price-comparison', requiresPriceComparison: true },
        { title: 'Unterlagen', href: '/documents' },
      ],
    },
  ],
  provider: [
    {
      title: 'Dashboard',
      icon: 'ti ti-layout-dashboard',
      href: '/dashboard',
    },
    {
      title: 'Aufträge',
      icon: 'ti ti-briefcase',
      children: [
        { title: 'Verfügbar', href: '/available-jobs' },
        { title: 'Abgegeben', href: '/submitted-bids' },
      ],
    },
  ],
  manager: [
    {
      title: 'Dashboard',
      icon: 'ti ti-layout-dashboard',
      href: '/dashboard',
    },
    {
      title: 'Mein Eigentum',
      icon: 'ti ti-building-estate',
      children: [
        { title: 'Objektübersicht', href: '/properties' },
        { title: 'Eigenschaftenobjekte', href: '/property-objects' },
        { title: 'Aufträge', href: '/orders' },
        { title: 'Gebote', href: '/bids' },
        { title: 'Preisvergleich', href: '/price-comparison' },
        { title: 'Unterlagen', href: '/documents' },
      ],
    },
  ],
}
