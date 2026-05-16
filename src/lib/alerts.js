import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { translateText } from '../i18n/translations'

const LANGUAGE_STORAGE_KEY = 'vergo-language'

function getCurrentLanguage() {
  if (typeof window === 'undefined') {
    return 'de'
  }

  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'de'
}

const swalWithTemplateButtons = Swal.mixin({
  customClass: {
    confirmButton: 'btn btn-primary mx-2',
    cancelButton: 'btn btn-light border text-danger mx-2',
  },
  buttonsStyling: false,
})

export async function confirmDelete(itemLabel = 'record') {
  const language = getCurrentLanguage()
  const result = await swalWithTemplateButtons.fire({
    title: translateText('Bist du sicher?', language),
    text: `${translateText('Dadurch werden die Daten endgültig gelöscht.', language)} ${translateText(itemLabel, language)}.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: translateText('Ja, löschen!', language),
    cancelButtonText: translateText('Abbrechen', language),
    reverseButtons: true,
  })

  return result.isConfirmed
}

export function showDeleteSuccess(itemLabel = 'record') {
  const language = getCurrentLanguage()
  return swalWithTemplateButtons.fire({
    title: translateText('Gelöscht!', language),
    text: `${translateText('Das', language)} ${translateText(itemLabel, language)} ${translateText('wurde erfolgreich gelöscht.', language)}`,
    icon: 'success',
    timer: 1600,
    showConfirmButton: false,
  })
}
