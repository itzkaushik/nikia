import { Device } from '@capacitor/device';
import { Browser } from '@capacitor/browser';

window.nikiaMobile = {
  isMobile: true,
  getMachineId: async () => {
    try {
      const info = await Device.getId();
      return info.identifier;
    } catch (e) {
      return 'android-fallback-id';
    }
  },
  checkForUpdates: async (currentVersion) => {
    try {
      // Hit the Cloudflare Worker to avoid GitHub Rate Limits
      const res = await fetch('https://cine-sync.cine-sync.workers.dev/api/latest-release');
      const latest = await res.json();
      
      if (latest && latest.tag_name && latest.tag_name !== 'v' + currentVersion && latest.tag_name !== currentVersion) {
        if (latest.apk_url) {
          const apkName = latest.apk_url.split('/').pop();
          const proxyUrl = 'https://cine-sync.cine-sync.workers.dev/updates/' + encodeURIComponent(apkName);

          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-family:Inter,sans-serif;';
          overlay.innerHTML = `
            <div style="background:#1a1a2e;padding:30px;border-radius:16px;text-align:center;max-width:90%;border:1px solid rgba(255,255,255,0.1);">
              <h2 style="margin-bottom:15px;color:#e91e8c;">Update Available!</h2>
              <p style="margin-bottom:20px;color:#a0a0b8;line-height:1.5;">A new version of Nikia (${latest.tag_name}) is available.</p>
              <button id="downloadApkBtn" style="background:#e91e8c;color:white;border:none;padding:12px 24px;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;width:100%;">Download APK</button>
            </div>
          `;
          document.body.appendChild(overlay);
          
          document.getElementById('downloadApkBtn').addEventListener('click', async () => {
            await Browser.open({ url: proxyUrl });
          });
        }
      }
    } catch (e) {
      console.error('Failed to check for updates', e);
    }
  }
};
