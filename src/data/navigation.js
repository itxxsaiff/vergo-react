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
      ],
    },
    {
      title: 'Dokumente',
      icon: 'ti ti-file-analytics',
      children: [
        { title: 'Verträge', href: '/documents?type=contract' },
        { title: 'Rechnungen', href: '/documents?type=invoice' },
      ],
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
        { title: 'Eigentümer', href: '/users/owners' },
        { title: 'Bewirtschaftung', href: '/property-managers' },
        { title: 'Dienstleister', href: '/users/service-providers' },
      ],
    },
    {
      title: 'Dokumente',
      icon: 'ti ti-file-analytics',
      children: [
        { title: 'Verträge', href: '/documents?type=contract' },
        { title: 'Rechnungen', href: '/documents?type=invoice' },
      ],
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
        { title: 'Eigentümer', href: '/users/owners' },
        { title: 'Bewirtschaftung', href: '/property-managers' },
        { title: 'Dienstleister', href: '/users/service-providers' },
        { title: 'Admins', href: '/employees' },
      ],
    },
    {
      title: 'Dokumente',
      icon: 'ti ti-file-analytics',
      children: [
        { title: 'Verträge', href: '/documents?type=contract' },
        { title: 'Rechnungen', href: '/documents?type=invoice' },
      ],
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
        { title: 'Eigentümer', href: '/users/owners' },
        { title: 'Bewirtschaftung', href: '/property-managers' },
        { title: 'Dienstleister', href: '/users/service-providers' },
      ],
    },
    {
      title: 'Dokumente',
      icon: 'ti ti-file-analytics',
      children: [
        { title: 'Verträge', href: '/documents?type=contract' },
        { title: 'Rechnungen', href: '/documents?type=invoice' },
      ],
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
      title: 'Bieten',
      icon: 'ti ti-briefcase',
      children: [
        { title: 'Verfügbare Jobs', href: '/available-jobs' },
        { title: 'Abgegebene Gebote', href: '/submitted-bids' },
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
