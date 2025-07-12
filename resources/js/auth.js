// auth.js - Authentication Handler
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const authButtons = document.getElementById('auth-buttons');
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileAuthSection = document.getElementById('mobile-auth-section');
    const mobileAuthIcon = document.getElementById('mobile-auth-icon');

    // Mobile Menu Toggle
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Check Authentication State
    checkAuthState();

    function checkAuthState() {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        if (isLoggedIn) {
            renderLoggedInState(user);
        } else {
            renderLoggedOutState();
        }
    }

    function renderLoggedInState(user) {
        // Desktop View
        if (authButtons) {
            authButtons.innerHTML = `
                <div class="relative">
                    <button id="profile-icon" class="flex items-center space-x-2 focus:outline-none">
                        <div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium">
                            ${user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                    </button>
                    <div id="profile-dropdown" class="hidden absolute right-0 mt-2 w-48 bg-dark-800 rounded-lg shadow-lg py-1 z-50 border border-dark-700">
                        <a href="/pages/profile.html" class="block px-4 py-2 text-gray-300 hover:bg-dark-700">Profile</a>
                        <a href="/pages/settings.html" class="block px-4 py-2 text-gray-300 hover:bg-dark-700">Settings</a>
                        <button id="logout-btn" class="w-full text-left px-4 py-2 text-gray-300 hover:bg-dark-700">Logout</button>
                    </div>
                </div>
            `;

            // Add event listeners for desktop dropdown
            document.getElementById('profile-icon')?.addEventListener('click', toggleProfileDropdown);
            document.getElementById('logout-btn')?.addEventListener('click', logoutUser);
        }

        // Mobile View
        updateMobileAuthState(true, user);

        // Mobile Header Icon
        if (mobileAuthIcon) {
            mobileAuthIcon.innerHTML = `
                <button id="mobile-profile-icon" class="flex items-center focus:outline-none mr-3">
                    <div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium">
                        ${user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                </button>
            `;
            mobileAuthIcon.classList.remove('hidden');
            document.getElementById('mobile-profile-icon')?.addEventListener('click', () => {
                window.location.href = '/pages/profile.html';
            });
        }
    }

    function renderLoggedOutState() {
        // Desktop View
        if (authButtons) {
            authButtons.innerHTML = `
                <a href="/pages/login.html" class="px-4 py-2 rounded-lg font-medium text-sm bg-dark-800 hover:bg-dark-700 transition-colors inline-block">
                    Login
                </a>
                <a href="/pages/signin.html" class="px-4 py-2 rounded-lg font-medium text-sm bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 transition-all shadow-purple-lg inline-block">
                    Sign Up
                </a>
            `;
        }

        // Mobile View
        updateMobileAuthState(false);
    }

    function updateMobileAuthState(isLoggedIn, user = {}) {
        if (mobileAuthSection) {
            if (isLoggedIn) {
                mobileAuthSection.innerHTML = `
                    <a href="/pages/profile.html" class="block px-3 py-2 rounded-md text-gray-300 hover:text-purple-400 hover:bg-dark-800">Profile</a>
                    <a href="/pages/settings.html" class="block px-3 py-2 rounded-md text-gray-300 hover:text-purple-400 hover:bg-dark-800">Settings</a>
                    <button id="mobile-logout-btn" class="block w-full text-left px-3 py-2 rounded-md text-gray-300 hover:text-purple-400 hover:bg-dark-800">Logout</button>
                `;
                document.getElementById('mobile-logout-btn')?.addEventListener('click', logoutUser);
            } else {
                mobileAuthSection.innerHTML = `
                    <a href="/pages/login.html" class="block px-3 py-2 rounded-md text-gray-300 hover:text-purple-400 hover:bg-dark-800">Login</a>
                    <a href="/pages/signin.html" class="block px-3 py-2 rounded-md text-purple-400 hover:text-purple-300 hover:bg-dark-800">Sign Up</a>
                `;
            }
        }
    }

    function toggleProfileDropdown(e) {
        const dropdown = document.getElementById('profile-dropdown');
        dropdown.classList.toggle('hidden');
        e.stopPropagation();
    }

    function logoutUser() {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('user');
        checkAuthState();
        
        // Close mobile menu if open
        if (mobileMenu) {
            mobileMenu.classList.add('hidden');
        }
        
        // Redirect to home page if on a protected page
        if (window.location.pathname.includes('/profile.html') || 
            window.location.pathname.includes('/settings.html')) {
            window.location.href = '/index.html';
        }
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('profile-dropdown');
        if (dropdown && !dropdown.contains(e.target) && 
            !document.getElementById('profile-icon')?.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    // Global login handler
    window.handleLoginSuccess = function(userData) {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('user', JSON.stringify(userData));
        checkAuthState();
        
        // Close mobile menu if open
        if (mobileMenu) {
            mobileMenu.classList.add('hidden');
        }
        
        // Redirect to home page if on login/signup pages
        if (window.location.pathname.includes('/login.html') || 
            window.location.pathname.includes('/signin.html')) {
            window.location.href = '/index.html';
        }
    };
});