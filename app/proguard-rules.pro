# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in $ANDROID_HOME/tools/proguard/proguard-android.txt

# Keep Room entities and DAOs
-keep class com.bankrolledge.app.data.local.entity.** { *; }
