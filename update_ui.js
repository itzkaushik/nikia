const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Replace lockScreen HTML
const lockScreenStart = html.indexOf('<div id="lockScreen"');
const lockScreenEnd = html.indexOf('</div>', html.indexOf('</div>', html.indexOf('</div>', lockScreenStart)+1)+1) + 6; // Rough guess, we'll replace the block.
// Actually, let's use Regex to replace the lockScreen div and its contents.
const lockHtmlReplacement = `
    <div id="lockScreen">
        <h1 style="font-size:32px; margin-bottom:10px;">Nikia</h1>
        <p style="color:#a0a0b8; margin-bottom:30px;">Private Watch Party</p>
        
        <div id="requestForm" style="display:none;">
            <p style="color:#e91e8c; margin-bottom:15px; font-weight:bold;">Unauthorized Device</p>
            <input type="text" id="reqName" placeholder="Your Name" style="width:100%; padding:15px; margin-bottom:15px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:white; outline:none; font-family:inherit;">
            <input type="email" id="reqEmail" placeholder="Your Email" style="width:100%; padding:15px; margin-bottom:20px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:white; outline:none; font-family:inherit;">
            <button id="requestBtn" class="btn btn-primary" style="width:100%;">Request Access</button>
        </div>
        
        <div id="pendingStatus" style="display:none;">
            <div class="loader" style="margin: 0 auto 20px;"></div>
            <p style="color:#e91e8c; margin-bottom:10px; font-weight:bold;">Request Sent</p>
            <p style="color:#a0a0b8; font-size:14px; margin-bottom:20px;">Waiting for admin approval...</p>
            <p style="color:#505068; font-size:12px;">Contact <span style="color:white;">nikiasync@yahoo.com</span> if this takes a while.</p>
        </div>
        
        <div id="bannedStatus" style="display:none;">
            <p style="color:#e91e8c; margin-bottom:10px; font-weight:bold;">Device Banned</p>
            <p style="color:#a0a0b8; font-size:14px;">This device is permanently blocked.</p>
        </div>

        <p id="lockError" style="color:#e91e8c; margin-top:15px; display:none; font-size:14px;"></p>
    </div>
`;

// Replace the old lockScreen div. The old one ended right before <div id="app">
html = html.replace(/<div id="lockScreen"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, lockHtmlReplacement);

// 2. Replace initAuth() and checkInvite() functions
const newAuthLogic = `
        let authPollInterval = null;

        async function initAuth() {
            currentMachineId = await window.nikiaMobile?.getMachineId() || await window.nikia?.getMachineId() || 'unknown-device';
            
            checkDeviceStatus();
        }

        async function checkDeviceStatus() {
            try {
                // Fetch device status
                const { data, error } = await supabase.from('devices').select('status').eq('machine_id', currentMachineId).single();
                
                if (error || !data) {
                    // Not found = Show Request Form
                    el('requestForm').style.display = 'block';
                    el('pendingStatus').style.display = 'none';
                    el('bannedStatus').style.display = 'none';
                } else if (data.status === 'pending') {
                    // Pending = Show Waiting
                    el('requestForm').style.display = 'none';
                    el('pendingStatus').style.display = 'block';
                    el('bannedStatus').style.display = 'none';
                    startPolling();
                } else if (data.status === 'banned') {
                    // Banned
                    el('requestForm').style.display = 'none';
                    el('pendingStatus').style.display = 'none';
                    el('bannedStatus').style.display = 'block';
                    stopPolling();
                } else if (data.status === 'approved') {
                    // Approved = Unlock App!
                    stopPolling();
                    el('lockScreen').style.opacity = '0';
                    setTimeout(() => {
                        el('lockScreen').style.display = 'none';
                        loadHomepage();
                    }, 300);
                }
            } catch(e) {}
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
            
            // XSS / Basic Validation
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
                el('lockError').innerText = 'Failed to request access. Try again.';
                el('lockError').style.display = 'block';
                el('requestBtn').innerText = 'Request Access';
            } else {
                checkDeviceStatus();
            }
        });
`;

html = html.replace(/async function initAuth\(\) {[\s\S]*?async function checkInvite\(\) {[\s\S]*?\n        }/, newAuthLogic);

// Wait, the regex might not match correctly. Let's just write to file and check!
fs.writeFileSync('index.html.new', html, 'utf8');
console.log('Processed index.html.new');
