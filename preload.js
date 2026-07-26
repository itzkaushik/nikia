// ============================================================================
// NIKIA ELECTRON — PRELOAD SCRIPT
// ============================================================================
// Secure IPC bridge between Electron main process and the renderer.
// Exposes torrent controls and sync commands.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nikia', {
  // Utility: check if we're running inside Electron
  isElectron: true,
  platform: process.platform,

  // ============================
  // TORRENT CONTROLS
  // ============================

  // Start streaming a torrent. Returns nothing — listen for events below.
  startTorrent: (magnetURI) => {
    ipcRenderer.send('torrent-start', magnetURI);
  },

  // Stop the current torrent and clean up temp files
  stopTorrent: () => {
    ipcRenderer.send('torrent-stop');
  },

  // Search for torrents via Torrentio API
  searchTorrents: (imdbId, type) => {
    return ipcRenderer.invoke('torrent-search', imdbId, type);
  },

  // Search for subtitles via OpenSubtitles
  searchSubtitles: (imdbId) => {
    return ipcRenderer.invoke('subtitle-search', imdbId);
  },

  // Listen for torrent events from main process
  onTorrentReady: (callback) => {
    ipcRenderer.on('torrent-ready', (event, data) => callback(data));
  },

  onTorrentProgress: (callback) => {
    ipcRenderer.on('torrent-progress', (event, data) => callback(data));
  },

  onTorrentError: (callback) => {
    ipcRenderer.on('torrent-error', (event, data) => callback(data));
  },

  // ============================
  // SYNC COMMANDS (Phase 2)
  // ============================
  sendSyncCommand: (command) => {
    ipcRenderer.send('sync-command', command);
  },

  onSyncCommand: (callback) => {
    ipcRenderer.on('sync-command-from-main', (event, command) => {
      callback(command);
    });
  }
});

console.log('Nikia preload: bridge initialized');
