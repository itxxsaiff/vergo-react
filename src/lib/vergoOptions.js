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

export const DEFAULT_TRADE_UNIT_OPTIONS = ['Stück', 'Pauschal', 'Std.', 'm', 'm²', 'm³']

const TRADE_UNIT_OVERRIDES = {
  elektro: ['Stück', 'Pauschal', 'Std.', 'm'],
  gebaeudeautomation_schwachstrom_kommunikation: ['Stück', 'Pauschal', 'Std.', 'm'],
  heizung: ['Stück', 'Pauschal', 'Std.', 'm', 'm²'],
  lueftung: ['Stück', 'Pauschal', 'Std.', 'm²', 'm³/h'],
  klima_kaelte: ['Stück', 'Pauschal', 'Std.', 'm', 'm²'],
  sanitaer: ['Stück', 'Pauschal', 'Std.', 'm'],
  maler: ['m²', 'Pauschal', 'Std.', 'm'],
  gipser_trockenbau: ['m²', 'Pauschal', 'Std.', 'm'],
  bodenbelaege: ['m²', 'Pauschal', 'Std.', 'm'],
  plattenleger: ['m²', 'Pauschal', 'Std.', 'm'],
  reinigung: ['m²', 'Pauschal', 'Std.', 'Stück'],
  garten_umgebung_winterdienst: ['m²', 'Pauschal', 'Std.', 'm³', 'Stück'],
  kanal_entwaesserung: ['m', 'Pauschal', 'Std.', 'Stück'],
  lift: ['Stück', 'Pauschal', 'Std.'],
  geruestbau: ['m²', 'Pauschal', 'Std.', 'm'],
  raeumung_entsorgung: ['m³', 'Pauschal', 'Std.', 'Stück'],
}

export const TRADE_UNIT_OPTIONS_BY_GROUP = Object.fromEntries(
  TRADE_CATALOG.map(({ value }) => [value, TRADE_UNIT_OVERRIDES[value] ?? DEFAULT_TRADE_UNIT_OPTIONS]),
)

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
  return TRADE_UNIT_OPTIONS_BY_GROUP[getCatalogServiceType(serviceType)] ?? DEFAULT_TRADE_UNIT_OPTIONS
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
    unit: values.unit || unitOptions[0] || '',
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
