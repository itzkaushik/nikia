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
      
      const cleanCurrent = currentVersion.replace('v', '');
      const cleanLatest = latest && latest.tag_name ? latest.tag_name.replace('v', '') : null;
      
      const isNewer = (latestVer, currentVer) => {
        const lParts = latestVer.split('.').map(Number);
        const cParts = currentVer.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
          if ((lParts[i] || 0) > (cParts[i] || 0)) return true;
          if ((lParts[i] || 0) < (cParts[i] || 0)) return false;
        }
        return false;
      };

      if (cleanLatest && isNewer(cleanLatest, cleanCurrent)) {
        if (latest.apk_url) {
          const apkName = latest.apk_url.split('/').pop();
          const proxyUrl = 'https://cine-sync.cine-sync.workers.dev/updates/' + encodeURIComponent(apkName);

          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-family:Inter,sans-serif;';
          // Remove downloadApkLink logic and use a native button trigger instead
          overlay.innerHTML = `
            <div style="background:#1a1a2e;padding:30px;border-radius:16px;text-align:center;max-width:90%;border:1px solid rgba(255,255,255,0.1);">
              <h2 style="margin-bottom:15px;color:#e91e8c;">Update Available!</h2>
              <p style="margin-bottom:20px;color:#a0a0b8;line-height:1.5;">A new version of Nikia (${latest.tag_name}) is available.</p>
              <button id="downloadApkBtn" style="background:#e91e8c;color:white;border:none;padding:14px 24px;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;width:100%;">Install Update</button>
            </div>
          `;
          document.body.appendChild(overlay);
          
          document.getElementById('downloadApkBtn').addEventListener('click', async (e) => {
            const btn = e.target;
            btn.innerText = "Downloading...";
            btn.style.opacity = "0.7";
            btn.style.pointerEvents = "none";
            
            try {
              const { registerPlugin } = require('@capacitor/core');
              const ApkInstaller = registerPlugin('ApkInstaller');
              await ApkInstaller.downloadAndInstall({ url: proxyUrl, filename: apkName });
              btn.innerText = "Installing...";
            } catch (err) {
              console.error("Native installer failed, falling back to browser", err);
              window.open(proxyUrl, '_system');
            }
          });
        }
      }
    } catch (e) {
      console.error('Failed to check for updates', e);
    }
  }
};
