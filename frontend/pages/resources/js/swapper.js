// Remove all static/dummy data. Only use backend data for swappers.
document.addEventListener('DOMContentLoaded', async () => {
    const api = new SkillSwapAPI();
    const swappersContainer = document.getElementById('swappers-container');
    const searchInput = document.getElementById('search-swappers');
    const offeredFilter = document.getElementById('offered-filter');
    const wantedFilter = document.getElementById('wanted-filter');
    const ratingFilter = document.getElementById('rating-filter');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageNumbersContainer = document.getElementById('page-numbers');

    let currentPage = 1;
    const swappersPerPage = 8;
    let allSwappers = [];
    let totalPages = 1;

    async function loadSwappers() {
        swappersContainer.innerHTML = '<div class="text-center w-full py-8 text-purple-400">Loading swappers...</div>';
        try {
            const params = {
                page: currentPage,
                limit: swappersPerPage,
                q: searchInput.value,
                minRating: ratingFilter.value
            };
            if (offeredFilter.value) params.skill = offeredFilter.value;
            const res = await api.searchUsers(params);
            allSwappers = res.users;
            totalPages = res.pagination.pages;
            renderSwappers();
            renderPagination();
        } catch (err) {
            swappersContainer.innerHTML = '<div class="text-center w-full py-8 text-red-400">Failed to load swappers.</div>';
            api.showNotification('Failed to load swappers: ' + api.formatError(err), 'error');
        }
    }

    function renderSwappers() {
        swappersContainer.innerHTML = '';
        if (!allSwappers.length) {
            swappersContainer.innerHTML = '<div class="text-center w-full py-8 text-gray-400">No swappers found.</div>';
            return;
        }
        allSwappers.forEach(user => {
            const rating = user.rating?.average || 0;
            const swaps = user.rating?.count || 0;
            const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
            const card = document.createElement('div');
            card.className = 'bg-dark-850 border border-dark-800 rounded-xl p-6 hover:border-purple-900/50 transition-all group swapper-card';
            card.innerHTML = `
                <div class="flex items-center space-x-4 mb-5">
                    <div class="profile-icon w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0" style="background-color: ${getRandomColor()}">
                        ${initials}
                    </div>
                    <div>
                        <h4 class="font-bold text-white group-hover:text-purple-300 transition-colors swapper-name">${user.name}</h4>
                        <div class="flex items-center">
                            <div class="flex text-yellow-400 text-sm">${getRatingStars(rating)}</div>
                            <span class="ml-2 text-xs text-gray-500">${rating.toFixed(1)}/5 (${swaps} swaps)</span>
                        </div>
                    </div>
                </div>
                <div class="mb-5">
                    <p class="text-gray-500 text-xs font-medium mb-2 uppercase tracking-wider">Skills offered</p>
                    <div class="flex flex-wrap gap-2">
                        ${(user.skillsOffered||[]).map(skill => `<span class="skill-offered px-3 py-1 rounded-full text-xs font-medium">${skill.name}</span>`).join('')}
                    </div>
                </div>
                <div class="mb-6">
                    <p class="text-gray-500 text-xs font-medium mb-2 uppercase tracking-wider">Skills wanted</p>
                    <div class="flex flex-wrap gap-2">
                        ${(user.skillsWanted||[]).map(skill => `<span class="skill-wanted px-3 py-1 rounded-full text-xs font-medium">${skill.name}</span>`).join('')}
                    </div>
                </div>
                <button class="w-full bg-dark-800 hover:bg-purple-900/50 border border-dark-700 hover:border-purple-800 py-2.5 rounded-lg font-medium transition-all text-purple-400 hover:text-white">
                    Request Swap
                </button>
            `;
            swappersContainer.appendChild(card);
        });
    }

    function renderPagination() {
        pageNumbersContainer.innerHTML = '';
        if (totalPages <= 1) {
            prevPageBtn.disabled = true;
            nextPageBtn.disabled = true;
            return;
        }
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `px-3 py-1 rounded-lg ${i === currentPage ? 'bg-purple-900/50 text-white' : 'bg-dark-800 text-gray-400 hover:bg-purple-900/50 hover:text-white'} transition-colors`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => {
                currentPage = i;
                loadSwappers();
            });
            pageNumbersContainer.appendChild(pageBtn);
        }
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
    }

    searchInput.addEventListener('input', () => { currentPage = 1; loadSwappers(); });
    offeredFilter.addEventListener('change', () => { currentPage = 1; loadSwappers(); });
    wantedFilter.addEventListener('change', () => { currentPage = 1; loadSwappers(); });
    ratingFilter.addEventListener('change', () => { currentPage = 1; loadSwappers(); });
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadSwappers();
        }
    });
    nextPageBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadSwappers();
        }
    });

    function getRatingStars(rating) {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5 ? 1 : 0;
        const emptyStars = 5 - fullStars - halfStar;
        return '\u2605'.repeat(fullStars) + (halfStar ? '\u00bd' : '') + '\u2606'.repeat(emptyStars);
    }
    function getRandomColor() {
        const colors = [
            '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#6366f1'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // Initial load
    loadSwappers();
});