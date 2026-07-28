package com.itzkaushik.nikia;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

    private long downloadID = -1;
    private BroadcastReceiver onDownloadComplete;
    private PluginCall pendingCall;

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String filename = call.getString("filename", "Nikia.apk");

        if (url == null) {
            call.reject("Must provide a URL");
            return;
        }

        try {
            Context context = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                    !context.getPackageManager().canRequestPackageInstalls()) {
                Intent manageIntent = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                        .setData(Uri.parse("package:" + context.getPackageName()))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(manageIntent);
                call.reject("INSTALL_PERMISSION_REQUIRED");
                return;
            }

            if (pendingCall != null) {
                call.reject("An update download is already in progress");
                return;
            }

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle("Downloading Nikia Update");
            request.setDescription("Downloading latest version...");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            
            // Download to app-specific external storage to avoid requiring WRITE_EXTERNAL_STORAGE
            request.setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, filename);

            DownloadManager manager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager == null) {
                call.reject("Download service is unavailable");
                return;
            }
            
            // Delete old file if exists
            File file = new File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), filename);
            if (file.exists()) {
                file.delete();
            }

            downloadID = manager.enqueue(request);
            pendingCall = call;

            if (onDownloadComplete == null) {
                onDownloadComplete = new BroadcastReceiver() {
                    @Override
                    public void onReceive(Context context, Intent intent) {
                        long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                        if (downloadID == id) {
                            installDownloadedApk(filename);
                        }
                    }
                };
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    getContext().registerReceiver(onDownloadComplete, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_EXPORTED);
                } else {
                    getContext().registerReceiver(onDownloadComplete, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
                }
            }

        } catch (Exception e) {
            pendingCall = null;
            call.reject("Download failed", e);
        }
    }

    private void installDownloadedApk(String filename) {
        try {
            Context context = getContext();
            File file = new File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), filename);
            if (!file.exists()) {
                rejectPendingCall("Downloaded APK was not found", null);
                return;
            }

            Uri apkUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                apkUri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
            } else {
                apkUri = Uri.fromFile(file);
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            context.startActivity(intent);

            if (pendingCall != null) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                pendingCall.resolve(ret);
                pendingCall = null;
            }
        } catch (Exception e) {
            e.printStackTrace();
            rejectPendingCall("Could not start the package installer", e);
        }
    }

    private void rejectPendingCall(String message, Exception exception) {
        if (pendingCall == null) return;
        if (exception == null) pendingCall.reject(message);
        else pendingCall.reject(message, exception);
        pendingCall = null;
    }
}
