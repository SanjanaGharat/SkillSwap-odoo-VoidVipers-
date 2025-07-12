// auth.js
document.addEventListener('DOMContentLoaded', function() {
    const authButtons = document.getElementById('auth-buttons');
    const profileDropdown = document.getElementById('profile-dropdown');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Check auth state on page load
    checkAuthState();
    
    // Profile icon click handler
    document.getElementById('profile-icon')?.addEventListener('click', (e) => {
        profileDropdown.classList.toggle('hidden');
        e.stopPropagation(); // Prevent immediate document click
    });
    
    // Logout handler
    logoutBtn?.addEventListener('click', () => {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('user');
        checkAuthState();
        profileDropdown.classList.add('hidden');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        profileDropdown.classList.add('hidden');
    });
    
    function checkAuthState() {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (isLoggedIn) {
            // User is logged in - show profile icon
            authButtons.innerHTML = `
                <div class="relative">
                    <button id="profile-icon" class="flex items-center space-x-2 focus:outline-none">
                        <div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium">
                            ${user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                    </button>
                    <div id="profile-dropdown" class="hidden absolute right-0 mt-2 w-48 bg-dark-800 rounded-lg shadow-lg py-1 z-50 border border-dark-700">
                        <a href="/pages/profile.html" class="block px-4 py-2 text-gray-300 hover:bg-dark-700">Profile</a>
                        <button id="logout-btn" class="w-full text-left px-4 py-2 text-gray-300 hover:bg-dark-700">Logout</button>
                    </div>
                </div>
            `;
            
            // Re-attach event listeners to new elements
            document.getElementById('profile-icon')?.addEventListener('click', (e) => {
                document.getElementById('profile-dropdown').classList.toggle('hidden');
                e.stopPropagation();
            });
            
            document.getElementById('logout-btn')?.addEventListener('click', () => {
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('user');
                checkAuthState();
            });
        } else {
            // User is not logged in - show auth buttons (using anchor tags)
            authButtons.innerHTML = `
                <a href="/pages/login.html" class="px-4 py-2 rounded-lg font-medium text-sm bg-dark-800 hover:bg-dark-700 transition-colors inline-block">
                    Login
                </a>
                <a href="/pages/signin.html" class="px-4 py-2 rounded-lg font-medium text-sm bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 transition-all shadow-purple-lg inline-block">
                    Sign Up
                </a>
            `;
        }
    }
    
    // This would be called after successful login
    window.handleLoginSuccess = function(userData) {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('user', JSON.stringify(userData));
        checkAuthState();
    }

    // Registration logic
    const api = new SkillSwapAPI();
    const form = document.querySelector('form');
    if (form) {
        const registerBtn = form.querySelector('button[type="submit"]');
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            registerBtn.disabled = true;
            registerBtn.textContent = 'Creating...';
            const firstName = document.getElementById('first-name').value.trim();
            const lastName = document.getElementById('last-name').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            if (password !== confirmPassword) {
                api.showNotification('Passwords do not match', 'error');
                registerBtn.disabled = false;
                registerBtn.textContent = 'Create Account';
                return;
            }
            try {
                const data = await api.register({
                    name: firstName + ' ' + lastName,
                    email,
                    password
                });
                api.showNotification('Registration successful!', 'success');
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('user', JSON.stringify(data.user));
                setTimeout(() => {
                    window.location.href = '/pages/index.html';
                }, 1000);
            } catch (err) {
                api.showNotification('Registration failed: ' + api.formatError(err), 'error');
            } finally {
                registerBtn.disabled = false;
                registerBtn.textContent = 'Create Account';
            }
        });
    }
});