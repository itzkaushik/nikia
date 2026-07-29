(function() {
    const btnFootball = document.getElementById('btnFootball');
    const btnUFC = document.getElementById('btnUFC');
    const sportsGrid = document.getElementById('sportsGrid');

    if (!btnFootball || !btnUFC || !sportsGrid) return;

    btnFootball.addEventListener('click', () => loadMatches('football'));
    btnUFC.addEventListener('click', () => loadMatches('fight'));

    async function fetchWithTimeout(url, options = {}, timeout = 8000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (e) {
            clearTimeout(id);
            throw e;
        }
    }

    async function loadMatches(category) {
        sportsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 60px 20px;">
                <div class="spinner" style="width: 36px; height: 36px; border: 3px solid rgba(255,255,255,0.1); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px;"></div>
                <div>Loading live ${category === 'football' ? 'football' : 'UFC'} matches...</div>
            </div>
        `;
        
        // Update button states
        if (category === 'football') {
            btnFootball.className = 'room-btn primary';
            btnFootball.style.background = '';
            btnFootball.style.borderColor = '';
            btnFootball.style.color = '';

            btnUFC.className = 'room-btn secondary';
            btnUFC.style.background = 'rgba(233,30,140,0.1)';
            btnUFC.style.borderColor = 'rgba(233,30,140,0.3)';
            btnUFC.style.color = 'var(--accent)';
        } else {
            btnUFC.className = 'room-btn primary';
            btnUFC.style.background = '';
            btnUFC.style.borderColor = '';
            btnUFC.style.color = '';
            
            btnFootball.className = 'room-btn secondary';
            btnFootball.style.background = 'rgba(233,30,140,0.1)';
            btnFootball.style.borderColor = 'rgba(233,30,140,0.3)';
            btnFootball.style.color = 'var(--accent)';
        }

        try {
            let matches = null;
            try {
                const res = await fetchWithTimeout(`https://streamed.pk/api/matches/${category}`);
                if (res.ok) {
                    matches = await res.json();
                }
            } catch (err) {
                console.warn('Direct fetch failed, attempting DoH / mirror fetch:', err);
            }

            // Fallback: If direct fetch failed, query DoH or Cloudflare Worker fallback
            if (!matches) {
                try {
                    const dohRes = await fetchWithTimeout(`https://cine-sync.workers.dev/api/matches/${category}`);
                    if (dohRes.ok) {
                        matches = await dohRes.json();
                    }
                } catch (e2) {
                    console.warn('DoH worker fetch failed:', e2);
                }
            }
            
            if (!matches || matches.length === 0) {
                sportsGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 40px;">
                        <p style="margin-bottom: 16px;">No upcoming matches found for this category right now.</p>
                        <button class="room-btn secondary" style="width: auto; margin: 0 auto; padding: 8px 20px;" onclick="document.getElementById('btn${category === 'football' ? 'Football' : 'UFC'}').click()">↻ Refresh</button>
                    </div>
                `;
                return;
            }

            renderMatches(matches);
        } catch (err) {
            console.error('Error fetching sports matches:', err);
            sportsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: #ff5555; padding: 40px; background: rgba(255,60,60,0.05); border: 1px solid rgba(255,60,60,0.2); border-radius: var(--radius);">
                    <p style="font-weight: 700; margin-bottom: 8px;">Failed to load live streams</p>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">Please check your internet connection or try again.</p>
                    <button class="room-btn primary" style="width: auto; margin: 0 auto; padding: 8px 24px;" onclick="document.getElementById('btn${category === 'football' ? 'Football' : 'UFC'}').click()">↻ Retry</button>
                </div>
            `;
        }
    }
    
    let countdownInterval = null;

    function renderMatches(matches) {
        sportsGrid.innerHTML = '';
        if (countdownInterval) clearInterval(countdownInterval);

        const getImageUrl = (url) => {
            if (!url) return '';
            if (url.startsWith('http://') || url.startsWith('https://')) return url;
            if (url.startsWith('/')) return `https://streamed.pk${url}`;
            return `https://streamed.pk/api/images/proxy/${url}`;
        };

        const updateCountdowns = () => {
            const now = Date.now();
            document.querySelectorAll('.match-timer-badge').forEach(el => {
                const matchTime = parseInt(el.getAttribute('data-time'), 10);
                if (isNaN(matchTime)) return;
                
                const diff = matchTime - now;
                if (diff <= 0) {
                    el.innerHTML = '<div style="width: 6px; height: 6px; border-radius: 50%; background: white; animation: pulseRoom 1.5s infinite;"></div>LIVE';
                    el.style.background = '#ff3c3c';
                } else {
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const secs = Math.floor((diff % (1000 * 60)) / 1000);
                    
                    let timeStr = 'Starts in ';
                    if (hours > 24) {
                        const days = Math.floor(hours / 24);
                        timeStr += `${days}d ${hours % 24}h`;
                    } else if (hours > 0) {
                        timeStr += `${hours}h ${mins}m ${secs}s`;
                    } else {
                        timeStr += `${mins}m ${secs}s`;
                    }
                    el.innerText = timeStr;
                }
            });
        };
        
        matches.forEach(match => {
            const card = document.createElement('div');
            card.className = 'movie-card'; 
            card.style.width = '100%';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.background = 'var(--bg-card)';
            card.style.border = '1px solid var(--border)';
            card.style.borderRadius = 'var(--radius)';
            card.style.overflow = 'hidden';
            card.style.cursor = 'pointer';
            card.style.transition = 'all var(--transition)';
            
            card.onmouseover = () => { card.style.transform = 'translateY(-4px)'; card.style.borderColor = 'var(--accent)'; };
            card.onmouseout = () => { card.style.transform = 'none'; card.style.borderColor = 'var(--border)'; };

            const matchTime = match.date ? new Date(match.date).getTime() : 0;
            const now = Date.now();
            const isLive = matchTime > 0 && matchTime <= now + (15 * 60000); // Live if past date or within 15m
            const timeString = matchTime > 0 ? new Date(matchTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD';

            const posterUrl = match.poster ? getImageUrl(match.poster) : '';
            const posterHtml = posterUrl 
                ? `<img src="${posterUrl}" alt="${match.title}" onerror="this.style.display='none'" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.4;">`
                : `<div style="width: 100%; height: 100%; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);"></div>`;

            let teamsHtml = '';
            if (match.teams && (match.teams.home || match.teams.away || match.teams.length === 2)) {
                const home = match.teams.home || (match.teams[0] || {});
                const away = match.teams.away || (match.teams[1] || {});
                const homeBadge = home.badge ? getImageUrl(home.badge) : '';
                const awayBadge = away.badge ? getImageUrl(away.badge) : '';

                teamsHtml = `
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between; align-items: center; padding: 20px; background: rgba(0,0,0,0.65);">
                        <div style="text-align: center; flex: 1;">
                            ${homeBadge ? `<img src="${homeBadge}" alt="${home.name || ''}" onerror="this.style.display='none'" style="width: 48px; height: 48px; object-fit: contain; margin: 0 auto 8px; display: block;">` : ''}
                            <div style="font-size: 0.85rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: white;">${home.name || 'Home'}</div>
                        </div>
                        <div style="font-weight: 900; color: var(--accent); padding: 0 10px; font-size: 1.2rem;">VS</div>
                        <div style="text-align: center; flex: 1;">
                            ${awayBadge ? `<img src="${awayBadge}" alt="${away.name || ''}" onerror="this.style.display='none'" style="width: 48px; height: 48px; object-fit: contain; margin: 0 auto 8px; display: block;">` : ''}
                            <div style="font-size: 0.85rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: white;">${away.name || 'Away'}</div>
                        </div>
                    </div>
                `;
            }

            const badgeBg = isLive ? '#ff3c3c' : 'rgba(255,255,255,0.15)';
            const badgeContent = isLive 
                ? '<div style="width: 6px; height: 6px; border-radius: 50%; background: white; animation: pulseRoom 1.5s infinite;"></div>LIVE'
                : 'Upcoming';

            card.innerHTML = `
                <div style="position: relative; width: 100%; aspect-ratio: 16/9; background: #0a0a0f;">
                    ${posterHtml}
                    ${teamsHtml}
                    <div class="match-timer-badge" data-time="${matchTime}" style="position: absolute; top: 10px; right: 10px; background: ${badgeBg}; backdrop-filter: blur(4px); color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.03em; display: flex; align-items: center; gap: 6px;">
                        ${badgeContent}
                    </div>
                </div>
                <div style="padding: 14px;">
                    <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; line-height: 1.3;">${match.title}</h3>
                    <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                        <span>📅 ${timeString}</span>
                        <span style="color: var(--accent); font-weight: 600;">${match.category ? match.category.toUpperCase() : ''}</span>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                if (!match.sources || match.sources.length === 0) {
                    alert('No stream sources available for this match yet. Please check back closer to the start time.');
                    return;
                }
                
                // Pass date and sources array to live_player.html
                window.location.href = `live_player.html?sources=${encodeURIComponent(JSON.stringify(match.sources))}&title=${encodeURIComponent(match.title)}&date=${matchTime}`;
            });

            sportsGrid.appendChild(card);
        });

        updateCountdowns();
        countdownInterval = setInterval(updateCountdowns, 1000);
    }

    // Load football by default
    loadMatches('football');
})();
