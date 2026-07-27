// ============================================================================
// Nikia ELECTRON â€” MAIN PROCESS
// ============================================================================
// Creates the window, strips iframe security headers, blocks popups/redirects,
// and injects the Video Sync Bridge into every provider iframe.

const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const OpenSubtitles = require('opensubtitles-api');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const { machineIdSync } = require('node-machine-id');

// Setup Auto Updater Logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

// Initialize OpenSubtitles API (using a generic user agent)
const OS = new OpenSubtitles('TemporaryUserAgent');

// Enforce single instance to prevent Chromium cache/localStorage locks
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

let mainWindow = null;
let torrentClient = null;
let torrentServer = null;
let currentTorrent = null;

// Temp directory for torrent downloads â€” auto-cleaned on exit
const TORRENT_TEMP_DIR = path.join(os.tmpdir(), 'Nikia-torrents');

// ============================================================================
// TORRENT ENGINE
// ============================================================================

async function getTorrentClient() {
  if (!torrentClient) {
    const { default: WebTorrent } = await import('webtorrent');
    torrentClient = new WebTorrent();
    torrentServer = torrentClient.createServer();
    torrentServer.listen(0);
  }
  return torrentClient;
}

// Safely delete a directory and all contents, catching EPERM
function safeDeleteDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        safeDeleteDir(curPath);
      } else {
        try { fs.unlinkSync(curPath); } catch (e) { /* ignore file lock */ }
      }
    }
    try { fs.rmdirSync(dirPath); } catch (e) { /* ignore dir lock */ }
  } catch (e) {
    // Ignore read errors
  }
}

// Clean up temp directory
function cleanupTorrents() {
  try {
    if (currentTorrent) {
      currentTorrent.destroy();
      currentTorrent = null;
    }
    if (torrentServer) {
      torrentServer.close();
      torrentServer = null;
    }
    if (torrentClient) {
      torrentClient.destroy();
      torrentClient = null;
    }
    // Remove temp files â€” wait a tick for Windows to release file locks
    setTimeout(() => {
      safeDeleteDir(TORRENT_TEMP_DIR);
      console.log('Nikia: Cleaned up torrent temp files');
    }, 1000);
  } catch (e) {
    console.error('Nikia: Cleanup error:', e.message);
  }
}

// ============================================================================
// IPC HANDLERS FOR TORRENT
// ============================================================================

// Search for torrents via Torrentio API
ipcMain.handle('torrent-search', async (event, imdbId, type) => {
  try {
    const streamType = type === 'tv' ? 'series' : 'movie';
    const response = await fetch(`https://torrentio.strem.fun/stream/${streamType}/${imdbId}.json`);
    const data = await response.json();
    
    if (!data.streams || data.streams.length === 0) {
      return { error: 'No torrents found', streams: [] };
    }

    // Parse and format the streams for the UI
    const streams = data.streams.map(s => {
      // Extract quality info from the title
      const title = s.title || s.name || 'Unknown';
      const infoHash = s.infoHash;
      const magnetURI = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(title)}`;
      
      // Add common trackers for better peer discovery
      const trackers = [
        'udp://tracker.opentrackr.org:1337/announce',
        'udp://open.stealth.si:80/announce',
        'udp://tracker.torrent.eu.org:451/announce',
        'udp://open.demonii.com:1337/announce',
        'udp://exodus.desync.com:6969/announce'
      ];
      const trackersStr = trackers.map(t => '&tr=' + encodeURIComponent(t)).join('');

      return {
        title: title,
        infoHash: infoHash,
        magnetURI: magnetURI + trackersStr,
        fileIdx: s.fileIdx || 0,
        behaviorHints: s.behaviorHints || {}
      };
    }).slice(0, 15); // Limit to 15 results

    return { streams };
  } catch (e) {
    return { error: e.message, streams: [] };
  }
});

// Search for subtitles
ipcMain.handle('subtitle-search', async (event, imdbId) => {
  try {
    const numericId = imdbId.startsWith('tt') ? imdbId : 'tt' + imdbId;
    
    // Use Stremio's public v3 opensubtitles proxy (free, no auth required)
    const response = await fetch(`https://opensubtitles-v3.strem.io/subtitles/movie/${numericId}.json`);
    const data = await response.json();

    if (data && data.subtitles && data.subtitles.length > 0) {
      // Find the first English subtitle
      const engSub = data.subtitles.find(s => s.lang === 'eng' || s.lang === 'en');
      if (engSub) {
        // Fetch the actual subtitle content
        const subRes = await fetch(engSub.url);
        const srtText = await subRes.text();
        
        // Extremely simple SRT to VTT converter in-memory
        let vttText = "WEBVTT\n\n";
        const lines = srtText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].match(/^\d+$/)) {
            // skip index
          } else if (lines[i].match(/-->/)) {
            // replace commas with dots in timestamps
            vttText += lines[i].replace(/,/g, ".") + "\n";
          } else {
            vttText += lines[i] + "\n";
          }
        }
        
        return { vtt: vttText, filename: 'English Auto-Subtitle' };
      }
    }
    return { error: 'No English subtitles found' };
  } catch (e) {
    return { error: e.message };
  }
});

// Start streaming a torrent
ipcMain.on('torrent-start', async (event, magnetURI) => {
  // Stop any existing torrent first
  if (currentTorrent) {
    currentTorrent.destroy();
    currentTorrent = null;
  }

  // Ensure temp directory exists
  if (!fs.existsSync(TORRENT_TEMP_DIR)) {
    fs.mkdirSync(TORRENT_TEMP_DIR, { recursive: true });
  }

  const client = await getTorrentClient();

  try {
    currentTorrent = client.add(magnetURI, { path: TORRENT_TEMP_DIR }, (torrent) => {
      console.log('Nikia Torrent: Added', torrent.name);

      // Find the largest video file (that's the movie)
      const videoExtensions = ['.mp4', '.mkv', '.avi', '.webm', '.m4v'];
      const videoFile = torrent.files
        .filter(f => videoExtensions.some(ext => f.name.toLowerCase().endsWith(ext)))
        .sort((a, b) => b.length - a.length)[0];

      if (!videoFile) {
        mainWindow?.webContents.send('torrent-error', { message: 'No video file found in torrent' });
        return;
      }

      // Prioritize sequential download for streaming
      videoFile.select();

      // Use the global torrent server (started in getTorrentClient)
      const port = torrentServer.server.address().port;
      const filePath = videoFile.path.replace(/\\/g, '/');
      const streamUrl = `http://localhost:${port}/webtorrent/${torrent.infoHash}/${encodeURIComponent(filePath)}`;
      
      console.log('Nikia Torrent: Streaming at', streamUrl);
      mainWindow?.webContents.send('torrent-ready', {
        url: streamUrl,
        name: torrent.name,
        fileName: videoFile.name,
        size: videoFile.length,
        magnetURI: magnetURI
      });
    });

    // Progress updates
    const progressInterval = setInterval(() => {
      if (!currentTorrent) {
        clearInterval(progressInterval);
        return;
      }
      mainWindow?.webContents.send('torrent-progress', {
        progress: Math.round(currentTorrent.progress * 100),
        downloadSpeed: currentTorrent.downloadSpeed,
        uploadSpeed: currentTorrent.uploadSpeed,
        numPeers: currentTorrent.numPeers,
        downloaded: currentTorrent.downloaded,
        total: currentTorrent.length
      });
    }, 1000);

    currentTorrent.on('error', (err) => {
      console.error('Nikia Torrent error:', err.message);
      mainWindow?.webContents.send('torrent-error', { message: err.message });
    });

  } catch (e) {
    mainWindow?.webContents.send('torrent-error', { message: e.message });
  }
});

// Stop current torrent
ipcMain.on('torrent-stop', () => {
  if (currentTorrent) {
    currentTorrent.destroy();
    currentTorrent = null;
    console.log('Nikia: Stopped torrent');
    // Also clean up temp files immediately
    setTimeout(() => { safeDeleteDir(TORRENT_TEMP_DIR); }, 1000);
  }
});

// ============================================================================
// VIDEO SYNC BRIDGE SCRIPT
// ============================================================================
// This script is injected into every child frame. It finds <video> elements,
// attaches play/pause/seek listeners, and relays events to the parent page
// via postMessage. It also listens for incoming sync commands from the parent.
const SYNC_BRIDGE_SCRIPT = `
  // Guard: don't inject twice in the same frame
  if (window.__Nikia_bridge_active) { /* already injected */ } else {
    window.__Nikia_bridge_active = true;

    // --- POPUP BLOCKER ---
    window.open = function() {
      console.log('Nikia: Blocked window.open from frame');
      return null;
    };

    // --- VIDEO SYNC BRIDGE ---
    (function() {
      var syncedVideo = null;
      var expectedPlayState = null;
      var expectedSeekTime = -1;

      function hookVideo(video) {
        if (syncedVideo === video) return;
        syncedVideo = video;
        console.log('Nikia Sync Bridge: Found <video>, attaching listeners');

        video.addEventListener('play', function() {
          if (expectedPlayState === 'play') {
            expectedPlayState = null;
            return;
          }
          window.top.postMessage({ type: 'Nikia_IFRAME_EVENT', event: 'play', currentTime: video.currentTime }, '*');
        });

        video.addEventListener('pause', function() {
          if (expectedPlayState === 'pause') {
            expectedPlayState = null;
            return;
          }
          window.top.postMessage({ type: 'Nikia_IFRAME_EVENT', event: 'pause', currentTime: video.currentTime }, '*');
        });

        video.addEventListener('seeked', function() {
          if (expectedSeekTime !== -1 && Math.abs(video.currentTime - expectedSeekTime) < 1) {
            expectedSeekTime = -1;
            return;
          }
          window.top.postMessage({ type: 'Nikia_IFRAME_EVENT', event: 'seek', currentTime: video.currentTime }, '*');
        });
      }

      // Listen for sync commands FROM the parent
      window.addEventListener('message', function(e) {
        if (!e.data || e.data.type !== 'Nikia_SYNC_COMMAND') return;
        
        // Forward command to child iframes if we don't have the video
        if (!syncedVideo) {
          for (var i = 0; i < window.frames.length; i++) {
            window.frames[i].postMessage(e.data, '*');
          }
          return;
        }

        var cmd = e.data;
        try {
          if (cmd.action === 'heartbeat_req') {
            window.top.postMessage({ type: 'Nikia_IFRAME_EVENT', event: 'heartbeat', currentTime: syncedVideo.currentTime }, '*');
            return;
          }
          
          if (cmd.action === 'play') {
            if (!syncedVideo.paused) return; // Already playing
            expectedPlayState = 'play';
            syncedVideo.currentTime = cmd.currentTime;
            syncedVideo.play().catch(function(){});
          } else if (cmd.action === 'pause') {
            if (syncedVideo.paused) return; // Already paused
            expectedPlayState = 'pause';
            syncedVideo.currentTime = cmd.currentTime;
            syncedVideo.pause();
          } else if (cmd.action === 'seek') {
            if (Math.abs(syncedVideo.currentTime - cmd.currentTime) > 1) {
              expectedSeekTime = cmd.currentTime;
              syncedVideo.currentTime = cmd.currentTime;
            }
          }
        } catch (err) {
          console.error('Nikia Sync Bridge Error:', err);
        }
      });

      // Hook existing videos
      document.querySelectorAll('video').forEach(hookVideo);

      // Watch for dynamically added videos
      var observer = new MutationObserver(function(mutations) {
        for (var m of mutations) {
          for (var node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.tagName === 'VIDEO') hookVideo(node);
            var vids = node.querySelectorAll ? node.querySelectorAll('video') : [];
            vids.forEach(hookVideo);
          }
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    })();
  }
`;

// ============================================================================
// INJECT SYNC BRIDGE INTO ALL CHILD FRAMES (RECURSIVE)
// ============================================================================
function injectIntoAllFrames() {
  if (!mainWindow) return;
  try {
    const mainFrame = mainWindow.webContents.mainFrame;
    function injectRecursive(frame) {
      // Only inject into child frames, not the main frame (our index.html)
      if (frame !== mainFrame) {
        frame.executeJavaScript(SYNC_BRIDGE_SCRIPT).catch(() => {});
      }
      // Recurse into nested iframes (providers sometimes use multiple layers)
      for (const child of frame.frames) {
        injectRecursive(child);
      }
    }
    injectRecursive(mainFrame);
  } catch (e) {
    // Frames may not be ready yet; that's fine, we'll catch them next time
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0f',
    title: 'Nikia',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  mainWindow.loadFile('index.html');

  ipcMain.handle('get-machine-id', () => {
    return machineIdSync();
  });

  // ============================================================================
  // POPUP BLOCKER â€” Block all window.open() calls
  // ============================================================================
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log('Nikia: Blocked popup window:', url);
    return { action: 'deny' };
  });

  // ============================================================================
  // REDIRECT BLOCKER â€” Prevent main window hijack
  // ============================================================================
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://') || url.includes('cine-sync.workers.dev')) {
      return;
    }
    console.log('Nikia: Blocked top-level navigation to:', url);
    event.preventDefault();
  });

  // ============================================================================
  // BLOCK POPUPS FROM WEBVIEWS
  // ============================================================================
  mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
    webContents.setWindowOpenHandler(({ url }) => {
      console.log('Nikia: Blocked webview popup:', url);
      return { action: 'deny' };
    });
  });

  // ============================================================================
  // INJECT SYNC BRIDGE WHEN ANY CHILD FRAME FINISHES LOADING
  // ============================================================================
  // This fires every time an iframe (or nested iframe) finishes loading.
  // We inject the sync bridge script into ALL child frames.
  // The script is idempotent (has a __Nikia_bridge_active guard).
  mainWindow.webContents.on('did-frame-finish-load', (event, isMainFrame) => {
    if (isMainFrame) return; // don't inject into our own index.html
    injectIntoAllFrames();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================================
// STRIP IFRAME SECURITY HEADERS
// ============================================================================
app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };

    const keysToRemove = Object.keys(headers).filter(key => {
      const lower = key.toLowerCase();
      return lower === 'x-frame-options' ||
             lower === 'content-security-policy' ||
             lower === 'content-security-policy-report-only';
    });

    keysToRemove.forEach(key => delete headers[key]);

    callback({ cancel: false, responseHeaders: headers });
  });

  createWindow();

  // Check for updates
  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (err) {
    log.error('Failed to check for updates:', err);
  }

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded, asking user to restart.');
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'A new version of Nikia has been downloaded. Restart the application to apply the updates.',
      buttons: ['Restart Now', 'Later']
    }).then((returnValue) => {
      if (returnValue.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  cleanupTorrents();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  cleanupTorrents();
});
