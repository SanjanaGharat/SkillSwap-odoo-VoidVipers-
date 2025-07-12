tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        purple: {
                            900: '#1e0b36',
                            800: '#2d1060',
                            700: '#3d1d8a',
                            600: '#5e35b1',
                            500: '#7e57c2',
                        },
                        dark: {
                            950: '#0a0a0a',
                            900: '#121212',
                            850: '#1a1a1a',
                            800: '#242424',
                        }
                    },
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                    },
                    boxShadow: {
                        'soft': '0 4px 24px 0 rgba(0,0,0,0.12)',
                        'purple-glow': '0 4px 24px 0 rgba(124, 58, 237, 0.2)'
                    }
                }
            }
        }

document.addEventListener('DOMContentLoaded', async function() {
    const api = new SkillSwapAPI();
    const requestsContainer = document.querySelector('.space-y-4');
    async function loadRequests() {
        requestsContainer.innerHTML = '<div class="text-center w-full py-8 text-purple-400">Loading requests...</div>';
        try {
            const res = await api.getSwaps({ status: 'pending', type: 'received' });
            requestsContainer.innerHTML = '';
            if (!res.swaps.length) {
                requestsContainer.innerHTML = '<div class="text-center w-full py-8 text-gray-400">No pending requests.</div>';
                return;
            }
            res.swaps.forEach(swap => {
                const user = swap.requester.userId;
                const rating = user.rating?.average || 0;
                const swaps = user.rating?.count || 0;
                const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
                const card = document.createElement('div');
                card.className = 'request-card bg-dark-850 border border-dark-800 rounded-xl overflow-hidden hover:border-purple-900/50 transition-all group';
                card.innerHTML = `
                    <div class="p-5">
                        <div class="flex flex-col md:flex-row gap-6 items-start">
                            <div class="flex items-center space-x-4 min-w-[200px]">
                                <div class="relative">
                                    <div class="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gray-800 border-2 border-purple-600/80 shadow-lg overflow-hidden flex items-center justify-center">
                                        <span class="text-2xl font-bold text-purple-500/80">${initials}</span>
                                    </div>
                                    <div class="absolute -bottom-1 -right-1 bg-purple-600 text-xs font-bold text-white rounded-full w-5 h-5 flex items-center justify-center border border-dark-900">${rating.toFixed(1)}</div>
                                </div>
                                <div>
                                    <h3 class="font-bold text-white group-hover:text-purple-300 transition-colors">${user.name}</h3>
                                    <div class="flex items-center text-yellow-400 text-xs mt-1">
                                        ${getRatingStars(rating)} <span class="text-gray-500 ml-1">(${swaps} swaps)</span>
                                    </div>
                                </div>
                            </div>
                            <div class="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p class="text-xs text-gray-500 mb-2 uppercase tracking-wider">Skills Offered</p>
                                    <div class="flex flex-wrap gap-2">
                                        ${(swap.skillExchange.offered ? `<span class='skill-chip bg-purple-900/20 text-purple-300 px-3 py-1 rounded-full text-xs font-medium border border-purple-800/50'>${swap.skillExchange.offered.skillId.name}</span>` : '')}
                                    </div>
                                </div>
                                <div>
                                    <p class="text-xs text-gray-500 mb-2 uppercase tracking-wider">Skills Wanted</p>
                                    <div class="flex flex-wrap gap-2">
                                        ${(swap.skillExchange.wanted ? `<span class='skill-chip bg-pink-900/20 text-pink-300 px-3 py-1 rounded-full text-xs font-medium border border-pink-800/50'>${swap.skillExchange.wanted.skillId.name}</span>` : '')}
                                    </div>
                                </div>
                            </div>
                            <div class="flex flex-col justify-center space-y-2 min-w-[120px] w-full md:w-auto">
                                <div class="status-badge bg-yellow-900/30 text-yellow-400 px-3 py-1 rounded-full text-xs font-medium text-center">Pending</div>
                                <div class="flex space-x-2">
                                    <button class="accept-btn flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-500 transition-colors shadow-md hover:shadow-green-500/20" data-id="${swap._id}">Accept</button>
                                    <button class="reject-btn flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-700 hover:bg-dark-600 transition-colors border border-dark-600" data-id="${swap._id}">Reject</button>
                                </div>
                            </div>
                        </div>
                    </div>`;
                requestsContainer.appendChild(card);
            });
            // Attach accept/reject handlers
            requestsContainer.querySelectorAll('.accept-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    await handleStatus(btn.dataset.id, 'accepted');
                });
            });
            requestsContainer.querySelectorAll('.reject-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    await handleStatus(btn.dataset.id, 'rejected');
                });
            });
        } catch (err) {
            requestsContainer.innerHTML = '<div class="text-center w-full py-8 text-red-400">Failed to load requests.</div>';
            api.showNotification('Failed to load requests: ' + api.formatError(err), 'error');
        }
    }
    async function handleStatus(id, status) {
        try {
            await api.updateSwapStatus(id, status);
            api.showNotification('Request ' + status + '!', 'success');
            loadRequests();
        } catch (err) {
            api.showNotification('Failed to update request: ' + api.formatError(err), 'error');
        }
    }
    function getRatingStars(rating) {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5 ? 1 : 0;
        const emptyStars = 5 - fullStars - halfStar;
        return '\u2605'.repeat(fullStars) + (halfStar ? '\u00bd' : '') + '\u2606'.repeat(emptyStars);
    }
    loadRequests();
});