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

export const TRADE_OBJECT_OPTIONS_BY_GROUP = Object.fromEntries(
  TRADE_CATALOG.map(({ value, objects }) => [value, objects]),
)

export const TRADE_ACTIVITY_OPTIONS_BY_GROUP = Object.fromEntries(
  TRADE_CATALOG.map(({ value, activities }) => [value, activities]),
)

export function getOptionLabel(options, value) {
  return options.find((option) => option.value === value)?.label ?? value ?? '-'
}

export const DOCUMENT_TYPE_OPTIONS = [
  { value: 'fm_contract', label: 'Vertrag' },
  { value: 'contract', label: 'Vertrag' },
  { value: 'invoice', label: 'Rechnung' },
  { value: 'facility', label: 'Anlagendokument' },
  { value: 'proposal', label: 'Angebot' },
  { value: 'other', label: 'Sonstiges' },
]
