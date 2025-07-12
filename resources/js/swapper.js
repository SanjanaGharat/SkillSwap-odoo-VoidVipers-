// Sample data for swappers
        const swappers = [
            {
                id: 1,
                initials: 'OD',
                name: 'Outstanding Magpie',
                rating: 3.9,
                swaps: 24,
                skillsOffered: ['Game Script', 'Python', 'JavaScript'],
                skillsWanted: ['Graphic Design', 'Adobe Photoshop', 'UI/UX']
            },
            {
                id: 2,
                initials: 'M',
                name: 'Michelle',
                rating: 2.5,
                swaps: 8,
                skillsOffered: ['UI/UX Design', 'Figma', 'Adobe XD'],
                skillsWanted: ['Python', 'Data Analysis', 'Machine Learning']
            },
            {
                id: 3,
                initials: 'JW',
                name: 'Joe Wills',
                rating: 4.0,
                swaps: 37,
                skillsOffered: ['Web Development', 'React', 'Node.js'],
                skillsWanted: ['Digital Marketing', 'SEO', 'Content Writing']
            },
            {
                id: 4,
                initials: 'TS',
                name: 'Taylor Swift',
                rating: 4.8,
                swaps: 52,
                skillsOffered: ['Singing', 'Songwriting', 'Guitar'],
                skillsWanted: ['Video Editing', 'Music Production', 'Dancing']
            },
            {
                id: 5,
                initials: 'JB',
                name: 'Justin Bieber',
                rating: 4.2,
                swaps: 41,
                skillsOffered: ['Piano', 'Music Production', 'Vocals'],
                skillsWanted: ['Graphic Design', 'Branding', 'Social Media']
            },
            {
                id: 6,
                initials: 'ES',
                name: 'Elon Musk',
                rating: 3.7,
                swaps: 29,
                skillsOffered: ['Entrepreneurship', 'Rocket Science', 'AI'],
                skillsWanted: ['Public Speaking', 'Marketing', 'PR']
            },
            {
                id: 7,
                initials: 'ZM',
                name: 'Zuckerberg',
                rating: 3.5,
                swaps: 18,
                skillsOffered: ['Programming', 'Business Strategy', 'AI'],
                skillsWanted: ['UX Design', 'Psychology', 'Neuroscience']
            },
            {
                id: 8,
                initials: 'BG',
                name: 'Bill Gates',
                rating: 4.9,
                swaps: 63,
                skillsOffered: ['Philanthropy', 'Business', 'Technology'],
                skillsWanted: ['Public Health', 'Education', 'Writing']
            }
        ];

        // DOM elements
        const swappersContainer = document.getElementById('swappers-container');
        const searchInput = document.getElementById('search-swappers');
        const offeredFilter = document.getElementById('offered-filter');
        const wantedFilter = document.getElementById('wanted-filter');
        const ratingFilter = document.getElementById('rating-filter');
        const prevPageBtn = document.getElementById('prev-page');
        const nextPageBtn = document.getElementById('next-page');
        const pageNumbersContainer = document.getElementById('page-numbers');

        // Pagination variables
        let currentPage = 1;
        const swappersPerPage = 8;
        let filteredSwappers = [...swappers];

        // Initialize the page
        document.addEventListener('DOMContentLoaded', () => {
            renderSwappers();
            renderPagination();
            
            // Event listeners
            searchInput.addEventListener('input', filterSwappers);
            offeredFilter.addEventListener('change', filterSwappers);
            wantedFilter.addEventListener('change', filterSwappers);
            ratingFilter.addEventListener('change', filterSwappers);
            prevPageBtn.addEventListener('click', goToPrevPage);
            nextPageBtn.addEventListener('click', goToNextPage);
        });

        // Render swapper cards
        function renderSwappers() {
            swappersContainer.innerHTML = '';
            
            const startIndex = (currentPage - 1) * swappersPerPage;
            const endIndex = startIndex + swappersPerPage;
            const swappersToShow = filteredSwappers.slice(startIndex, endIndex);
            
            swappersToShow.forEach(swapper => {
                const ratingStars = getRatingStars(swapper.rating);
                
                const card = document.createElement('div');
                card.className = 'bg-dark-850 border border-dark-800 rounded-xl p-6 hover:border-purple-900/50 transition-all group swapper-card';
                card.dataset.id = swapper.id;
                
                card.innerHTML = `
                    <div class="flex items-center space-x-4 mb-5">
                        <div class="profile-icon w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0" style="background-color: ${getRandomColor()}">
                            ${swapper.initials}
                        </div>
                        <div>
                            <h4 class="font-bold text-white group-hover:text-purple-300 transition-colors swapper-name">${swapper.name}</h4>
                            <div class="flex items-center">
                                <div class="flex text-yellow-400 text-sm">
                                    ${ratingStars}
                                </div>
                                <span class="ml-2 text-xs text-gray-500">${swapper.rating.toFixed(1)}/5 (${swapper.swaps} swaps)</span>
                            </div>
                        </div>
                    </div>
                    <div class="mb-5">
                        <p class="text-gray-500 text-xs font-medium mb-2 uppercase tracking-wider">Skills offered</p>
                        <div class="flex flex-wrap gap-2">
                            ${swapper.skillsOffered.map(skill => `<span class="skill-offered px-3 py-1 rounded-full text-xs font-medium">${skill}</span>`).join('')}
                        </div>
                    </div>
                    <div class="mb-6">
                        <p class="text-gray-500 text-xs font-medium mb-2 uppercase tracking-wider">Skills wanted</p>
                        <div class="flex flex-wrap gap-2">
                            ${swapper.skillsWanted.map(skill => `<span class="skill-wanted px-3 py-1 rounded-full text-xs font-medium">${skill}</span>`).join('')}
                        </div>
                    </div>
                    <button class="w-full bg-dark-800 hover:bg-purple-900/50 border border-dark-700 hover:border-purple-800 py-2.5 rounded-lg font-medium transition-all text-purple-400 hover:text-white">
                        Request Swap
                    </button>
                `;
                
                swappersContainer.appendChild(card);
            });
        }

        // Filter swappers based on search and filters
        function filterSwappers() {
            const searchTerm = searchInput.value.toLowerCase();
            const offeredSkill = offeredFilter.value.toLowerCase();
            const wantedSkill = wantedFilter.value.toLowerCase();
            const minRating = parseInt(ratingFilter.value);
            
            filteredSwappers = swappers.filter(swapper => {
                const nameMatch = swapper.name.toLowerCase().includes(searchTerm);
                const offeredMatch = offeredSkill === '' || 
                    swapper.skillsOffered.some(skill => skill.toLowerCase().includes(offeredSkill));
                const wantedMatch = wantedSkill === '' || 
                    swapper.skillsWanted.some(skill => skill.toLowerCase().includes(wantedSkill));
                const ratingMatch = minRating === 0 || swapper.rating >= minRating;
                
                return nameMatch && offeredMatch && wantedMatch && ratingMatch;
            });
            
            currentPage = 1;
            renderSwappers();
            renderPagination();
        }

        // Render pagination controls
        function renderPagination() {
            pageNumbersContainer.innerHTML = '';
            const totalPages = Math.ceil(filteredSwappers.length / swappersPerPage);
            
            // Show up to 5 page numbers
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
                    renderSwappers();
                    renderPagination();
                });
                pageNumbersContainer.appendChild(pageBtn);
            }
            
            prevPageBtn.disabled = currentPage === 1;
            nextPageBtn.disabled = currentPage === totalPages;
        }

        // Navigation functions
        function goToPrevPage() {
            if (currentPage > 1) {
                currentPage--;
                renderSwappers();
                renderPagination();
            }
        }

        function goToNextPage() {
            const totalPages = Math.ceil(filteredSwappers.length / swappersPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderSwappers();
                renderPagination();
            }
        }

        // Helper functions
        function getRatingStars(rating) {
            const fullStars = Math.floor(rating);
            const halfStar = rating % 1 >= 0.5 ? 1 : 0;
            const emptyStars = 5 - fullStars - halfStar;
            
            return '★'.repeat(fullStars) + (halfStar ? '½' : '') + '☆'.repeat(emptyStars);
        }

        function getRandomColor() {
            const colors = [
                '#8b5cf6', // purple-500
                '#ec4899', // pink-500
                '#3b82f6', // blue-500
                '#10b981', // emerald-500
                '#f59e0b', // amber-500
                '#6366f1'  // indigo-500
            ];
            return colors[Math.floor(Math.random() * colors.length)];
        }