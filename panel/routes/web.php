<?php

use App\Http\Controllers\TestMailController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/test-vergo-mail', [TestMailController::class, 'sendVergoTest']);