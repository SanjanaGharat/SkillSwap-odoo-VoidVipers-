tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        purple: {
                            900: '#3B0764',
                            800: '#5B21B6',
                            700: '#6D28D9',
                            600: '#7C3AED',
                            500: '#8B5CF6',
                        },
                        dark: {
                            950: '#0A0A0A',
                            900: '#171717',
                            850: '#1E1E1E',
                            800: '#262626',
                        }
                    },
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                    }
                }
            }
        }

document.addEventListener('DOMContentLoaded', function() {
    const api = new SkillSwapAPI();
    const form = document.querySelector('form');
    const loginBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        try {
            const data = await api.login({ email, password });
            api.showNotification('Login successful!', 'success');
            setTimeout(() => {
                window.location.href = '/pages/profile.html';
            }, 1000);
        } catch (err) {
            api.showNotification('Login failed: ' + api.formatError(err), 'error');
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    });
});