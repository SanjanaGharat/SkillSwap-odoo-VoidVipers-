 function showScreen5() {
            document.getElementById('screen-4').classList.add('hidden');
            const screen5 = document.getElementById('screen-5');
            screen5.classList.remove('hidden');
            screen5.classList.add('fade-slide');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function showScreen4() {
            document.getElementById('screen-5').classList.add('hidden');
            document.getElementById('screen-4').classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

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
                    },
                    boxShadow: {
                        'purple-glow': '0 4px 14px 0 rgba(139, 92, 246, 0.25)',
                    }
                }
            }
        }