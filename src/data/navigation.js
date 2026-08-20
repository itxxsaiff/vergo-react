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
      title: 'Datenbank-Backups',
      icon: 'ti ti-database',
      href: '/database-backups',
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
      title: 'Mein Arbeitsbereich',
      icon: 'ti ti-building-estate',
      children: [
        { title: 'Meine Eigenschaften', href: '/properties' },
        { title: 'Immobilienobjekte', href: '/property-objects' },
        { title: 'Bestellungen', href: '/orders' },
        { title: 'Preisvergleich', href: '/price-comparison' },
        { title: 'Auswertungen', href: '/owner-analytics' },
        { title: 'Erkannte Duplikate', href: '/owner-duplicates' },
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
        { title: 'Bestellungen', href: '/orders' },
        { title: 'Gebote', href: '/bids' },
        { title: 'Preisvergleich', href: '/price-comparison' },
        { title: 'Unterlagen', href: '/documents' },
      ],
    },
  ],
}
