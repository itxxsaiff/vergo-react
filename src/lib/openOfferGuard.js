// Set while a property manager has an offer open on the order details page.
// The header reads it so logging out warns first, the same way closing the tab
// does. Deliberately module state rather than context: it is read once, in an
// event handler, and never rendered.

let openOfferOrderId = null

export function setOpenOffer(orderId) {
  openOfferOrderId = orderId ?? null
}

export function clearOpenOffer() {
  openOfferOrderId = null
}

export function getOpenOfferOrderId() {
  return openOfferOrderId
}
