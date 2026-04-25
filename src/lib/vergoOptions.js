export const PROPERTY_USAGE_OPTIONS = [
  { value: 'residential', label: 'Wohnen' },
  { value: 'commercial', label: 'Gewerbe' },
  { value: 'mixed', label: 'Gemischt' },
]

export const PROPERTY_OBJECT_TYPE_OPTIONS = [
  ...PROPERTY_USAGE_OPTIONS,
]

export const JOB_TYPE_OPTIONS = [
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'hvac_maintenance', label: 'HVAC Maintenance' },
  { value: 'elevator_service', label: 'Elevator Service' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'security', label: 'Security' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'painting', label: 'Painting' },
  { value: 'one_time_repair', label: 'One-Time Repair' },
  { value: 'general_maintenance', label: 'General Maintenance' },
  { value: 'other', label: 'Other' },
]

export function getOptionLabel(options, value) {
  return options.find((option) => option.value === value)?.label ?? value ?? '-'
}

export const DOCUMENT_TYPE_OPTIONS = [
  { value: 'fm_contract', label: 'Vertrag' },
  { value: 'contract', label: 'Vertrag' },
  { value: 'invoice', label: 'Rechnung' },
  { value: 'facility', label: 'Facility Document' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'other', label: 'Other' },
]
