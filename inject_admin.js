const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Inject HTML Overlay just before </body>
const htmlToInject = `
    <!-- Admin Overlay -->
    <div id="adminOverlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(16,16,24,0.95); z-index:10000; padding:40px; overflow-y:auto; backdrop-filter:blur(10px);">
        <div style="max-width:800px; margin:0 auto;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px;">
                <h1 style="font-size:32px; color:#e91e8c;">Admin Control Panel</h1>
                <button onclick="document.getElementById('adminOverlay').style.display='none'" style="background:none; border:none; color:white; font-size:24px; cursor:pointer;">&times;</button>
            </div>
            
            <div style="background:rgba(255,255,255,0.05); padding:20px; border-radius:12px; margin-bottom:30px;">
                <h2 style="margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">Pending Requests</h2>
                <div id="adminPendingList">
                    <p style="color:#a0a0b8;">Loading requests...</p>
                </div>
            </div>
        </div>
    </div>
`;

if (!html.includes('adminOverlay')) {
    html = html.replace('</body>', htmlToInject + '\n</body>');
}

// 2. Inject JS Logic just before </script> inside <body>
// But wait, there are multiple script tags. The main one ends near the bottom.
const jsToInject = `
        // ============================
        // ADMIN PANEL LOGIC (PHASE 2)
        // ============================
        let logoTaps = 0;
        let tapTimeout;
        let adminMasterPassword = '';

        document.querySelector('.nav-brand').addEventListener('click', () => {
            logoTaps++;
            clearTimeout(tapTimeout);
            
            if (logoTaps >= 5) {
                logoTaps = 0;
                let pwd = prompt("Enter Master Password:");
                if (pwd) {
                    adminMasterPassword = pwd;
                    document.getElementById('adminOverlay').style.display = 'block';
                    loadAdminData();
                }
            }
            
            tapTimeout = setTimeout(() => { logoTaps = 0; }, 2000);
        });

        async function loadAdminData() {
            const list = document.getElementById('adminPendingList');
            list.innerHTML = '<div class="loader" style="margin: 0 auto;"></div>';
            
            const { data, error } = await supabase.rpc('admin_get_pending', { p_password: adminMasterPassword });
            
            if (error) {
                list.innerHTML = '<p style="color:#e91e8c;">Incorrect password or server error.</p>';
                return;
            }
            
            if (!data || data.length === 0) {
                list.innerHTML = '<p style="color:#a0a0b8;">No pending requests.</p>';
                return;
            }
            
            let h = '';
            data.forEach(req => {
                h += \`
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; margin-bottom:10px;">
                    <div>
                        <strong style="display:block; font-size:16px;">\${req.name}</strong>
                        <span style="color:#a0a0b8; font-size:14px;">\${req.email}</span>
                        <div style="color:#505068; font-size:12px; margin-top:5px; font-family:monospace;">ID: \${req.machine_id}</div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button onclick="adminSetStatus('\${req.machine_id}', 'approved')" class="btn btn-primary" style="padding:8px 16px;">Approve</button>
                        <button onclick="adminSetStatus('\${req.machine_id}', 'banned')" class="btn" style="padding:8px 16px; background:#e91e8c; border:none;">Deny / Ban</button>
                    </div>
                </div>\`;
            });
            list.innerHTML = h;
        }

        window.adminSetStatus = async function(machineId, status) {
            const { error } = await supabase.rpc('admin_set_status', { 
                p_password: adminMasterPassword, 
                p_machine_id: machineId, 
                p_new_status: status 
            });
            
            if (error) {
                alert("Failed to update status. Check password.");
            } else {
                loadAdminData();
            }
        };
`;

if (!html.includes('adminMasterPassword')) {
    // Find the last </script> tag before </body>
    const lastScriptIdx = html.lastIndexOf('</script>');
    html = html.substring(0, lastScriptIdx) + jsToInject + html.substring(lastScriptIdx);
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('Admin injected');
