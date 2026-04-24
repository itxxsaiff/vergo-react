<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AiAnalysisController;
use App\Http\Controllers\Api\BackgroundJobController;
use App\Http\Controllers\Api\BidController;
use App\Http\Controllers\Api\CronController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OwnerController;
use App\Http\Controllers\Api\OrderComparisonController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PropertyManagerDomainController;
use App\Http\Controllers\Api\PropertyManagerProfileController;
use App\Http\Controllers\Api\ProviderReviewController;
use App\Http\Controllers\Api\PropertyController;
use App\Http\Controllers\Api\PropertyComparisonController;
use App\Http\Controllers\Api\PropertyObjectController;
use App\Http\Controllers\Api\ServiceProviderController;
use App\Http\Controllers\Api\UserDirectoryController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/user/request-otp', [AuthController::class, 'requestUserOtp']);
    Route::post('/user/verify-otp', [AuthController::class, 'verifyUserOtp']);
    Route::post('/manager/check-li', [AuthController::class, 'checkManagerLi']);
    Route::post('/manager/request-otp', [AuthController::class, 'requestManagerOtp']);
    Route::post('/manager/verify-otp', [AuthController::class, 'verifyManagerOtp']);
});

Route::get('/cron/run-ai-analysis', [CronController::class, 'runAiAnalysis']);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/dashboard/overview', DashboardController::class);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllRead']);

    Route::get('/owners', [OwnerController::class, 'index']);
    Route::post('/owners', [OwnerController::class, 'store']);
    Route::put('/owners/{owner}', [OwnerController::class, 'update']);
    Route::delete('/owners/{owner}', [OwnerController::class, 'destroy']);

    Route::get('/user-directory/owners', [UserDirectoryController::class, 'owners']);
    Route::get('/user-directory/service-providers', [UserDirectoryController::class, 'serviceProviders']);
    Route::get('/user-directory/admins', [UserDirectoryController::class, 'admins']);

    Route::get('/employees', [EmployeeController::class, 'index']);
    Route::post('/employees', [EmployeeController::class, 'store']);
    Route::put('/employees/{employee}', [EmployeeController::class, 'update']);
    Route::delete('/employees/{employee}', [EmployeeController::class, 'destroy']);

    Route::get('/properties', [PropertyController::class, 'index']);
    Route::post('/properties', [PropertyController::class, 'store']);
    Route::get('/properties/{property}', [PropertyController::class, 'show']);
    Route::put('/properties/{property}', [PropertyController::class, 'update']);
    Route::delete('/properties/{property}', [PropertyController::class, 'destroy']);
    Route::post('/properties/{property}/compare-price', PropertyComparisonController::class);

    Route::get('/property-objects', [PropertyObjectController::class, 'index']);
    Route::post('/property-objects', [PropertyObjectController::class, 'store']);
    Route::put('/property-objects/{propertyObject}', [PropertyObjectController::class, 'update']);
    Route::delete('/property-objects/{propertyObject}', [PropertyObjectController::class, 'destroy']);

    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{order}', [OrderController::class, 'show']);
    Route::put('/orders/{order}', [OrderController::class, 'update']);
    Route::delete('/orders/{order}', [OrderController::class, 'destroy']);
    Route::post('/orders/{order}/complete', [OrderController::class, 'markCompleted']);
    Route::post('/orders/{order}/reviews', [ProviderReviewController::class, 'store']);
    Route::post('/orders/{order}/compare-bids', OrderComparisonController::class);
    Route::post('/orders/{order}/compare-price', [OrderComparisonController::class, 'comparePrice']);

    Route::get('/bids', [BidController::class, 'index']);
    Route::post('/bids', [BidController::class, 'store']);
    Route::put('/bids/{bid}', [BidController::class, 'update']);
    Route::delete('/bids/{bid}', [BidController::class, 'destroy']);
    Route::get('/bids/{bid}/attachment', [BidController::class, 'downloadAttachment'])->name('bids.attachment.download');

    Route::get('/service-providers', [ServiceProviderController::class, 'index']);
    Route::post('/service-providers', [ServiceProviderController::class, 'store']);
    Route::put('/service-providers/{serviceProvider}', [ServiceProviderController::class, 'update']);
    Route::delete('/service-providers/{serviceProvider}', [ServiceProviderController::class, 'destroy']);

    Route::get('/property-managers', [PropertyManagerProfileController::class, 'index']);
    Route::put('/property-managers/{propertyManagerProfile}', [PropertyManagerProfileController::class, 'update']);
    Route::delete('/property-managers/{propertyManagerProfile}', [PropertyManagerProfileController::class, 'destroy']);

    Route::get('/allowed-domains', [PropertyManagerDomainController::class, 'index']);
    Route::post('/allowed-domains', [PropertyManagerDomainController::class, 'store']);
    Route::put('/allowed-domains/{propertyManagerDomain}', [PropertyManagerDomainController::class, 'update']);
    Route::delete('/allowed-domains/{propertyManagerDomain}', [PropertyManagerDomainController::class, 'destroy']);

    Route::get('/documents', [DocumentController::class, 'index']);
    Route::post('/documents', [DocumentController::class, 'store']);
    Route::delete('/documents/{document}', [DocumentController::class, 'destroy']);
    Route::get('/documents/{document}/download', [DocumentController::class, 'download'])->name('documents.download');
    Route::post('/documents/{document}/analyze', [AiAnalysisController::class, 'analyzeDocument']);

    Route::get('/ai-analysis', [AiAnalysisController::class, 'index']);
    Route::get('/background-jobs', [BackgroundJobController::class, 'index']);
});
