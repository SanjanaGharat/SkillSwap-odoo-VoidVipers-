// Use this EXACT version - now with error logging
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - attempting to load navbar'); // Debug 1
    
    fetch('/components/navbar.html')
        .then(response => {
            console.log('Navbar fetch response:', response.status); // Debug 2
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.text();
        })
        .then(html => {
            console.log('Successfully loaded navbar HTML'); // Debug 3
            
            // Remove any existing navbars (safety check)
            const existingNavs = document.querySelectorAll('nav');
            console.log(`Found ${existingNavs.length} existing navbars`); // Debug 4
            existingNavs.forEach(nav => nav.remove());
            
            // Create and insert new navbar
            const navbarContainer = document.createElement('div');
            navbarContainer.innerHTML = html;
            document.body.insertBefore(navbarContainer, document.body.firstChild);
            console.log('Navbar inserted into DOM'); // Debug 5
            
            // Execute any scripts from navbar
            const scripts = navbarContainer.querySelectorAll('script');
            console.log(`Found ${scripts.length} scripts in navbar`); // Debug 6
            scripts.forEach(originalScript => {
                const newScript = document.createElement('script');
                newScript.textContent = originalScript.textContent;
                document.body.appendChild(newScript);
            });
        })
        .catch(error => {
            console.error('NAVBAR LOAD ERROR:', error); // Debug 7
            // Create emergency fallback
            const fallback = document.createElement('nav');
            fallback.innerHTML = `
                <div style="padding:1rem;background:#1a1a1a;color:white;">
                    [Navbar Failed to Load] <a href="/" style="color:lightblue;">Go Home</a>
                </div>
            `;
            document.body.prepend(fallback);
        });
});