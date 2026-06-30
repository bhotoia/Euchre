#!/usr/bin/env bash
# Build a signed debug APK for the Euchre WebView app, no Gradle.
set -e

SDK_WIN="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-C:/Users/Amrit/AppData/Local/Android/Sdk}}"
SDK="$(cygpath -u "$SDK_WIN")"
BT="$SDK/build-tools/35.0.1"
JAR="$SDK/platforms/android-35/android.jar"
JBR_WIN="${ANDROID_STUDIO_JBR:-C:/Program Files/Android/Android Studio/jbr}"
JBIN="$(cygpath -u "$JBR_WIN")/bin"
HERE="$(cd "$(dirname "$0")" && pwd)"
B="$HERE/build"

export PATH="$JBIN:$PATH"

echo "== 1. stage web assets + bundle JS =="
node "$HERE/bundle.js"

echo "== 2. clean build dir =="
rm -rf "$B"; mkdir -p "$B/gen" "$B/classes" "$B/dex"

echo "== 3. aapt2 compile resources =="
"$BT/aapt2.exe" compile --dir "$HERE/res" -o "$B/res.zip"

echo "== 4. aapt2 link (manifest + res + assets) =="
"$BT/aapt2.exe" link \
  -o "$B/base.apk" \
  -I "$JAR" \
  --manifest "$HERE/AndroidManifest.xml" \
  -R "$B/res.zip" \
  --java "$B/gen" \
  --min-sdk-version 24 --target-sdk-version 35 \
  --auto-add-overlay

echo "== 5. javac =="
"$JBIN/javac.exe" -source 17 -target 17 -classpath "$JAR" \
  -d "$B/classes" \
  "$B/gen/com/offlineeuchre/cardgame/R.java" \
  "$HERE/java/com/offlineeuchre/cardgame/MainActivity.java"

echo "== 6. d8 -> classes.dex =="
CLASSES=$(find "$B/classes" -name '*.class')
"$BT/d8.bat" --lib "$JAR" --min-api 24 --output "$B/dex" $CLASSES

echo "== 7. add classes.dex into apk =="
cp "$B/dex/classes.dex" "$B/classes.dex"
( cd "$B" && "$BT/aapt.exe" add base.apk classes.dex )

echo "== 7b. add assets with forward-slash paths (jar, not aapt2 -A which uses \\ on Windows) =="
"$JBIN/jar.exe" uf "$B/base.apk" -C "$HERE" assets

echo "== 8. zipalign =="
"$BT/zipalign.exe" -f 4 "$B/base.apk" "$B/aligned.apk"

echo "== 9. debug keystore (create if missing) =="
KS="${EUCHRE_KEYSTORE:-$HOME/.android/euchre-debug.keystore}"
mkdir -p "$(dirname "$KS")"
if [ ! -f "$KS" ]; then
  "$JBIN/keytool.exe" -genkeypair -v -keystore "$KS" -alias euchre \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass android -keypass android -dname "CN=Euchre, O=Euchre, C=CA"
fi

echo "== 10. sign =="
"$BT/apksigner.bat" sign --ks "$KS" --ks-pass pass:android --key-pass pass:android \
  --out "$B/euchre.apk" "$B/aligned.apk"

echo ""
echo "BUILT: $B/euchre.apk"
ls -la "$B/euchre.apk"
