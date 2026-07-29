(function() {
    const btnFootball = document.getElementById('btnFootball');
    const btnUFC = document.getElementById('btnUFC');
    const sportsGrid = document.getElementById('sportsGrid');

    if (!btnFootball || !btnUFC || !sportsGrid) return;

    btnFootball.addEventListener('click', () => loadMatches('football'));
    btnUFC.addEventListener('click', () => loadMatches('fight'));

    async function loadMatches(category) {
        sportsGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 40px;">Loading matches...</div>';
        
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
            const res = await fetch(`https://streamed.pk/api/matches/${category}`);
            const matches = await res.json();
            
            if (!matches || matches.length === 0) {
                sportsGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 40px;">No upcoming matches found for this category.</div>';
                return;
            }

            renderMatches(matches);
        } catch (err) {
            console.error('Error fetching sports matches:', err);
            sportsGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #ff5555; padding: 40px;">Failed to load matches. Please try again later.</div>';
        }
    }

    function renderMatches(matches) {
        sportsGrid.innerHTML = '';
        const now = Date.now();
        
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

            const isLive = match.date && (new Date(match.date).getTime() < now + (30 * 60000)); // Consider live if within 30 mins
            const timeString = new Date(match.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            const getProxyImage = (url) => {
                if (!url) return '';
                return `https://streamed.pk/api/images/events-images?url=${encodeURIComponent(url)}`;
            };

            const posterUrl = match.poster ? getProxyImage(match.poster) : 'https://via.placeholder.com/400x225/1a1a2e/ffffff?text=Live+Event';

            let teamsHtml = '';
            if (match.teams && match.teams.length === 2) {
                teamsHtml = `
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between; align-items: center; padding: 20px; background: rgba(0,0,0,0.6);">
                        <div style="text-align: center; flex: 1;">
                            <img src="${getProxyImage(match.teams[0].badge)}" alt="${match.teams[0].name}" style="width: 50px; height: 50px; object-fit: contain; margin-bottom: 8px;">
                            <div style="font-size: 0.85rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: white;">${match.teams[0].name}</div>
                        </div>
                        <div style="font-weight: 900; color: var(--accent); padding: 0 10px; font-size: 1.2rem;">VS</div>
                        <div style="text-align: center; flex: 1;">
                            <img src="${getProxyImage(match.teams[1].badge)}" alt="${match.teams[1].name}" style="width: 50px; height: 50px; object-fit: contain; margin-bottom: 8px;">
                            <div style="font-size: 0.85rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: white;">${match.teams[1].name}</div>
                        </div>
                    </div>
                `;
            }

            card.innerHTML = `
                <div style="position: relative; width: 100%; aspect-ratio: 16/9; background: #0a0a0f;">
                    <img src="${posterUrl}" alt="${match.title}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.4;">
                    ${teamsHtml}
                    ${isLive ? '<div style="position: absolute; top: 10px; right: 10px; background: #ff3c3c; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.05em; display: flex; align-items: center; gap: 4px;"><div style="width: 6px; height: 6px; border-radius: 50%; background: white; animation: pulseRoom 1.5s infinite;"></div>LIVE</div>' : ''}
                </div>
                <div style="padding: 14px;">
                    <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; line-height: 1.3;">${match.title}</h3>
                    <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                        <span>${timeString}</span>
                        <span style="color: var(--accent); font-weight: 600;">${match.category || ''}</span>
                    </div>
                </div>
            `;

            card.addEventListener('click', async () => {
                if (!match.sources || match.sources.length === 0) {
                    alert('No stream sources available for this match yet. Please check back closer to the start time.');
                    return;
                }
                
                const source = match.sources[0];
                window.location.href = `live_player.html?source=${encodeURIComponent(source.source)}&id=${encodeURIComponent(source.id)}&title=${encodeURIComponent(match.title)}`;
            });

            sportsGrid.appendChild(card);
        });
    }

    // Load football by default
    loadMatches('football');
})();
