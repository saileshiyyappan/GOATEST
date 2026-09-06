package com.goatest.app;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

import android.content.Intent;
import android.webkit.WebView;
import android.os.Build;
import android.os.Bundle;
import android.graphics.Color;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.os.Handler;
import android.webkit.JavascriptInterface;
import android.window.OnBackInvokedDispatcher;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebViewRenderProcess;
import android.webkit.WebViewRenderProcessClient;
import android.widget.Toast;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "GoatestLifecycle";
    private static final long DOUBLE_BACK_EXIT_WINDOW_MS = 2000L;
    private static final String STATE_HANDLED = "HANDLED";
    private static final String STATE_ROOT = "ROOT";
    private static final String STATE_UNKNOWN = "UNKNOWN";
    private long lastBackAt = 0L;
    private String armedRootKey = null;
    private WebView activeWebView = null;
    private boolean rendererGone = false;
    private boolean destroyed = false;
    private final Handler systemBarHandler = new Handler();
    private final Runnable surfaceProbe = new Runnable() {
        @Override public void run() {
            WebView webView = getActiveWebView();
            if (webView != null && !destroyed && !rendererGone) {
                try {
                    webView.evaluateJavascript("(document.documentElement.classList.contains('theme-white'))", value -> {
                        if (!destroyed && !rendererGone) setSurfaceIsDark(!"true".equals(value));
                    });
                } catch (RuntimeException error) {
                    Log.w(TAG, "Surface probe skipped; WebView unavailable", error);
                }
                systemBarHandler.postDelayed(this, 500);
            }
        }
    };

    private final WebViewListener webViewListener = new WebViewListener() {
        @Override public void onPageLoaded(WebView webView) {
            Log.d(TAG, "WebView page loaded");
            installJavascriptDiagnostics(webView);
        }

        @Override public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
            rendererGone = true;
            activeWebView = null;
            systemBarHandler.removeCallbacks(surfaceProbe);
            cancelExitArm("renderer-gone");
            Log.e(TAG, "WebView render process gone; didCrash=" + detail.didCrash() + ", priority=" + detail.rendererPriorityAtExit());
            return true;
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        destroyed = false;
        rendererGone = false;
        Log.i(TAG, "Activity create");
        if (getBridge() != null) getBridge().addWebViewListener(webViewListener);
        WebView webView = getBridge() == null ? null : getBridge().getWebView();
        activeWebView = webView;
        if (webView != null) {
            webView.addJavascriptInterface(new SystemBarBridge(), "GoatestSystemBars");
            webView.setOnLongClickListener(view -> webView.getHitTestResult().getType() != WebView.HitTestResult.EDIT_TEXT_TYPE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                webView.setWebViewRenderProcessClient(new WebViewRenderProcessClient() {
                    @Override public void onRenderProcessResponsive(WebView view, WebViewRenderProcess renderer) {
                        Log.d(TAG, "WebView render process responsive");
                    }

                    @Override public void onRenderProcessUnresponsive(WebView view, WebViewRenderProcess renderer) {
                        Log.w(TAG, "WebView render process unresponsive");
                    }
                });
            }
            installJavascriptDiagnostics(webView);
            Log.d(TAG, "WebView initialized");
        } else {
            Log.w(TAG, "WebView unavailable during Activity create");
        }
        setSurfaceIsDark(true);
        systemBarHandler.post(surfaceProbe);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_OVERLAY,
                    this::handleBack
            );
        }
    }

    @Override public void onStart() {
        super.onStart();
        Log.d(TAG, "Activity start");
    }

    private void setSurfaceIsDark(boolean dark) {
        Window window = getWindow();
        window.setStatusBarColor(dark ? Color.BLACK : Color.WHITE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.getInsetsController().setSystemBarsAppearance(dark ? 0 : android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS, android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
        } else {
            int flags = window.getDecorView().getSystemUiVisibility();
            window.getDecorView().setSystemUiVisibility(dark ? flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR : flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
    }

    @Override public void onResume() {
        super.onResume();
        Log.d(TAG, "Activity resume");
        if (!destroyed && !rendererGone && activeWebView == null && getBridge() != null) activeWebView = getBridge().getWebView();
        systemBarHandler.removeCallbacks(surfaceProbe);
        if (!destroyed && !rendererGone) systemBarHandler.post(surfaceProbe);
    }

    @Override public void onPause() {
        Log.d(TAG, "Activity pause");
        cancelExitArm("pause");
        systemBarHandler.removeCallbacks(surfaceProbe);
        super.onPause();
    }

    @Override public void onStop() {
        Log.d(TAG, "Activity stop");
        cancelExitArm("stop");
        systemBarHandler.removeCallbacks(surfaceProbe);
        super.onStop();
    }

    @Override public void onDestroy() {
        Log.d(TAG, "Activity destroy");
        destroyed = true;
        rendererGone = true;
        cancelExitArm("destroy");
        activeWebView = null;
        systemBarHandler.removeCallbacks(surfaceProbe);
        super.onDestroy();
    }

    @Override public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        cancelExitArm("new-intent");
        Log.d(TAG, "Activity new intent");
    }

    private final class SystemBarBridge {
        @JavascriptInterface public void setDarkSurface(boolean dark) { runOnUiThread(() -> setSurfaceIsDark(dark)); }
        @JavascriptInterface public void onNavigationChanged() { runOnUiThread(() -> cancelExitArm("web-navigation")); }
        @JavascriptInterface public boolean isNativeFirebaseConfigured() {
            return getResources().getIdentifier("google_app_id", "string", getPackageName()) != 0;
        }
    }

    @Override
    public void onBackPressed() {
        Log.d(TAG, "Back pressed");
        handleBack();
    }

    private WebView getActiveWebView() {
        if (destroyed || rendererGone) return null;
        if (activeWebView != null) return activeWebView;
        if (getBridge() == null) return null;
        activeWebView = getBridge().getWebView();
        return activeWebView;
    }

    private void installJavascriptDiagnostics(WebView webView) {
        if (webView == null || destroyed || rendererGone) return;
        String script = "(function(){"
                + "if(window.__goatestLifecycleDiagnosticsInstalled)return;"
                + "window.__goatestLifecycleDiagnosticsInstalled=true;"
                + "window.addEventListener('error',function(e){var n=e&&e.error&&e.error.name||'Error';var m=e&&e.message||'Unknown JavaScript error';console.warn('[GOATEST_JS_ERROR]',String(n).slice(0,80),String(m).slice(0,240));},true);"
                + "window.addEventListener('unhandledrejection',function(e){var r=e&&e.reason;var n=r&&r.name||'UnhandledRejection';var m=r&&r.message||String(r||'Unknown rejection');console.warn('[GOATEST_JS_REJECTION]',String(n).slice(0,80),String(m).slice(0,240));},true);"
                + "window.addEventListener('popstate',function(){if(window.GoatestSystemBars&&window.GoatestSystemBars.onNavigationChanged)window.GoatestSystemBars.onNavigationChanged();});"
                + "new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){if(ms[i].attributeName==='data-home-active-tab'&&window.GoatestSystemBars&&window.GoatestSystemBars.onNavigationChanged){window.GoatestSystemBars.onNavigationChanged();break;}}}).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['data-home-active-tab']});"
                + "})()";
        try {
            webView.evaluateJavascript(script, null);
        } catch (RuntimeException error) {
            Log.w(TAG, "JavaScript diagnostics could not be installed", error);
        }
    }

    private void cancelExitArm(String reason) {
        if (armedRootKey != null) Log.d(TAG, "Exit arm cancelled: " + reason);
        armedRootKey = null;
        lastBackAt = 0L;
    }

    private void handleBack() {
        WebView webView = getActiveWebView();
        if (webView == null) {
            Log.w(TAG, "Back ignored because WebView is unavailable");
            cancelExitArm("webview-unavailable");
            return;
        }

        String backScript = "(function(){"
                + "var close=document.querySelector('[aria-label=\\\"Close report viewer\\\"]')||"
                + "document.querySelector('button[aria-label=\\\"Close dialog\\\"]');"
                + "if(!close){var modal=document.querySelector('.fixed.inset-0');if(modal)close=modal.querySelector('button');}"
                + "if(close){close.click();return JSON.stringify({state:'HANDLED',route:location.pathname,key:'modal'});}"
                + "var path=location.pathname.replace(/\\/+$/, '')||'/';"
                + "if(path==='/condition'){history.back();return JSON.stringify({state:'HANDLED',route:path,key:'condition'});}"
                + "if(path==='/shb'||path==='/crib'){"
                + "history.pushState({},'', '/home');window.dispatchEvent(new PopStateEvent('popstate'));return JSON.stringify({state:'HANDLED',route:path,key:path});}"
                + "var shell=document.querySelector('[data-home-active-tab]');"
                + "if(shell&&shell.getAttribute('data-home-active-tab')!=='home'){"
                + "var home=document.querySelector('button[title=\"Home\"]');if(home){home.click();return JSON.stringify({state:'HANDLED',route:path,key:'tab:'+shell.getAttribute('data-home-active-tab')});}"
                + "}"
                + "return JSON.stringify({state:path==='/home'&&shell&&shell.getAttribute('data-home-active-tab')==='home'?'ROOT':'UNKNOWN',route:path,key:path+'|'+(shell?shell.getAttribute('data-home-active-tab'):'')});})()";

        try {
            webView.evaluateJavascript(backScript, result -> handleBackDecision(parseBackDecision(result)));
        } catch (RuntimeException error) {
            Log.w(TAG, "Back route evaluation failed; keeping Activity alive", error);
            cancelExitArm("back-evaluation-failed");
        }
    }

    private BackDecision parseBackDecision(String result) {
        if (result == null || result.length() < 2) return new BackDecision(STATE_UNKNOWN, "");
        try {
            JSONObject value = new JSONObject(result.substring(1, result.length() - 1).replace("\\\"", "\""));
            return new BackDecision(value.optString("state", STATE_UNKNOWN), value.optString("key", ""));
        } catch (Exception error) {
            Log.w(TAG, "Malformed back decision; treating as UNKNOWN", error);
            return new BackDecision(STATE_UNKNOWN, "");
        }
    }

    private void handleBackDecision(BackDecision decision) {
        Log.d(TAG, "Back decision state=" + decision.state + ", key=" + decision.key);
        if (STATE_HANDLED.equals(decision.state) || STATE_UNKNOWN.equals(decision.state)) {
            cancelExitArm(STATE_UNKNOWN.equals(decision.state) ? "unknown-route" : "internal-navigation");
            return;
        }
        if (!STATE_ROOT.equals(decision.state) || decision.key.isEmpty()) {
            cancelExitArm("invalid-root-decision");
            return;
        }
        long now = System.currentTimeMillis();
        if (decision.key.equals(armedRootKey) && now - lastBackAt <= DOUBLE_BACK_EXIT_WINDOW_MS) {
            Log.i(TAG, "Intentional confirmed root double-back exit");
            armedRootKey = null;
            lastBackAt = 0L;
            finish();
            return;
        }
        armedRootKey = decision.key;
        lastBackAt = now;
        Toast.makeText(MainActivity.this, "Press back again to exit", Toast.LENGTH_SHORT).show();
    }

    private static final class BackDecision {
        private final String state;
        private final String key;

        private BackDecision(String state, String key) {
            this.state = state;
            this.key = key;
        }
    }
}
