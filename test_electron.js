const { app, BrowserWindow, session } = require('electron');
app.whenReady().then(() => {
  app.configureHostResolver({
    enableBuiltInResolver: true,
    secureDnsMode: 'secure',
    secureDnsServers: ['https://chrome.cloudflare-dns.com/dns-query', 'https://dns.google/dns-query']
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    delete headers['x-frame-options'];
    delete headers['content-security-policy'];
    delete headers['content-security-policy-report-only'];
    callback({ cancel: false, responseHeaders: headers });
  });

  session.defaultSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    if (details.url.includes('.m3u8') || details.url.includes('.ts') || details.url.includes('strmd.b-cdn.net')) {
      console.log('NikiaReq:', details.url);
    }
    callback({ cancel: false });
  });
  
  session.defaultSession.webRequest.onErrorOccurred({ urls: ['*://*/*'] }, (details) => {
    if (details.url.includes('.m3u8') || details.url.includes('embed.st') || details.url.includes('streamed')) {
      console.log('NikiaErr:', details.url, details.error);
    }
  });

  const win = new BrowserWindow({ width: 800, height: 600, show: false });
  win.webContents.on('console-message', (event, level, message) => {
    if(message.includes('Error') || message.includes('hls')) console.log('Console:', message);
  });
  win.loadURL('https://embed.st/embed/admin/ppv-chelsea-vs-western-sydney-wanderers/1');

  setTimeout(() => {
    app.quit();
  }, 15000);
});
