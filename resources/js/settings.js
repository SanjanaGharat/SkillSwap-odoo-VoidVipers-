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


         document.addEventListener('DOMContentLoaded', function() {
            const tabLinks = document.querySelectorAll('.tab-link');
            const tabContents = document.querySelectorAll('.tab-content');
            
            // Set the first tab as active by default if none is active
            if (!document.querySelector('.tab-link.active')) {
                tabLinks[1].classList.add('bg-purple-900/30', 'text-purple-300');
                tabLinks[1].classList.remove('text-gray-400', 'hover:text-purple-300');
            }
            
            tabLinks.forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    
                    // Remove active classes from all links
                    tabLinks.forEach(tab => {
                        tab.classList.remove('bg-purple-900/30', 'text-purple-300');
                        tab.classList.add('text-gray-400', 'hover:text-purple-300');
                    });
                    
                    // Add active class to clicked link
                    this.classList.add('bg-purple-900/30', 'text-purple-300');
                    this.classList.remove('text-gray-400', 'hover:text-purple-300');
                    
                    // Hide all tab contents
                    tabContents.forEach(content => {
                        content.classList.remove('active');
                    });
                    
                    // Show the selected tab content
                    const target = this.getAttribute('href');
                    document.querySelector(target).classList.add('active');
                });
            });
        });