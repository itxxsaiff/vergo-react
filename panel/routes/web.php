<?php

use App\Http\Controllers\QuickLoginController;
use App\Http\Controllers\TestMailController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Passwordless "log in as anyone" helper. It mints a real Sanctum token without
// any credential check, so it must never be reachable outside local development.
if (app()->environment('local')) {
    Route::get('/users-login', [QuickLoginController::class, 'index'])->name('quick-login.index');
    Route::post('/users-login/login', [QuickLoginController::class, 'login'])->name('quick-login.login');
}

Route::get('/test-vergo-mail', [TestMailController::class, 'sendVergoTest']);
