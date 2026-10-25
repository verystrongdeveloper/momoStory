package com.momostory.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.net.Uri
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager

class NotificationsPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(NotificationsModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

class NotificationsModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "MomoNotifications"
  private fun manager() = context.getSystemService(NotificationManager::class.java)

  @ReactMethod
  fun enabled(promise: Promise) {
    promise.resolve(NotificationManagerCompat.from(context).areNotificationsEnabled())
  }

  @ReactMethod
  fun openSettings(promise: Promise) {
    try {
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      } else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      promise.resolve(null)
    } catch (error: Exception) { promise.reject("NOTIFICATION_SETTINGS", error) }
  }

  @ReactMethod
  fun clear(promise: Promise) {
    // Leave the foreground generation service's mandatory notification alone.
    manager().cancel("momo-chat", 1)
    manager().cancel("momo-story", 1)
    manager().cancel("momo-export", 1)
    manager().cancel("momo-test", 1)
    promise.resolve(null)
  }

  @ReactMethod
  fun show(kind: String, channelName: String, title: String, body: String, preview: Boolean, promise: Promise) {
    try {
      if (kind !in listOf("chat", "story", "export", "test")) { promise.resolve(false); return }
      if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) { promise.resolve(false); return }
      val channel = "momo_$kind"
      val manager = manager()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        manager.createNotificationChannel(NotificationChannel(channel, channelName, NotificationManager.IMPORTANCE_HIGH))
        if (manager.getNotificationChannel(channel)?.importance == NotificationManager.IMPORTANCE_NONE) {
          promise.resolve(false); return
        }
      }
      val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(context, channel)
        else Notification.Builder(context).setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL)
      val notification = builder.setSmallIcon(R.drawable.ic_generation)
        .setContentTitle(title).setContentText(body).setContentIntent(open).setAutoCancel(true)
        .setCategory(if (kind == "chat") Notification.CATEGORY_MESSAGE else Notification.CATEGORY_STATUS)
        .setVisibility(if (preview) Notification.VISIBILITY_PRIVATE else Notification.VISIBILITY_PUBLIC)
        .build()
      // One replaceable alert per category bounds retained message content.
      manager.notify("momo-$kind", 1, notification)
      promise.resolve(true)
    } catch (error: Exception) { promise.reject("NOTIFICATION_SEND", error) }
  }
}
