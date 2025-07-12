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

         // Simple JavaScript to handle adding new skills
        document.getElementById('add-skill-offered').addEventListener('click', function() {
            const input = document.getElementById('new-skill-offered');
            if (input.value.trim() !== '') {
                const container = document.getElementById('skills-offered-container');
                const newSkill = document.createElement('span');
                newSkill.className = 'skill-tag bg-purple-900/50 text-purple-300';
                newSkill.textContent = input.value.trim();
                container.appendChild(newSkill);
                input.value = '';
            }
        });

        document.getElementById('add-skill-wanted').addEventListener('click', function() {
            const input = document.getElementById('new-skill-wanted');
            if (input.value.trim() !== '') {
                const container = document.getElementById('skills-wanted-container');
                const newSkill = document.createElement('span');
                newSkill.className = 'skill-tag bg-dark-800 text-purple-400 border border-purple-900';
                newSkill.textContent = input.value.trim();
                container.appendChild(newSkill);
                input.value = '';
            }
        });

        // Allow pressing Enter to add skills
        document.getElementById('new-skill-offered').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                document.getElementById('add-skill-offered').click();
            }
        });

        document.getElementById('new-skill-wanted').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                document.getElementById('add-skill-wanted').click();
            }
        });

        // Click to remove skills
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('skill-tag') && e.target.textContent.includes('×')) {
                e.target.remove();
            }
        });