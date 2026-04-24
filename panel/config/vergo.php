<?php

return [
    'cron_token' => env('VERGO_CRON_TOKEN', ''),
    'property_object_types' => [
        'apartment',
        'office',
        'retail_unit',
        'storage',
        'parking',
        'technical_room',
        'common_area',
        'other',
    ],
    'job_types' => [
        'cleaning',
        'hvac_maintenance',
        'elevator_service',
        'electrical',
        'plumbing',
        'security',
        'landscaping',
        'flooring',
        'painting',
        'one_time_repair',
        'general_maintenance',
        'other',
    ],
];
