package com.momostory.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import com.facebook.react.bridge.Promise
import java.util.UUID

/** Keeps the existing RN network/JS pipeline alive during a user-started generation. */
class BackgroundGenerationService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var wakeLock: PowerManager.WakeLock? = null
  private var lastStartId = 0
  private val expiry = Runnable { expire() }

  companion object {
    private const val CHANNEL = "story_generation"
    private const val NOTIFICATION_ID = 6815
    private const val MAX_DURATION_MS = 15 * 60 * 1000L
    // All access is on the main thread. Null means startup was already acknowledged.
    private val leases = mutableMapOf<String, Promise?>()
    private var instance: BackgroundGenerationService? = null

    fun begin(context: Context, promise: Promise) {
      val token = UUID.randomUUID().toString()
      leases[token] = promise
      try {
        val intent = Intent(context, BackgroundGenerationService::class.java).putExtra("token", token)
        // An existing service also covers a new request that starts while JS is in background.
        val running = instance
        if (running != null) {
          running.acknowledge(token)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
      } catch (error: Exception) {
        leases.remove(token)
        promise.reject("GENERATION_SERVICE_START", "생성을 시작하려면 앱 화면으로 돌아와 다시 시도해 주세요.", error)
      }
    }

    fun end(token: String) {
      leases.remove(token)
      instance?.stopIfIdle()
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    lastStartId = startId
    try {
      if (instance !== this) {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          manager.createNotificationChannel(NotificationChannel(
            CHANNEL, getString(R.string.generation_channel), NotificationManager.IMPORTANCE_LOW
          ))
        }
        val openApp = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java).apply {
          this.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL)
          else Notification.Builder(this)
        val notification = builder
          .setSmallIcon(R.drawable.ic_generation)
          .setContentTitle(getString(R.string.generation_title))
          .setContentText(getString(R.string.generation_message))
          .setContentIntent(openApp)
          .setOngoing(true)
          .setOnlyAlertOnce(true)
          .setCategory(Notification.CATEGORY_PROGRESS)
          .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else startForeground(NOTIFICATION_ID, notification)
        wakeLock = (getSystemService(POWER_SERVICE) as PowerManager)
          .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MomoStory:Generation").apply {
            setReferenceCounted(false)
            acquire(MAX_DURATION_MS)
          }
        instance = this
        handler.postDelayed(expiry, MAX_DURATION_MS)
      }
      intent?.getStringExtra("token")?.let { acknowledge(it) }
      stopIfIdle()
    } catch (error: Exception) {
      val pending = leases.values.filterNotNull().toList()
      leases.clear()
      pending.forEach { it.reject("GENERATION_SERVICE_START", "백그라운드 생성을 시작하지 못했습니다. 앱 화면에서 다시 시도해 주세요.", error) }
      releaseResources()
      stopSelf()
    }
    // Never restart a dead process with a missing API request or credential.
    return START_NOT_STICKY
  }

  private fun acknowledge(token: String) {
    if (!leases.containsKey(token)) return
    val promise = leases[token]
    leases[token] = null
    promise?.resolve(token)
  }

  private fun stopIfIdle() {
    if (leases.isNotEmpty()) return
    releaseResources()
    stopSelfResult(lastStartId)
  }

  private fun expire() {
    val pending = leases.values.filterNotNull().toList()
    leases.clear()
    pending.forEach { it.reject("GENERATION_SERVICE_TIMEOUT", "백그라운드 생성 시간이 초과되었습니다.") }
    releaseResources()
    stopSelf()
  }

  // Android 15+ requires a prompt stop when the OS foreground-service budget expires.
  override fun onTimeout(startId: Int, fgsType: Int) { expire() }

  private fun releaseResources() {
    handler.removeCallbacks(expiry)
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    if (instance === this) instance = null
    stopForeground(STOP_FOREGROUND_REMOVE)
  }

  override fun onDestroy() {
    releaseResources()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
