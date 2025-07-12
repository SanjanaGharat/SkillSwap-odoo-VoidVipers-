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

        // Initialize API client
        document.addEventListener('DOMContentLoaded', async function() {
            const api = new SkillSwapAPI();
            // Fetch and render user profile
            try {
                const { user } = await api.getProfile();
                // Populate skills offered
                const offeredContainer = document.getElementById('skills-offered-container');
                offeredContainer.innerHTML = '';
                (user.skillsOffered || []).forEach(skill => {
                    const skillTag = document.createElement('span');
                    skillTag.className = 'skill-tag bg-purple-900/50 text-purple-300';
                    skillTag.textContent = skill.name;
                    offeredContainer.appendChild(skillTag);
                });
                // Populate skills wanted
                const wantedContainer = document.getElementById('skills-wanted-container');
                wantedContainer.innerHTML = '';
                (user.skillsWanted || []).forEach(skill => {
                    const skillTag = document.createElement('span');
                    skillTag.className = 'skill-tag bg-dark-800 text-purple-400 border border-purple-900';
                    skillTag.textContent = skill.name;
                    wantedContainer.appendChild(skillTag);
                });
            } catch (err) {
                console.error('Failed to load profile:', err);
            }

            // Add skill offered
            document.getElementById('add-skill-offered').addEventListener('click', async function() {
                const input = document.getElementById('new-skill-offered');
                if (input.value.trim() !== '') {
                    try {
                        // Get current profile
                        const { user } = await api.getProfile();
                        const newSkill = { name: input.value.trim(), category: 'General' };
                        const updatedSkills = [...(user.skillsOffered || []), newSkill];
                        await api.updateProfile({ skillsOffered: updatedSkills });
                        // Update UI
                        const container = document.getElementById('skills-offered-container');
                        const skillTag = document.createElement('span');
                        skillTag.className = 'skill-tag bg-purple-900/50 text-purple-300';
                        skillTag.textContent = newSkill.name;
                        container.appendChild(skillTag);
                        input.value = '';
                    } catch (err) {
                        api.showNotification('Failed to add skill: ' + api.formatError(err), 'error');
                    }
                }
            });

            // Add skill wanted
            document.getElementById('add-skill-wanted').addEventListener('click', async function() {
                const input = document.getElementById('new-skill-wanted');
                if (input.value.trim() !== '') {
                    try {
                        // Get current profile
                        const { user } = await api.getProfile();
                        const newSkill = { name: input.value.trim(), category: 'General' };
                        const updatedSkills = [...(user.skillsWanted || []), newSkill];
                        await api.updateProfile({ skillsWanted: updatedSkills });
                        // Update UI
                        const container = document.getElementById('skills-wanted-container');
                        const skillTag = document.createElement('span');
                        skillTag.className = 'skill-tag bg-dark-800 text-purple-400 border border-purple-900';
                        skillTag.textContent = newSkill.name;
                        container.appendChild(skillTag);
                        input.value = '';
                    } catch (err) {
                        api.showNotification('Failed to add skill: ' + api.formatError(err), 'error');
                    }
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
        });