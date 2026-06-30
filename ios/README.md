# iPhone version

The current iPhone version is the installable iOS Home Screen/PWA build served from the web app. It is designed to feel app-like on recent iPhones without requiring an App Store build.

## Supported iPhone targets

The shell includes Apple Home Screen metadata, a 180×180 touch icon, portrait orientation, safe-area-aware layout, and launch images for common recent iPhone viewport families:

- iPhone SE / 4.7-inch Retina: 375×667 @2x
- iPhone X/XS/11 Pro style: 375×812 @3x
- iPhone XR/11 style: 414×896 @2x
- iPhone 12/13/14 style: 390×844 @3x
- iPhone 15/16 style: 393×852 @3x
- iPhone 16 Pro style: 402×874 @3x
- iPhone Plus/Pro Max style: 428×926, 430×932, and 440×956 @3x

## How to install on iPhone

1. Start the dev server: `npm start`.
2. Open the printed LAN URL in Safari on the iPhone.
3. Use Share → Add to Home Screen.
4. Launch Euchre from the Home Screen icon.

## Native App Store build

A signed native iOS `.ipa` cannot be produced from this Windows workspace because Apple requires Xcode/macOS for iOS signing and App Store packaging. If an App Store build is desired later, wrap this same web shell in a native iOS WebView target on macOS, then run the same browser/PWA checks before signing.
