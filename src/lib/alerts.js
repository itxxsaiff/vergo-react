import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

const swalWithTemplateButtons = Swal.mixin({
  customClass: {
    confirmButton: 'btn btn-primary mx-2',
    cancelButton: 'btn btn-light border text-danger mx-2',
  },
  buttonsStyling: false,
})

export async function confirmDelete(itemLabel = 'record') {
  const result = await swalWithTemplateButtons.fire({
    title: 'Bist du sicher?',
    text: `Dadurch werden die Daten endgültig gelöscht. ${itemLabel}.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ja, löschen!',
    cancelButtonText: 'Abbrechen',
    reverseButtons: true,
  })

  return result.isConfirmed
}

export function showDeleteSuccess(itemLabel = 'record') {
  return swalWithTemplateButtons.fire({
    title: 'Gelöscht!',
    text: `Das ${itemLabel} wurde erfolgreich gelöscht.`,
    icon: 'success',
    timer: 1600,
    showConfirmButton: false,
  })
}
