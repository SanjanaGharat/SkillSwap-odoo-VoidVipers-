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
            // Elements
            const nameInput = document.querySelector('input[type="text"]');
            const locationInput = document.querySelectorAll('input[type="text"]')[1];
            const availabilitySelect = document.querySelector('select');
            const bioTextarea = document.querySelector('textarea');
            const offeredContainer = document.getElementById('skills-offered-container');
            const wantedContainer = document.getElementById('skills-wanted-container');
            const addSkillOfferedBtn = document.getElementById('add-skill-offered');
            const addSkillWantedBtn = document.getElementById('add-skill-wanted');
            const newSkillOfferedInput = document.getElementById('new-skill-offered');
            const newSkillWantedInput = document.getElementById('new-skill-wanted');
            const saveBtn = document.querySelector('button.bg-gradient-to-r');

            // Fetch and render user profile
            async function loadProfile() {
                try {
                    const { user } = await api.getProfile();
                    nameInput.value = user.name || '';
                    locationInput.value = user.location || '';
                    if (user.availability) availabilitySelect.value = user.availability.charAt(0).toUpperCase() + user.availability.slice(1);
                    bioTextarea.value = user.bio || '';
                    // Populate skills offered
                    offeredContainer.innerHTML = '';
                    (user.skillsOffered || []).forEach(skill => {
                        const skillTag = document.createElement('span');
                        skillTag.className = 'skill-tag bg-purple-900/50 text-purple-300';
                        skillTag.textContent = skill.name;
                        offeredContainer.appendChild(skillTag);
                    });
                    // Populate skills wanted
                    wantedContainer.innerHTML = '';
                    (user.skillsWanted || []).forEach(skill => {
                        const skillTag = document.createElement('span');
                        skillTag.className = 'skill-tag bg-dark-800 text-purple-400 border border-purple-900';
                        skillTag.textContent = skill.name;
                        wantedContainer.appendChild(skillTag);
                    });
                } catch (err) {
                    api.showNotification('Failed to load profile: ' + api.formatError(err), 'error');
                }
            }
            await loadProfile();

            // Add skill offered
            addSkillOfferedBtn.addEventListener('click', async function() {
                if (newSkillOfferedInput.value.trim() !== '') {
                    try {
                        const { user } = await api.getProfile();
                        const newSkill = { name: newSkillOfferedInput.value.trim(), category: 'General' };
                        const updatedSkills = [...(user.skillsOffered || []), newSkill];
                        await api.updateProfile({ skillsOffered: updatedSkills });
                        await loadProfile();
                        newSkillOfferedInput.value = '';
                    } catch (err) {
                        api.showNotification('Failed to add skill: ' + api.formatError(err), 'error');
                    }
                }
            });

            // Add skill wanted
            addSkillWantedBtn.addEventListener('click', async function() {
                if (newSkillWantedInput.value.trim() !== '') {
                    try {
                        const { user } = await api.getProfile();
                        const newSkill = { name: newSkillWantedInput.value.trim(), category: 'General' };
                        const updatedSkills = [...(user.skillsWanted || []), newSkill];
                        await api.updateProfile({ skillsWanted: updatedSkills });
                        await loadProfile();
                        newSkillWantedInput.value = '';
                    } catch (err) {
                        api.showNotification('Failed to add skill: ' + api.formatError(err), 'error');
                    }
                }
            });

            // Save changes
            saveBtn.addEventListener('click', async function() {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
                try {
                    await api.updateProfile({
                        name: nameInput.value,
                        location: locationInput.value,
                        availability: availabilitySelect.value.toLowerCase(),
                        bio: bioTextarea.value
                    });
                    api.showNotification('Profile updated!', 'success');
                    await loadProfile();
                } catch (err) {
                    api.showNotification('Failed to update profile: ' + api.formatError(err), 'error');
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Changes';
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