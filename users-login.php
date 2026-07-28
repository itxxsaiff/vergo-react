<?php

$queryString = $_SERVER['QUERY_STRING'] ?? '';
$target = 'panel/public/users-login'.($queryString ? '?'.$queryString : '');

header('Location: '.$target, true, 302);
exit;
