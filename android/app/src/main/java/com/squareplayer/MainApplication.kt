package com.squareplayer

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.squareplayer.metadata.MetadataExtractorPackage
import com.squareplayer.notification.MetadataProgressPackage
import com.squareplayer.focus.FocusHelperPackage
import com.squareplayer.materialyou.MaterialYouPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          add(MetadataExtractorPackage())
          add(MetadataProgressPackage())
          add(FocusHelperPackage())
          add(MaterialYouPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
