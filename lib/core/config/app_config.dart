enum Environment { dev, staging, prod }

class AppConfig {
  static final AppConfig _instance = AppConfig._internal();
  factory AppConfig() => _instance;
  AppConfig._internal();

  static Environment environment = Environment.dev;
  
  // API URLs
  static String get baseUrl {
    switch (environment) {
      case Environment.dev:
        return 'http://localhost:3000/api';
      case Environment.staging:
        return 'https://staging-api.challengecoach.app';
      case Environment.prod:
        return 'https://api.challengecoach.app';
    }
  }

  // Feature Flags
  static const bool enablePushNotifications = true;
  static const bool enableAnalytics = true;
  static const bool enableCrashReporting = true;

  // App Settings
  static const String appName = 'ChallengeCoach';
  static const String appVersion = '1.0.0';
  static const String buildNumber = '1';

  // Cache Settings
  static const int cacheMaxAge = 7; // days
  static const int maxImageCacheSize = 100 * 1024 * 1024; // 100MB

  // Timeouts
  static const int connectionTimeout = 30000; // milliseconds
  static const int receiveTimeout = 30000; // milliseconds

  // Pagination
  static const int defaultPageSize = 20;
} 