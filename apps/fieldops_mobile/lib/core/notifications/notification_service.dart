// Push notification service scaffold.
//
// FCM integration requires:
// 1. Firebase project setup (google-services.json / GoogleService-Info.plist)
// 2. firebase_messaging package in pubspec.yaml
// 3. APNs key for iOS
//
// This file provides the service interface and registration pattern.
// Actual FCM initialization is deferred until Firebase project is configured.

/// Notification service interface for push notifications.
abstract class NotificationService {
  Future<void> initialize();
  Future<String?> getDeviceToken();
  Future<void> registerToken(String token);
}

/// Placeholder until Firebase is configured.
class NoOpNotificationService implements NotificationService {
  const NoOpNotificationService();

  @override
  Future<void> initialize() async {}

  @override
  Future<String?> getDeviceToken() async => null;

  @override
  Future<void> registerToken(String token) async {}
}

// TODO: Replace with FirebaseNotificationService when Firebase project is set up.
// Required packages: firebase_core, firebase_messaging
// Required files: google-services.json (Android), GoogleService-Info.plist (iOS)
// FCM notifications needed for:
//   - OT approval push to supervisor
//   - Shift report distribution
//   - Alert notifications
//   - Geofence violation alerts
