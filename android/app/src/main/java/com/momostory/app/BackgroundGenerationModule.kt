package com.momostory.app

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

class BackgroundGenerationModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "MomoBackgroundGeneration"

  @ReactMethod
  fun begin(promise: Promise) {
    UiThreadUtil.runOnUiThread { BackgroundGenerationService.begin(context, promise) }
  }

  @ReactMethod
  fun end(token: String, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      BackgroundGenerationService.end(token)
      promise.resolve(null)
    }
  }
}
