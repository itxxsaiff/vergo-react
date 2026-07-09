@php
    $order = $bid->order;
    $provider = $bid->serviceProvider;
    $slots = data_get($order->workflow_meta ?? [], 'inspection.preferred_slots', []);
    $selectedSlotIndex = (int) data_get($bid->workflow_meta ?? [], 'selected_slot_index', -1);
    $selectedSlot = $slots[$selectedSlotIndex] ?? [];
    $property = $order->property;
    $object = $order->propertyObject;
@endphp

<!DOCTYPE html>
<html lang="de">

<head>
    <meta charset="UTF-8">
    <title>Besichtigungstermin bestätigt</title>
</head>

<body style="margin:0;padding:24px;background:#f8f8fb;font-family:Arial,sans-serif;color:#2f3441;">
    <table width="100%" cellspacing="0" cellpadding="0">
        <tr>
            <td align="center">
                <table width="580" cellspacing="0" cellpadding="0"
                    style="max-width:580px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #eaded7;">
                    <tr>
                        <td style="background:#9f6d54;padding:22px 32px;">
                            <img src="{{ asset('VERGO.png') }}" alt="Vergo Logo" style="height:42px;display:block;">
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:34px 40px;">
                            <p style="margin:0 0 22px;font-size:15px;">
                                Guten Tag,
                            </p>

                            <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#2f3441;font-weight:700;">
                                Ein Dienstleister hat einen Besichtigungstermin bestätigt.
                            </p>

                            <table width="100%" cellspacing="0" cellpadding="0"
                                style="margin:0;border-collapse:collapse;">
                                <tr>
                                    <td style="padding:7px 0;width:160px;color:#555;font-size:14px;">Firma:</td>
                                    <td style="padding:7px 0;font-weight:700;font-size:14px;">{{ $provider?->company_name ?: '-' }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:7px 0;color:#555;font-size:14px;">Auftrag:</td>
                                    <td style="padding:7px 0;font-weight:700;font-size:14px;">{{ $order?->title ?: '-' }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:7px 0;color:#555;font-size:14px;">Datum / Zeit:</td>
                                    <td style="padding:7px 0;font-weight:700;font-size:14px;">
                                        {{ data_get($selectedSlot, 'date') ?: '-' }}
                                        {{ data_get($selectedSlot, 'time') ?: '' }}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:7px 0;color:#555;font-size:14px;">Liegenschaft:</td>
                                    <td style="padding:7px 0;font-weight:700;font-size:14px;">
                                        {{ $property?->li_number ?: '-' }} - {{ $property?->title ?: '-' }}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:7px 0;color:#555;font-size:14px;">Objekt / Adresse:</td>
                                    <td style="padding:7px 0;font-weight:700;font-size:14px;">
                                        {{ $object?->address ?: ($object?->name ?: '-') }}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:7px 0;color:#555;font-size:14px;">PLZ / Ort:</td>
                                    <td style="padding:7px 0;font-weight:700;font-size:14px;">
                                        {{ $object?->postal_code ?: $property?->postal_code ?: '-' }}
                                        {{ $object?->city ?: $property?->city ?: '' }}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>

</html>
