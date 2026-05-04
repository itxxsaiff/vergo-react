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

export function getOptionLabel(options, value) {
  return options.find((option) => option.value === value)?.label ?? value ?? '-'
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
