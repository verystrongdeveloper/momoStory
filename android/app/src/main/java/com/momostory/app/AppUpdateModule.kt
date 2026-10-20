package com.momostory.app

import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** Only downloads our release APK. Hash, package, version and signing identity are checked before installation. */
class AppUpdateModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val executor = Executors.newSingleThreadExecutor()
  private val busy = AtomicBoolean(false)
  @Volatile private var prepared: File? = null
  @Volatile private var preparedHash: String? = null
  @Volatile private var preparedVersion: String? = null
  override fun getName() = "MomoAppUpdate"
  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}

  @Suppress("DEPRECATION")
  private fun signatures(info: PackageInfo): Set<String> {
    val signatures = if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners else info.signatures
    return signatures?.map { signature ->
      MessageDigest.getInstance("SHA-256").digest(signature.toByteArray()).joinToString("") { "%02x".format(it) }
    }?.toSet() ?: emptySet()
  }
  @Suppress("DEPRECATION")
  private fun verify(file: File, version: String) {
    val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
    val incoming = context.packageManager.getPackageArchiveInfo(file.absolutePath, flags) ?: error("INVALID_APK")
    val current = context.packageManager.getPackageInfo(context.packageName, flags)
    require(incoming.packageName == context.packageName && incoming.versionName == version) { "WRONG_PACKAGE" }
    val nextCode = if (Build.VERSION.SDK_INT >= 28) incoming.longVersionCode else incoming.versionCode.toLong()
    val oldCode = if (Build.VERSION.SDK_INT >= 28) current.longVersionCode else current.versionCode.toLong()
    require(nextCode > oldCode) { "NOT_NEWER" }
    val trusted = signatures(current)
    require(trusted.isNotEmpty() && signatures(incoming) == trusted) { "SIGNATURE_MISMATCH" }
  }
  private fun digest(file: File): String {
    val hash = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
      val buffer = ByteArray(64 * 1024)
      while (true) { val n = input.read(buffer); if (n < 0) break; hash.update(buffer, 0, n) }
    }
    return hash.digest().joinToString("") { "%02x".format(it) }
  }
  private fun openDownload(address: String): HttpURLConnection {
    var url = URL(address)
    repeat(5) {
      // GitHub redirects release assets to its own CDN; never follow a redirect to another host or HTTP.
      require(url.protocol == "https" && (url.host == "github.com" || url.host == "release-assets.githubusercontent.com" || url.host == "objects.githubusercontent.com") && url.userInfo == null && url.port == -1)
      val connection = url.openConnection() as HttpURLConnection
      connection.instanceFollowRedirects = false
      connection.connectTimeout = 30_000
      connection.readTimeout = 30_000
      connection.setRequestProperty("User-Agent", "MomoStory-Updater")
      val code = connection.responseCode
      if (code == 200) return connection
      val location = connection.getHeaderField("Location")
      connection.disconnect()
      require(code in listOf(301, 302, 303, 307, 308) && location != null) { "DOWNLOAD_HTTP_$code" }
      url = URL(url, location)
    }
    error("TOO_MANY_REDIRECTS")
  }
  @ReactMethod
  fun download(url: String, sha256: String, size: Double, version: String, promise: Promise) {
    if (!busy.compareAndSet(false, true)) { promise.reject("UPDATE_BUSY", "UPDATE_BUSY"); return }
    executor.execute {
      var file: File? = null
      try {
        require(version.matches(Regex("[0-9]+\\.[0-9]+\\.[0-9]+")))
        require(url == "https://github.com/verystrongdeveloper/momoStory/releases/download/v$version/MomoStory.apk")
        require(sha256.matches(Regex("[a-f0-9]{64}")) && size.isFinite() && size > 0 && size <= 500 * 1024 * 1024 && size == size.toLong().toDouble())
        prepared = null; preparedHash = null; preparedVersion = null
        val directory = File(context.cacheDir, "updates").apply { mkdirs() }
        val target = File(directory, "MomoStory.apk")
        file = target
        val connection = openDownload(url)
        try {
          require(connection.contentLengthLong == -1L || connection.contentLengthLong == size.toLong())
          connection.inputStream.use { input -> target.outputStream().use { output ->
            val buffer = ByteArray(64 * 1024)
            var received = 0L; var lastEvent = 0L
            val started = System.nanoTime()
            while (true) {
              require((System.nanoTime() - started) / 1_000_000 < 600_000) { "DOWNLOAD_TIMEOUT" }
              val count = input.read(buffer); if (count < 0) break
              received += count
              require(received <= size.toLong()) { "DOWNLOAD_TOO_LARGE" }
              output.write(buffer, 0, count)
              val now = System.currentTimeMillis()
              if (now - lastEvent >= 200 || received == size.toLong()) {
                lastEvent = now
                val data = Arguments.createMap().apply { putDouble("received", received.toDouble()); putDouble("total", size) }
                context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("MomoUpdateProgress", data)
              }
            }
            require(received == size.toLong()) { "INCOMPLETE_DOWNLOAD" }
          } }
        } finally { connection.disconnect() }
        require(digest(target) == sha256) { "HASH_MISMATCH" }
        verify(target, version)
        prepared = target; preparedHash = sha256; preparedVersion = version
        promise.resolve(null)
      } catch (error: Exception) {
        file?.delete()
        promise.reject("UPDATE_DOWNLOAD_FAILED", error)
      } finally { busy.set(false) }
    }
  }
  @ReactMethod
  fun install(promise: Promise) {
    if (!busy.compareAndSet(false, true)) { promise.reject("UPDATE_BUSY", "UPDATE_BUSY"); return }
    executor.execute {
      try {
        val file = prepared ?: error("NO_DOWNLOAD")
        require(file.isFile && digest(file) == preparedHash) { "HASH_MISMATCH" }
        verify(file, preparedVersion ?: error("NO_VERSION"))
        val activity = context.currentActivity ?: error("NO_ACTIVITY")
        activity.runOnUiThread {
          try {
            if (Build.VERSION.SDK_INT >= 26 && !context.packageManager.canRequestPackageInstalls()) {
              activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}")))
              promise.resolve("permission")
            } else {
              val uri = FileProvider.getUriForFile(context, "${context.packageName}.updates", file)
              activity.startActivity(Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
              })
              promise.resolve("opened")
            }
          } catch (error: Exception) { promise.reject("UPDATE_INSTALL_FAILED", error) }
          finally { busy.set(false) }
        }
      } catch (error: Exception) { busy.set(false); promise.reject("UPDATE_INSTALL_FAILED", error) }
    }
  }
}
