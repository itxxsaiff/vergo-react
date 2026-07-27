import { TRADE_CATALOG } from '../data/tradeCatalog'

export const PROPERTY_USAGE_OPTIONS = [
  { value: 'residential', label: 'Wohnen' },
  { value: 'commercial', label: 'Gewerbe' },
  { value: 'mixed', label: 'Gemischt' },
]

export const PROPERTY_OBJECT_TYPE_OPTIONS = [
  ...PROPERTY_USAGE_OPTIONS,
]

export const JOB_TYPE_OPTIONS = TRADE_CATALOG.map(({ value, label }) => ({ value, label }))

export const LEGACY_JOB_TYPE_LABELS = {
  cleaning: 'Reinigung',
  hvac_maintenance: 'Heizung / Lüftung / Klima',
  elevator_service: 'Lift',
  electrical: 'Elektro',
  plumbing: 'Sanitär',
  security: 'Sicherheit / Schwachstrom',
  landscaping: 'Garten / Umgebung / Winterdienst',
  flooring: 'Bodenbeläge / Plattenleger',
  painting: 'Maler',
  one_time_repair: 'Einmalige Reparatur',
  general_maintenance: 'Allgemeiner Unterhalt',
  other: 'Sonstiges',
}

export const LEGACY_SERVICE_TYPE_BY_TRADE_GROUP = {
  elektro: 'electrical',
  gebaeudeautomation_schwachstrom_kommunikation: 'security',
  heizung: 'hvac_maintenance',
  lueftung: 'hvac_maintenance',
  klima_kaelte: 'hvac_maintenance',
  sanitaer: 'plumbing',
  maler: 'painting',
  gipser_trockenbau: 'general_maintenance',
  bodenbelaege: 'flooring',
  plattenleger: 'flooring',
  schreiner_innenausbau: 'general_maintenance',
  metallbau_schloss_beschlaege: 'general_maintenance',
  fenster_glas_storen_sonnenschutz: 'general_maintenance',
  dach_spengler_flachdach: 'general_maintenance',
  fassade_gebaeudehuelle: 'general_maintenance',
  maurer_beton_kernbohrung: 'general_maintenance',
  reinigung: 'cleaning',
  garten_umgebung_winterdienst: 'landscaping',
  kanal_entwaesserung: 'plumbing',
  kueche_geraete_haushaltstechnik: 'general_maintenance',
  lift: 'elevator_service',
  brandschutz_sicherheit: 'security',
  holzbau_zimmermann: 'general_maintenance',
  solar_photovoltaik_solarthermie: 'electrical',
  tuer_tor_garagentor: 'general_maintenance',
  geruestbau: 'general_maintenance',
  schadstoffsanierung_rueckbau: 'general_maintenance',
  raeumung_entsorgung: 'other',
}

export const TRADE_OBJECT_OPTIONS_BY_GROUP = Object.fromEntries(
  TRADE_CATALOG.map(({ value, objects }) => [value, objects]),
)

export const TRADE_ACTIVITY_OPTIONS_BY_GROUP = Object.fromEntries(
  TRADE_CATALOG.map(({ value, activities }) => [value, activities]),
)

export const TRADE_GROUP_BY_LEGACY_SERVICE_TYPE = Object.entries(LEGACY_SERVICE_TYPE_BY_TRADE_GROUP)
  .reduce((map, [tradeGroup, legacyType]) => {
    if (!map[legacyType]) {
      map[legacyType] = tradeGroup
    }

    return map
  }, {})

export const ADD_SERVICE_OPTION_VALUE = '__vergo_add_service__'

function uniqueUnits(units) {
  return Array.from(new Set(units.filter(Boolean)))
}

export const DEFAULT_TRADE_UNIT_OPTIONS = [
  'Stück',
  'Pauschal',
  'Std.',
  'Tag',
  'Woche',
  'Monat',
  'Jahr',
  'Einsatz',
  'Fahrt',
  'km',
  'm',
  'lfm',
  'm²',
  'm³',
  'm³/h',
  'kg',
  't',
  'l',
  'Set',
  'Gebinde',
  'Sack',
  'Rolle',
  'Palette',
  'Container',
  'Mulde',
]

const TECHNICAL_UNIT_OPTIONS = [
  'Anlage',
  'Gerät',
  'Komponente',
  'Anschluss',
  'Punkt',
  'Prüfpunkt',
  'Messpunkt',
  'Zone',
]

const OPENING_UNIT_OPTIONS = [
  'Tür',
  'Tor',
  'Fenster',
  'Flügel',
  'Beschlag',
  'Schloss',
  'Zylinder',
  'Schlüssel',
]

const ROOM_BUILDING_UNIT_OPTIONS = [
  'Raum',
  'Wohnung',
  'Etage',
  'Objekt',
  'Fassade',
  'Wand',
  'Decke',
  'Stufe',
]

const DISPOSAL_UNIT_OPTIONS = [
  'Container',
  'Mulde',
  'Big Bag',
  'Sack',
  'Gebinde',
  'Palette',
  'Fahrt',
  'kg',
  't',
  'm³',
]

const TRADE_UNIT_OVERRIDES = {
  elektro: uniqueUnits([
    'Stück',
    'Pauschal',
    'Std.',
    'm',
    'lfm',
    'Anschluss',
    'Punkt',
    'Lichtpunkt',
    'Leuchte',
    'Dose',
    'Schalter',
    'Sicherung',
    'Verteiler',
    ...TECHNICAL_UNIT_OPTIONS,
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  gebaeudeautomation_schwachstrom_kommunikation: uniqueUnits([
    'Stück',
    'Pauschal',
    'Std.',
    'm',
    'Datenpunkt',
    'Anschluss',
    'Sensor',
    'Aktor',
    'Regler',
    'Gateway',
    ...TECHNICAL_UNIT_OPTIONS,
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  heizung: uniqueUnits([
    'Stück',
    'Pauschal',
    'Std.',
    'm',
    'm²',
    'l',
    'Heizkreis',
    'Radiator',
    'Ventil',
    'Pumpe',
    ...TECHNICAL_UNIT_OPTIONS,
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  lueftung: uniqueUnits([
    'Stück',
    'Pauschal',
    'Std.',
    'm',
    'm²',
    'm³',
    'm³/h',
    'Filter',
    'Kanal',
    'Auslass',
    'Gitter',
    'Klappe',
    ...TECHNICAL_UNIT_OPTIONS,
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  klima_kaelte: uniqueUnits([
    'Stück',
    'Pauschal',
    'Std.',
    'm',
    'm²',
    'm³/h',
    'kW',
    'Innengerät',
    'Aussengerät',
    'Kältekreis',
    'Filter',
    ...TECHNICAL_UNIT_OPTIONS,
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  sanitaer: uniqueUnits([
    'Stück',
    'Pauschal',
    'Std.',
    'm',
    'lfm',
    'm²',
    'l',
    'Anschluss',
    'Armatur',
    'Apparat',
    'Ablauf',
    'Ventil',
    ...TECHNICAL_UNIT_OPTIONS,
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  maler: uniqueUnits([
    'm²',
    'm',
    'lfm',
    'Stück',
    'Pauschal',
    'Std.',
    'Raum',
    'Tür',
    'Fenster',
    'Fassade',
    'Wand',
    'Decke',
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  gipser_trockenbau: uniqueUnits([
    'm²',
    'm',
    'lfm',
    'm³',
    'Stück',
    'Pauschal',
    'Std.',
    'Platte',
    'Raum',
    'Wand',
    'Decke',
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  bodenbelaege: uniqueUnits([
    'm²',
    'm',
    'lfm',
    'Stück',
    'Pauschal',
    'Std.',
    'Sockelleiste',
    'Stufe',
    'Raum',
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  plattenleger: uniqueUnits([
    'm²',
    'm',
    'lfm',
    'Stück',
    'Pauschal',
    'Std.',
    'Platte',
    'Fuge',
    'Stufe',
    'Raum',
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  schreiner_innenausbau: uniqueUnits([
    'Stück',
    'm',
    'lfm',
    'm²',
    'Pauschal',
    'Std.',
    'Tür',
    'Fenster',
    'Möbel',
    'Schrank',
    'Tablar',
    ...OPENING_UNIT_OPTIONS,
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  metallbau_schloss_beschlaege: uniqueUnits([
    'Stück',
    'm',
    'lfm',
    'm²',
    'kg',
    'Pauschal',
    'Std.',
    'Geländer',
    'Beschlag',
    ...OPENING_UNIT_OPTIONS,
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  fenster_glas_storen_sonnenschutz: uniqueUnits([
    'Stück',
    'm',
    'lfm',
    'm²',
    'Pauschal',
    'Std.',
    'Fenster',
    'Glas',
    'Store',
    'Lamelle',
    'Motor',
    ...OPENING_UNIT_OPTIONS,
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  dach_spengler_flachdach: uniqueUnits([
    'm²',
    'm',
    'lfm',
    'm³',
    'Stück',
    'kg',
    't',
    'Pauschal',
    'Std.',
    'Ablauf',
    'Rinne',
    'Fallrohr',
    'Dachfläche',
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  fassade_gebaeudehuelle: uniqueUnits([
    'm²',
    'm',
    'lfm',
    'Stück',
    'Pauschal',
    'Std.',
    'Fassade',
    'Element',
    'Paneel',
    'Fensterbank',
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  maurer_beton_kernbohrung: uniqueUnits([
    'Stück',
    'm',
    'lfm',
    'm²',
    'm³',
    'kg',
    't',
    'Pauschal',
    'Std.',
    'Bohrung',
    'Öffnung',
    'Kernbohrung',
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  reinigung: uniqueUnits([
    'm²',
    'Std.',
    'Pauschal',
    'Stück',
    'Raum',
    'Wohnung',
    'Etage',
    'Objekt',
    'Fenster',
    'Treppe',
    'Fahrt',
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  garten_umgebung_winterdienst: uniqueUnits([
    'm²',
    'm³',
    'm',
    'lfm',
    'Std.',
    'Pauschal',
    'Stück',
    'kg',
    't',
    'Fahrt',
    'Beet',
    'Baum',
    'Strauch',
    'Saison',
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  kanal_entwaesserung: uniqueUnits([
    'm',
    'lfm',
    'Stück',
    'Std.',
    'Pauschal',
    'm³',
    'Ablauf',
    'Schacht',
    'Leitung',
    'Kamerafahrt',
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  kueche_geraete_haushaltstechnik: uniqueUnits([
    'Stück',
    'Gerät',
    'Pauschal',
    'Std.',
    'Anschluss',
    'Set',
    'Front',
    'Schrank',
    ...TECHNICAL_UNIT_OPTIONS,
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  lift: uniqueUnits([
    'Anlage',
    'Fahrt',
    'Stück',
    'Pauschal',
    'Std.',
    'Tür',
    'Etage',
    'Komponente',
    'Prüfung',
    ...TECHNICAL_UNIT_OPTIONS,
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  brandschutz_sicherheit: uniqueUnits([
    'Stück',
    'Pauschal',
    'Std.',
    'Anlage',
    'Melder',
    'Löscher',
    'Tür',
    'Prüfpunkt',
    'Zone',
    ...TECHNICAL_UNIT_OPTIONS,
    ...OPENING_UNIT_OPTIONS,
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  holzbau_zimmermann: uniqueUnits([
    'm',
    'lfm',
    'm²',
    'm³',
    'Stück',
    'Pauschal',
    'Std.',
    'Balken',
    'Platte',
    'Element',
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  solar_photovoltaik_solarthermie: uniqueUnits([
    'Stück',
    'Pauschal',
    'Std.',
    'm',
    'm²',
    'kW',
    'kWp',
    'kWh',
    'Modul',
    'String',
    'Wechselrichter',
    'Anlage',
    ...TECHNICAL_UNIT_OPTIONS,
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  tuer_tor_garagentor: uniqueUnits([
    'Stück',
    'Pauschal',
    'Std.',
    'Tür',
    'Tor',
    'Antrieb',
    'Beschlag',
    'Schlüssel',
    'Zylinder',
    ...OPENING_UNIT_OPTIONS,
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  geruestbau: uniqueUnits([
    'm²',
    'm³',
    'm',
    'lfm',
    'Pauschal',
    'Std.',
    'Tag',
    'Woche',
    'Etage',
    'Feld',
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  schadstoffsanierung_rueckbau: uniqueUnits([
    'm²',
    'm³',
    'kg',
    't',
    'Pauschal',
    'Std.',
    'Probe',
    ...DISPOSAL_UNIT_OPTIONS,
    ...ROOM_BUILDING_UNIT_OPTIONS,
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
  raeumung_entsorgung: uniqueUnits([
    'm³',
    'kg',
    't',
    'Stück',
    'Pauschal',
    'Std.',
    ...DISPOSAL_UNIT_OPTIONS,
    ...ROOM_BUILDING_UNIT_OPTIONS,
    ...DEFAULT_TRADE_UNIT_OPTIONS,
  ]),
}

export const TRADE_UNIT_OPTIONS_BY_GROUP = Object.fromEntries(
  TRADE_CATALOG.map(({ value }) => [value, TRADE_UNIT_OVERRIDES[value] ?? DEFAULT_TRADE_UNIT_OPTIONS]),
)

const UNIT_LABEL_ALIASES = new Map([
  ['piece', 'Stück'],
  ['pieces', 'Stück'],
  ['pc', 'Stück'],
  ['pcs', 'Stück'],
  ['stk', 'Stück'],
  ['stk.', 'Stück'],
  ['stück', 'Stück'],
  ['flat rate', 'Pauschal'],
  ['flat_rate', 'Pauschal'],
  ['fixed price', 'Pauschal'],
  ['pauschale', 'Pauschal'],
  ['pauschal', 'Pauschal'],
  ['hour', 'Std.'],
  ['hours', 'Std.'],
  ['std', 'Std.'],
  ['std.', 'Std.'],
  ['h', 'Std.'],
  ['day', 'Tag'],
  ['days', 'Tag'],
  ['week', 'Woche'],
  ['weeks', 'Woche'],
  ['month', 'Monat'],
  ['months', 'Monat'],
  ['year', 'Jahr'],
  ['years', 'Jahr'],
  ['meter', 'm'],
  ['metre', 'm'],
  ['meters', 'm'],
  ['metres', 'm'],
  ['lm', 'lfm'],
  ['lfm', 'lfm'],
  ['linear meter', 'lfm'],
  ['running meter', 'lfm'],
  ['square meter', 'm²'],
  ['square metre', 'm²'],
  ['m2', 'm²'],
  ['qm', 'm²'],
  ['cubic meter', 'm³'],
  ['cubic metre', 'm³'],
  ['m3', 'm³'],
  ['cbm', 'm³'],
  ['liter', 'l'],
  ['litre', 'l'],
  ['liters', 'l'],
  ['litres', 'l'],
  ['kilogram', 'kg'],
  ['kilograms', 'kg'],
  ['ton', 't'],
  ['tons', 't'],
  ['tonne', 't'],
  ['tonnes', 't'],
  ['set', 'Set'],
  ['trip', 'Fahrt'],
  ['drive', 'Fahrt'],
  ['fahrt', 'Fahrt'],
])

export function normalizeTradeUnit(unit) {
  const normalizedUnit = String(unit ?? '').trim()

  if (!normalizedUnit) {
    return ''
  }

  return UNIT_LABEL_ALIASES.get(normalizedUnit.toLowerCase()) ?? normalizedUnit
}

export const VAT_RATE = 0.081

export function getCatalogServiceType(serviceType) {
  if (TRADE_ACTIVITY_OPTIONS_BY_GROUP[serviceType]) {
    return serviceType
  }

  return TRADE_GROUP_BY_LEGACY_SERVICE_TYPE[serviceType] ?? serviceType ?? ''
}

export function getTradeActivityOptions(serviceType) {
  return TRADE_ACTIVITY_OPTIONS_BY_GROUP[getCatalogServiceType(serviceType)] ?? []
}

export function getTradeUnitOptions(serviceType) {
  return uniqueUnits(
    (TRADE_UNIT_OPTIONS_BY_GROUP[getCatalogServiceType(serviceType)] ?? DEFAULT_TRADE_UNIT_OPTIONS)
      .map(normalizeTradeUnit),
  )
}

function hasOwnValue(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key)
}

export function createQuoteLineItem(serviceType = '', values = {}) {
  const categoryOptions = getTradeActivityOptions(serviceType)
  const unitOptions = getTradeUnitOptions(serviceType)
  const category = hasOwnValue(values, 'category')
    ? values.category
    : (values.code ?? categoryOptions[0] ?? '')

  return {
    id: values.id ?? `${values.source ?? 'item'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category,
    label: values.label ?? '',
    code: values.code ?? category,
    unit: normalizeTradeUnit(values.unit) || unitOptions[0] || '',
    quantity: hasOwnValue(values, 'quantity') ? values.quantity : 1,
    unit_price: hasOwnValue(values, 'unit_price') ? values.unit_price : '',
    source: values.source ?? 'catalog',
    is_custom: Boolean(values.is_custom ?? false),
  }
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

export function calculateQuoteVatBreakdown(lineItems = [], isVatSubject = false, vatIncluded = false) {
  const enteredTotal = lineItems.reduce((sum, item) => (
    sum + (Number(item.quantity || 0) * Number(item.unit_price || 0))
  ), 0)

  if (!isVatSubject) {
    return {
      subtotal: roundMoney(enteredTotal),
      vat: 0,
      total: roundMoney(enteredTotal),
      enteredTotal: roundMoney(enteredTotal),
    }
  }

  if (vatIncluded) {
    const total = roundMoney(enteredTotal)
    const subtotal = roundMoney(total / (1 + VAT_RATE))

    return {
      subtotal,
      vat: roundMoney(total - subtotal),
      total,
      enteredTotal: total,
    }
  }

  const subtotal = roundMoney(enteredTotal)
  const vat = roundMoney(subtotal * VAT_RATE)

  return {
    subtotal,
    vat,
    total: roundMoney(subtotal + vat),
    enteredTotal: subtotal,
  }
}

export function formatCurrencyAmount(value, currency = 'CHF') {
  return `${Number(value || 0).toFixed(2)} ${currency}`
}

export function getOptionLabel(options, value) {
  return options.find((option) => option.value === value)?.label ?? LEGACY_JOB_TYPE_LABELS[value] ?? value ?? '-'
}

export function normalizeServiceTypeForApi(value) {
  return LEGACY_SERVICE_TYPE_BY_TRADE_GROUP[value] ?? value ?? null
}

export const DOCUMENT_TYPE_OPTIONS = [
  { value: 'fm_contract', label: 'Vertrag' },
  { value: 'contract', label: 'Vertrag' },
  { value: 'invoice', label: 'Rechnung' },
  { value: 'facility', label: 'Anlagendokument' },
  { value: 'proposal', label: 'Angebot' },
  { value: 'other', label: 'Sonstiges' },
]
