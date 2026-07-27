const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Replace lockScreen UI
// In the original file, the lockScreen div looks like this:
//     <!-- Lock Screen -->
//     <div id="lockScreen">
//         ...
//     </div>
//     <!-- Navbar -->

const lockStartStr = '    <!-- Lock Screen -->';
const lockEndStr = '    <!-- Navbar -->';

const lockStart = html.indexOf(lockStartStr);
const lockEnd = html.indexOf(lockEndStr);

if (lockStart === -1 || lockEnd === -1) {
    console.error("Could not find lockScreen boundaries!");
    process.exit(1);
}

const newLockHtml = `    <!-- Lock Screen -->
    <div id="lockScreen" style="position:fixed; top:0; left:0; width:100%; height:100%; background:#101018; z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; text-align:center;">
        <h1 style="font-size:32px; margin-bottom:10px;">Nikia</h1>
        <p style="color:#a0a0b8; margin-bottom:30px;">Private Watch Party</p>
        
        <div id="requestForm" style="display:none; width:100%; max-width:400px;">
            <p style="color:#e91e8c; margin-bottom:15px; font-weight:bold;">Unauthorized Device</p>
            <input type="text" id="reqName" placeholder="Your Name" style="width:100%; padding:15px; margin-bottom:15px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:white; outline:none; font-family:inherit;">
            <input type="email" id="reqEmail" placeholder="Your Email" style="width:100%; padding:15px; margin-bottom:20px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:white; outline:none; font-family:inherit;">
            <button id="requestBtn" class="btn btn-primary" style="width:100%;">Request Access</button>
        </div>
        
        <div id="pendingStatus" style="display:none; width:100%; max-width:400px;">
            <div class="loader" style="margin: 0 auto 20px;"></div>
            <p style="color:#e91e8c; margin-bottom:10px; font-weight:bold;">Request Sent</p>
            <p style="color:#a0a0b8; font-size:14px; margin-bottom:20px;">Waiting for admin approval...</p>
            <p style="color:#505068; font-size:12px;">Contact <span style="color:white;">nikiasync@yahoo.com</span> if this takes a while.</p>
        </div>
        
        <div id="bannedStatus" style="display:none; width:100%; max-width:400px;">
            <p style="color:#e91e8c; margin-bottom:10px; font-weight:bold;">Device Banned</p>
            <p style="color:#a0a0b8; font-size:14px;">This device is permanently blocked.</p>
        </div>

        <p id="lockError" style="color:#e91e8c; margin-top:15px; display:none; font-size:14px;"></p>
    </div>

`;

html = html.substring(0, lockStart) + newLockHtml + html.substring(lockEnd);

// 2. Replace initAuth() and checkInvite()
// Original starts at: async function initAuth() {
// Original ends at: function disconnectRoom() {
// Note: In the restored file, initAuth() is at line 946 and checkInvite() is at line 838.
// Actually, checkInvite is first:
//         async function checkInvite() {
//         ...
//         }
//
//         async function initAuth() {
//         ...
//         }
//
//         function disconnectRoom() {

const authStartStr = 'async function checkInvite() {';
const authEndStr = 'function disconnectRoom() {'; // We will replace up to disconnectRoom

const authStart = html.indexOf(authStartStr);
const authEnd = html.indexOf(authEndStr);

if (authStart === -1 || authEnd === -1) {
    console.error("Could not find auth boundaries!");
    process.exit(1);
}

const newAuthHtml = `let authPollInterval = null;

        async function initAuth() {
            currentMachineId = await window.nikiaMobile?.getMachineId() || await window.nikia?.getMachineId() || 'unknown-device';
            checkDeviceStatus();
        }

        async function checkDeviceStatus() {
            try {
                const { data, error } = await supabase.from('devices').select('status').eq('machine_id', currentMachineId).single();
                
                if (error || !data) {
                    el('requestForm').style.display = 'block';
                    el('pendingStatus').style.display = 'none';
                    el('bannedStatus').style.display = 'none';
                } else if (data.status === 'pending') {
                    el('requestForm').style.display = 'none';
                    el('pendingStatus').style.display = 'block';
                    el('bannedStatus').style.display = 'none';
                    startPolling();
                } else if (data.status === 'banned') {
                    el('requestForm').style.display = 'none';
                    el('pendingStatus').style.display = 'none';
                    el('bannedStatus').style.display = 'block';
                    stopPolling();
                } else if (data.status === 'approved') {
                    stopPolling();
                    el('lockScreen').style.opacity = '0';
                    setTimeout(() => {
                        el('lockScreen').style.display = 'none';
                        el('app').style.display = 'flex';
                        initApp();
                    }, 300);
                }
            } catch(e) {
                console.error("Supabase error:", e);
                el('lockError').innerText = 'Could not connect to server.';
                el('lockError').style.display = 'block';
            }
        }

        function startPolling() {
            if (authPollInterval) return;
            authPollInterval = setInterval(checkDeviceStatus, 5000);
        }
        function stopPolling() {
            if (authPollInterval) {
                clearInterval(authPollInterval);
                authPollInterval = null;
            }
        }

        document.getElementById('requestBtn').addEventListener('click', async () => {
            const name = document.getElementById('reqName').value.trim();
            const email = document.getElementById('reqEmail').value.trim();
            
            if (!name || !email) {
                el('lockError').innerText = 'Please enter name and email.';
                el('lockError').style.display = 'block';
                return;
            }
            if (name.length > 50 || email.length > 100 || name.includes('<') || email.includes('<')) {
                el('lockError').innerText = 'Invalid input format.';
                el('lockError').style.display = 'block';
                return;
            }

            el('requestBtn').innerText = 'Sending...';
            el('lockError').style.display = 'none';

            const { error } = await supabase.from('devices').insert([{
                machine_id: currentMachineId,
                name: name,
                email: email,
                status: 'pending'
            }]);

            if (error) {
                console.error(error);
                el('lockError').innerText = 'Failed to request access. Try again.';
                el('lockError').style.display = 'block';
                el('requestBtn').innerText = 'Request Access';
            } else {
                checkDeviceStatus();
            }
        });

        // ============================
        // ROOM-BASED WEBSOCKET SYSTEM
        // ============================
        var socket = null;
        var currentRoomCode = null;
        var lastSyncTime = 0;

        function generateRoomCode() {
            var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            var code = '';
            for (var i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
            return code;
        }

        var heartbeatInterval = null;

        function connectToRoom(roomCode, isHost = false, maxMembers = null) {
            if (socket) { socket.close(); socket = null; }
            if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
            currentRoomCode = roomCode.toUpperCase();
            
            var wsUrl = 'wss://cine-sync.cine-sync.workers.dev/ws?room=' + currentRoomCode + '&token=' + (currentJwtToken || '') + '&machine=' + (currentMachineId || '');
            if (isHost && maxMembers) {
                wsUrl += '&isHost=true&max=' + maxMembers;
            }
            
            socket = new WebSocket(wsUrl);

            socket.onopen = function() {
                el('syncBadge').classList.remove('disconnected');
                el('syncBadge').classList.add('in-room');
                el('syncLabel').textContent = 'Room: ' + currentRoomCode;
                el('roomNotConnected').style.display = 'none';
                el('roomConnected').style.display = 'block';
                el('roomCodeDisplay').textContent = currentRoomCode;

                if (amIHost) {
                    heartbeatInterval = setInterval(function() {
                        if (socket && socket.readyState === WebSocket.OPEN) {
                            var t = 0;
                            if (currentPlayMode === 'torrent' && player) {
                                t = player.currentTime();
                            } else if (el('embedFrame').contentWindow) {
                                el('embedFrame').contentWindow.postMessage({ type: 'Nikia_SYNC_COMMAND', action: 'heartbeat_req' }, '*');
                                return; 
                            }
                            wsSend({ type: 'sync_heartbeat', currentTime: t });
                        }
                    }, 5000);
                }
            };
            socket.onclose = function(e) {
                if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
                el('syncBadge').classList.add('disconnected');
                el('syncBadge').classList.remove('in-room');
                el('syncLabel').textContent = 'Disconnected';
                el('roomConnected').style.display = 'none';
                el('roomNotConnected').style.display = 'block';
                socket = null;
                
                if (e && e.code === 4001) {
                    alert('Room is Full! The host has reached the maximum number of members for this room.');
                    return;
                }
                if (e && e.code === 4003) {
                    alert('Unauthorized: Only the host can create this room.');
                    return;
                }
                
                if (currentRoomCode) {
                    setTimeout(function() {
                        if (currentRoomCode) connectToRoom(currentRoomCode);
                    }, 3000);
                }
            };
            socket.onmessage = function(event) {
                var data = JSON.parse(event.data);
                console.log('WS received:', data.type, data);

                if (data.type === 'sync_media') {
                    if (!amIHost) openWatch(data.id, data.mediaType, true); 
                    return;
                }

                if (data.type === 'sync_start') {
                    if (!amIHost) {
                        currentSeason = data.season || 1;
                        currentEpisode = data.episode || 1;
                        el('detailsView').style.display = 'none';
                        el('playerView').style.display = 'block';
                        loadProvider(data.provider, true); 
                    }
                    return;
                }

                if (data.type === 'sync_torrent') {
                    if (!amIHost) {
                        currentPlayMode = 'torrent';
                        el('detailsView').style.display = 'none';
                        el('playerView').style.display = 'block';
                        el('serverSection').style.display = 'none';
                        el('iframeContainer').classList.remove('visible');
                        el('playerContainer').style.display = 'block';
                        el('torrentProgressBar').style.display = 'block';
                        el('torrentProgressLabel').textContent = 'Connecting to peers...';
                        el('torrentProgressFill').style.width = '0%';
                        
                        if (window.nikia && window.nikia.startTorrent) {
                            window.nikia.startTorrent(data.magnetURI);
                        }
                    }
                    return;
                }

                if (data.type === 'play' || data.type === 'pause' || data.type === 'seek' || data.type === 'sync_heartbeat') {
                    if (data.type === 'sync_heartbeat') {
                        if (amIHost) return; 
                        var currentT = 0;
                        if (currentPlayMode === 'torrent' && player) {
                            currentT = player.currentTime();
                        } else if (window.__lastKnownIframeTime) {
                            currentT = window.__lastKnownIframeTime;
                        } else {
                            data.type = 'seek';
                        }
                        
                        if (data.type === 'sync_heartbeat' && Math.abs(currentT - data.currentTime) < 2) {
                            return;
                        } else if (data.type === 'sync_heartbeat') {
                            data.type = 'seek';
                        }
                    }

                    lastSyncTime = Date.now();
                    
                    if (currentPlayMode === 'torrent') {
                        if (data.type === 'play') {
                            player.currentTime(data.currentTime);
                            player.play();
                        } else if (data.type === 'pause') {
                            player.currentTime(data.currentTime);
                            player.pause();
                        } else if (data.type === 'seek') {
                            player.currentTime(data.currentTime);
                        }
                    } else {
                        var iframe = el('embedFrame');
                        if (iframe && iframe.contentWindow) {
                            iframe.contentWindow.postMessage({
                                type: 'Nikia_SYNC_COMMAND',
                                action: data.type,
                                currentTime: data.currentTime
                            }, '*');
                        }
                    }
                    return;
                }
            };
        }

        `;

html = html.substring(0, authStart) + newAuthHtml + html.substring(authEnd);

fs.writeFileSync('index.html', html, 'utf8');
console.log('REPLACEMENT COMPLETED SUCCESSFULLY');
