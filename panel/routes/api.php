<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AiAnalysisController;
use App\Http\Controllers\Api\BackgroundJobController;
use App\Http\Controllers\Api\BidController;
use App\Http\Controllers\Api\BidPhotoController;
use App\Http\Controllers\Api\OrderCompletionController;
use App\Http\Controllers\Api\OrderLifecycleController;
use App\Http\Controllers\Api\OwnerAnalyticsController;
use App\Http\Controllers\Api\PriceChangeRequestController;
use App\Http\Controllers\Api\ProviderRatingController;
use App\Http\Controllers\Api\CronController;
use App\Http\Controllers\Api\CompanyAdditionRequestController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DatabaseBackupController;
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
use App\Http\Controllers\Api\SupportTicketController;
use App\Http\Controllers\Api\UserDirectoryController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
    Route::post('/user/request-otp', [AuthController::class, 'requestUserOtp']);
    Route::post('/user/verify-otp', [AuthController::class, 'verifyUserOtp']);
    Route::post('/manager/check-li', [AuthController::class, 'checkManagerLi']);
    Route::post('/manager/request-otp', [AuthController::class, 'requestManagerOtp']);
    Route::post('/manager/verify-otp', [AuthController::class, 'verifyManagerOtp']);
});

Route::get('test-api', function(){
    return response()->json([
        "working"
    ]);
});

Route::get('/cron/run-ai-analysis', [CronController::class, 'runAiAnalysis']);
Route::post('/public/support-tickets', [SupportTicketController::class, 'store']);

// Confidential provider rating, opened from the e-mailed button. The token in
// the link is the authorisation, so no login is required.
Route::get('/public/provider-rating', [ProviderRatingController::class, 'show']);
Route::post('/public/provider-rating', [ProviderRatingController::class, 'store']);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/dashboard/overview', DashboardController::class);
    Route::get('/database-backups', [DatabaseBackupController::class, 'index']);
    Route::post('/database-backups', [DatabaseBackupController::class, 'store']);
    Route::post('/database-backups/upload', [DatabaseBackupController::class, 'upload']);
    Route::get('/database-backups/{fileName}/download', [DatabaseBackupController::class, 'download']);
    Route::post('/database-backups/{fileName}/restore', [DatabaseBackupController::class, 'restore']);
    Route::delete('/database-backups/{fileName}', [DatabaseBackupController::class, 'destroy']);
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
    Route::post('/employees/{employee}/send-password-reset', [EmployeeController::class, 'sendPasswordReset']);

    Route::get('/properties', [PropertyController::class, 'index']);
    Route::post('/properties', [PropertyController::class, 'store']);
    Route::get('/properties/{property}/pdf', [PropertyController::class, 'pdf'])->name('properties.pdf');
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
    Route::get('/orders/deleted', [OrderController::class, 'deleted']);
    Route::post('/orders/{orderId}/restore', [OrderController::class, 'restore'])->whereNumber('orderId');
    Route::get('/orders/{order}', [OrderController::class, 'show']);
    Route::put('/orders/{order}', [OrderController::class, 'update']);
    Route::get('/orders/{order}/attachment', [OrderController::class, 'downloadAttachment'])->name('orders.attachment.download');
    Route::delete('/orders/{order}', [OrderController::class, 'destroy']);
    Route::post('/orders/{order}/complete', [OrderController::class, 'markCompleted']);
    Route::post('/orders/{order}/publish-quote-request', [OrderController::class, 'publishQuoteRequest']);
    Route::post('/orders/{order}/reviews', [ProviderReviewController::class, 'store']);
    Route::post('/orders/{order}/compare-bids', OrderComparisonController::class);
    Route::post('/orders/{order}/compare-price', [OrderComparisonController::class, 'comparePrice']);
    // Automated offer evaluation: 100-point score and ranking per offer.
    Route::post('/orders/{order}/evaluate-offers', [OrderComparisonController::class, 'evaluateOffers']);
    Route::post('/orders/{order}/provider-assign', [BidController::class, 'assignToProvider']);
    Route::get('/company-addition-requests', [CompanyAdditionRequestController::class, 'index']);
    Route::post('/company-addition-requests', [CompanyAdditionRequestController::class, 'store']);
    Route::put('/company-addition-requests/{companyAdditionRequest}', [CompanyAdditionRequestController::class, 'update']);
    Route::get('/support-tickets', [SupportTicketController::class, 'index']);
    Route::post('/support-tickets', [SupportTicketController::class, 'store']);
    Route::put('/support-tickets/{supportTicket}', [SupportTicketController::class, 'update']);

    // Provider finishes the job and receives the invoicing summary.
    Route::post('/orders/{order}/provider-complete', [OrderCompletionController::class, 'complete']);
    Route::get('/orders/{order}/completion-summary', [OrderCompletionController::class, 'summary']);

    // Price changes / added items after the job started, each with a reason.
    Route::get('/orders/{order}/price-change-requests', [PriceChangeRequestController::class, 'index']);
    Route::post('/orders/{order}/price-change-requests', [PriceChangeRequestController::class, 'store']);
    Route::put('/orders/{order}/price-change-requests/{priceChangeRequest}', [PriceChangeRequestController::class, 'update']);

    // Per line item photos, published to the other providers once approved.
    Route::get('/orders/{order}/photos', [BidPhotoController::class, 'index']);
    Route::post('/orders/{order}/photos', [BidPhotoController::class, 'store']);
    Route::put('/orders/{order}/photos/{photo}', [BidPhotoController::class, 'update']);
    Route::delete('/orders/{order}/photos/{photo}', [BidPhotoController::class, 'destroy']);
    Route::get('/orders/{order}/photos/{photo}/download', [BidPhotoController::class, 'download'])->name('bid-photos.download');

    // Admin view of the individual confidential ratings.
    Route::get('/admin/provider-ratings', [ProviderRatingController::class, 'adminIndex']);

    // Owner portfolio analytics and the duplicates the system flagged.
    Route::get('/owner/analytics', [OwnerAnalyticsController::class, 'analytics']);
    Route::get('/owner/duplicates', [OwnerAnalyticsController::class, 'duplicates']);

    // Cancellation, duplicate detection and sequential bid disclosure.
    Route::post('/orders/{order}/cancel', [OrderLifecycleController::class, 'cancel']);
    Route::get('/orders/{order}/duplicate-check', [OrderLifecycleController::class, 'duplicateCheck']);
    Route::post('/orders/{order}/duplicate-explanation', [OrderLifecycleController::class, 'acknowledgeDuplicate']);
    Route::get('/orders/{order}/bid-disclosure', [OrderLifecycleController::class, 'disclosure']);
    Route::post('/orders/{order}/bids/{bid}/reject', [OrderLifecycleController::class, 'rejectBid']);
    // Provider confirmed an inspection appointment but did not attend.
    Route::post('/orders/{order}/bids/{bid}/no-show', [OrderLifecycleController::class, 'reportNoShow']);

    Route::get('/bids', [BidController::class, 'index']);
    Route::post('/bids', [BidController::class, 'store']);
    Route::put('/bids/{bid}', [BidController::class, 'update']);
    Route::put('/bids/{bid}/draft', [BidController::class, 'saveDraft']);
    Route::delete('/bids/{bid}', [BidController::class, 'destroy']);
    Route::get('/bids/{bid}/attachment', [BidController::class, 'downloadAttachment'])->name('bids.attachment.download');

    Route::get('/service-providers', [ServiceProviderController::class, 'index']);
    Route::post('/service-providers', [ServiceProviderController::class, 'store']);
    Route::put('/service-providers/{serviceProvider}', [ServiceProviderController::class, 'update']);
    Route::delete('/service-providers/{serviceProvider}', [ServiceProviderController::class, 'destroy']);

    Route::get('/property-managers', [PropertyManagerProfileController::class, 'index']);
    Route::post('/property-managers', [PropertyManagerProfileController::class, 'store']);
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
