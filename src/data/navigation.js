export const navigationByRole = {
  admin: [
    {
      title: 'Armaturenbrett',
      icon: 'ti ti-layout-dashboard',
      href: '/dashboard',
    },
    {
      title: 'Immobilienverwaltung',
      icon: 'ti ti-building-estate',
      children: [
        { title: 'Eigenschaften', href: '/properties' },
        { title: 'Eigentümer', href: '/owners' },
        { title: 'Eigenschaftenobjekte', href: '/property-objects' },
      ],
    },
    {
      title: 'Bestellungen & Gebote',
      icon: 'ti ti-file-invoice',
      children: [
        { title: 'Bestellungen', href: '/orders' },
        { title: 'Gebote', href: '/bids' },
        { title: 'Preisvergleich', href: '/price-comparison' },
      ],
    },
    {
      title: 'Dokumente & KI',
      icon: 'ti ti-file-analytics',
      children: [
        { title: 'Unterlagen', href: '/documents' },
        { title: 'KI-Analyse', href: '/ai-analysis' },
        { title: 'Hintergrundjobs', href: '/background-jobs' },
      ],
    },
    {
      title: 'Benutzer',
      icon: 'ti ti-users',
      children: [
        { title: 'Dienstleister', href: '/service-providers' },
        { title: 'Immobilienverwalter', href: '/property-managers' },
        { title: 'Erlaubte Domänen', href: '/allowed-domains' },
        { title: 'Mitarbeiter', href: '/employees' },
      ],
    },
  ],
  employee: [
    {
      title: 'Armaturenbrett',
      icon: 'ti ti-layout-dashboard',
      href: '/dashboard',
    },
    {
      title: 'Liegenschaften',
      icon: 'ti ti-building-estate',
      href: '/properties',
      children: [
        { title: 'Objekte', href: '/property-objects' },
      ],
    },
    {
      title: 'Aufträge',
      icon: 'ti ti-file-invoice',
      href: '/orders',
    },
    {
      title: 'Nutzer',
      icon: 'ti ti-users',
      children: [
        { title: 'Eigentümer', href: '/users/owners' },
        { title: 'Dienstleister', href: '/users/service-providers' },
        { title: 'Admins', href: '/users/admins' },
      ],
    },
  ],
  owner: [
    {
      title: 'Armaturenbrett',
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
      title: 'Armaturenbrett',
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
      title: 'Armaturenbrett',
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
