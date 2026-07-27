<?php

use App\Http\Controllers\QuickLoginController;
use App\Http\Controllers\TestMailController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/users-login', [QuickLoginController::class, 'index'])->name('quick-login.index');
Route::post('/users-login/login', [QuickLoginController::class, 'login'])->name('quick-login.login');

Route::get('/test-vergo-mail', [TestMailController::class, 'sendVergoTest']);
