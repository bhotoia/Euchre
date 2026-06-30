package com.offlineeuchre.cardgame;

import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.KeyEvent;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.window.OnBackInvokedDispatcher;

public class MainActivity extends Activity {
    private WebView web;
    private FeedbackBridge feedbackBridge;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWindow();

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowContentAccess(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new WebViewClient());
        feedbackBridge = new FeedbackBridge();
        web.addJavascriptInterface(feedbackBridge, "NativeFeedback");
        web.setBackgroundColor(0xFF05140D);
        setContentView(web);

        web.loadUrl("file:///android_asset/index.html");
        hideSystemUI();
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                this::handleBack);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUI();
    }

    private void hideSystemUI() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    private void configureWindow() {
        Window window = getWindow();
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false);
        }
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams params = window.getAttributes();
            params.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(params);
        }
    }

    private void handleBack() {
        if (web == null) {
            finish();
            return;
        }
        web.evaluateJavascript(
            "window.handleNativeBack ? window.handleNativeBack() : false",
            result -> {
                if (!"true".equals(result)) finish();
            });
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (Build.VERSION.SDK_INT < 33) handleBack();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getKeyCode() == KeyEvent.KEYCODE_BACK && event.getAction() == KeyEvent.ACTION_UP) {
            handleBack();
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    protected void onDestroy() {
        if (feedbackBridge != null) feedbackBridge.release();
        if (web != null) {
            web.removeJavascriptInterface("NativeFeedback");
            web.destroy();
        }
        super.onDestroy();
    }

    private final class FeedbackBridge {
        private final Vibrator vibrator =
            (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        // Sound is handled in JS via WebAudio (softer, fully controllable). The
        // native bridge only does haptics now.

        @JavascriptInterface
        public void vibrate(String kind) {
            runOnUiThread(() -> {
                if (vibrator == null || !vibrator.hasVibrator()) return;
                long[] pattern;
                if ("trickWin".equals(kind)) pattern = new long[]{0, 16, 24, 26};
                else if ("trickLose".equals(kind)) pattern = new long[]{0, 24, 44, 18};
                else if ("handWin".equals(kind)) pattern = new long[]{0, 18, 24, 28};
                else if ("handLose".equals(kind)) pattern = new long[]{0, 24, 42, 18};
                else if ("euchreWin".equals(kind)) pattern = new long[]{0, 22, 28, 38, 34, 70};
                else if ("euchreLose".equals(kind)) pattern = new long[]{0, 25, 40, 60};
                else if ("marchWin".equals(kind)) pattern = new long[]{0, 18, 24, 32, 36};
                else if ("marchLose".equals(kind)) pattern = new long[]{0, 26, 44, 26};
                else if ("gameWin".equals(kind)) pattern = new long[]{0, 30, 45, 55, 45, 80};
                else if ("gameLose".equals(kind)) pattern = new long[]{0, 32, 55, 38};
                else if ("reward".equals(kind)) pattern = new long[]{0, 24, 30, 38, 42, 86};
                else if ("trick".equals(kind)) pattern = new long[]{0, 24, 38, 34};
                else if ("score".equals(kind)) pattern = new long[]{0, 34, 48, 58};
                else if ("bid".equals(kind)) pattern = new long[]{0, 20};
                else pattern = new long[]{0, 12};

                if (Build.VERSION.SDK_INT >= 26) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
                } else {
                    vibrator.vibrate(pattern, -1);
                }
            });
        }

        void release() {
        }
    }
}
