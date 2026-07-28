@php
    $order = $bid->order;
    $provider = $bid->serviceProvider;
    $workflowMeta = $order?->workflow_meta ?? [];
    $bidWorkflowMeta = $bid->workflow_meta ?? [];
    $onsiteContact = data_get($workflowMeta, 'inspection.onsite_contact', []);
    $onsiteName = trim(implode(' ', array_filter([
        data_get($onsiteContact, 'first_name'),
        data_get($onsiteContact, 'last_name'),
    ])));
    $selectedSlot = data_get($bidWorkflowMeta, 'selected_slot', []);
    $selectedSlotIndex = data_get($bidWorkflowMeta, 'selected_slot_index');

    if (! data_get($selectedSlot, 'date') && $selectedSlotIndex !== null && $selectedSlotIndex !== '') {
        $selectedSlot = data_get($workflowMeta, "inspection.preferred_slots.{$selectedSlotIndex}", []);
    }

    $property = $order?->property;
    $object = $order?->propertyObject;
    $providerName = $provider?->company_name
        ?: $provider?->contact_name
        ?: $bid->assigned_provider_email
        ?: '-';
    $providerContact = $provider?->contact_name ?: $bid->assigned_provider_email;
    $providerEmail = $provider?->order_email ?: $provider?->contact_email ?: $bid->assigned_provider_email;
    $appointmentDate = data_get($selectedSlot, 'date') ?: '-';
    $appointmentTime = data_get($selectedSlot, 'time') ?: '-';
    $propertyLabel = trim(($property?->li_number ? "{$property->li_number} - " : '') . ($property?->title ?: ''));
    $objectAddress = $object?->address ?: $object?->name ?: $property?->address ?: '-';
    $zipCity = trim(($object?->postal_code ?: $property?->postal_code ?: '') . ' ' . ($object?->city ?: $property?->city ?: ''));
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
                                Guten Tag{{ $onsiteName ? ' ' . $onsiteName : '' }},
                            </p>

                            <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#2f3441;font-weight:700;">
                                Der Besichtigungstermin wurde von einem Dienstleister bestätigt.
                            </p>

                            <table width="100%" cellspacing="0" cellpadding="0"
                                style="margin:0;border-collapse:collapse;">
                                <tr>
                                    <td style="padding:7px 0;width:170px;color:#555;font-size:14px;">Datum:</td>
                                    <td style="padding:7px 0;font-weight:700;font-size:14px;">{{ $appointmentDate }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:7px 0;color:#555;font-size:14px;">Zeit:</td>
                                    <td style="padding:7px 0;font-weight:700;font-size:14px;">{{ $appointmentTime }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:7px 0;color:#555;font-size:14px;">Liegenschaft:</td>
                                    <td style="padding:7px 0;font-weight:700;font-size:14px;">
                                        {{ $propertyLabel ?: '-' }}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:7px 0;color:#555;font-size:14px;">Objekt / Adresse:</td>
                                    <td style="padding:7px 0;font-weight:700;font-size:14px;">
                                        {{ $objectAddress }}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:7px 0;color:#555;font-size:14px;">PLZ / Ort:</td>
                                    <td style="padding:7px 0;font-weight:700;font-size:14px;">
                                        {{ $zipCity ?: '-' }}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:7px 0;color:#555;font-size:14px;">Auftrag:</td>
                                    <td style="padding:7px 0;font-weight:700;font-size:14px;">{{ $order?->title ?: '-' }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:7px 0;color:#555;font-size:14px;">Dienstleister:</td>
                                    <td style="padding:7px 0;font-weight:700;font-size:14px;">{{ $providerName }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:7px 0;color:#555;font-size:14px;">Kontakt Dienstleister:</td>
                                    <td style="padding:7px 0;font-weight:700;font-size:14px;">
                                        {{ $providerContact ?: '-' }}
                                        @if ($providerEmail)
                                            <br><span style="font-weight:400;">{{ $providerEmail }}</span>
                                        @endif
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#555;">
                                Bitte halten Sie sich den oben genannten Termin frei.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>

</html>
