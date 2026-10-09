document.addEventListener('DOMContentLoaded', () => {
    // Current User Session
    let currentUser = localStorage.getItem('lf_username') || '';

    // Views
    const authView = document.getElementById('authView');
    const mainDashboard = document.getElementById('mainDashboard');

    // Auth Controls
    const authForm = document.getElementById('authForm');
    const authUsernameInput = document.getElementById('authUsername');
    const authPasswordInput = document.getElementById('authPassword');
    const authTitle = document.getElementById('authTitle');
    const authSub = document.getElementById('authSub');
    const authSubmitText = document.getElementById('authSubmitText');
    const toggleAuthBtn = document.getElementById('toggleAuthBtn');
    const toggleQuestion = document.getElementById('toggleQuestion');
    const userProfile = document.getElementById('userProfile');
    const loggedUserDisplay = document.getElementById('loggedUserDisplay');
    const logoutBtn = document.getElementById('logoutBtn');

    let isRegisterMode = false;

    // Report Form & Controls
    const reportForm = document.getElementById('reportForm');
    const itemImageInput = document.getElementById('itemImage');
    const uploadPrompt = document.getElementById('uploadPrompt');
    const previewContainer = document.getElementById('previewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const removeImgBtn = document.getElementById('removeImgBtn');
    const submitBtn = document.getElementById('submitBtn');

    // Filter Controls
    const searchQuery = document.getElementById('searchQuery');
    const filterCategory = document.getElementById('filterCategory');
    const filterStatus = document.getElementById('filterStatus');
    const itemsGrid = document.getElementById('itemsGrid');
    const itemCount = document.getElementById('itemCount');

    let allItems = [];
    let currentBase64 = '';

    const categoryIcons = {
        'ID Card': '🪪',
        'Electronics': '💻',
        'Books & Notes': '📚',
        'Keys': '🔑',
        'Accessories': '🎒',
        'Clothing': '🧥',
        'Others': '📦'
    };

    // 1. Session Gatekeeper: Show Login page or Main Dashboard
    function checkAuthentication() {
        if (currentUser) {
            authView.style.display = 'none';
            mainDashboard.style.display = 'grid';
            userProfile.style.display = 'flex';
            loggedUserDisplay.textContent = `👤 @${currentUser}`;
            fetchItems();
        } else {
            authView.style.display = 'flex';
            mainDashboard.style.display = 'none';
            userProfile.style.display = 'none';
        }
    }

    // Toggle Login vs Register Mode
    toggleAuthBtn.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode;
        if (isRegisterMode) {
            authTitle.textContent = 'Create New Account';
            authSub.textContent = 'Register with a username and password to use the portal.';
            authSubmitText.textContent = 'Sign Up';
            toggleQuestion.textContent = 'Already have an account?';
            toggleAuthBtn.textContent = 'Sign In';
        } else {
            authTitle.textContent = 'Sign In to Continue';
            authSub.textContent = 'Please log in to report, view, or claim lost and found items on campus.';
            authSubmitText.textContent = 'Login';
            toggleQuestion.textContent = "Don't have an account?";
            toggleAuthBtn.textContent = 'Create one now';
        }
    });

    // Handle Login / Registration Submission
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = authUsernameInput.value.trim();
        const password = authPasswordInput.value.trim();
        const endpoint = isRegisterMode ? '/api/register' : '/api/login';

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (res.ok) {
                currentUser = data.username;
                localStorage.setItem('lf_username', currentUser);
                authForm.reset();
                showToast(isRegisterMode ? 'Account registered successfully!' : `Welcome back, @${currentUser}!`);
                checkAuthentication();
            } else {
                showToast(data.error || 'Authentication failed.');
            }
        } catch (err) {
            showToast('Unable to connect to the authentication server.');
        }
    });

    // Handle Logout
    logoutBtn.addEventListener('click', () => {
        currentUser = '';
        localStorage.removeItem('lf_username');
        showToast('Logged out successfully.');
        checkAuthentication();
    });

    // 2. Photo Processing
    function processImage(file) {
        return new Promise((resolve) => {
            if (!file) return resolve('');
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 600;
                    let width = img.width;
                    let height = img.height;

                    if (width > MAX_WIDTH) {
                        height = Math.round((height * MAX_WIDTH) / width);
                        width = MAX_WIDTH;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
            };
        });
    }

    itemImageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            currentBase64 = await processImage(file);
            imagePreview.src = currentBase64;
            uploadPrompt.style.display = 'none';
            previewContainer.style.display = 'block';
        }
    });

    removeImgBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentBase64 = '';
        itemImageInput.value = '';
        imagePreview.src = '';
        previewContainer.style.display = 'none';
        uploadPrompt.style.display = 'flex';
    });

    // 3. Load Items
    async function fetchItems() {
        try {
            const res = await fetch('/api/items');
            if (!res.ok) throw new Error('Network error');
            allItems = await res.json();
            render();
        } catch (err) {
            console.error('Error loading items:', err);
            showToast('Unable to connect to the database.');
        }
    }

    // 4. Render Grid with Attribution
    function render() {
        const query = searchQuery.value.trim().toLowerCase();
        const cat = filterCategory.value;
        const stat = filterStatus.value;

        const filtered = allItems.filter(item => {
            const matchesQuery = !query || 
                item.title.toLowerCase().includes(query) || 
                item.location.toLowerCase().includes(query) ||
                item.category.toLowerCase().includes(query) ||
                (item.reported_by && item.reported_by.toLowerCase().includes(query)) ||
                (item.claimed_by && item.claimed_by.toLowerCase().includes(query));
            const matchesCat = (cat === 'All' || item.category === cat);
            const matchesStat = (stat === 'All' || item.status === stat);
            return matchesQuery && matchesCat && matchesStat;
        });

        itemCount.textContent = `Showing: ${filtered.length} items`;

        if (filtered.length === 0) {
            itemsGrid.innerHTML = `
                <div class="empty-state">
                    <span>🔍</span>
                    <p>No matching reports found.</p>
                </div>`;
            return;
        }

        itemsGrid.innerHTML = filtered.map(item => `
            <div class="item-card ${item.status}">
                <div class="card-media">
                    ${item.image ? 
                        `<img src="${item.image}" alt="${escapeHtml(item.title)}">` : 
                        `<div class="media-placeholder">${categoryIcons[item.category] || '📦'}</div>`
                    }
                </div>
                <div class="card-body">
                    <div>
                        <span class="status-pill ${item.status}">${item.status}</span>
                        <h3 class="item-name">${escapeHtml(item.title)}</h3>
                        <ul class="meta-list">
                            <li><strong>Category:</strong> ${escapeHtml(item.category)}</li>
                            <li><strong>Location:</strong> ${escapeHtml(item.location)}</li>
                            <li><strong>Contact:</strong> ${escapeHtml(item.contact)}</li>
                            <li><strong>Reported by:</strong> <span class="user-tag">@${escapeHtml(item.reported_by || 'Anonymous')}</span></li>
                            ${item.status === 'Claimed' && item.claimed_by ? `
                                <li><strong>Claimed by:</strong> <span class="user-tag claimed-tag">✓ @${escapeHtml(item.claimed_by)}</span></li>
                            ` : ''}
                        </ul>
                    </div>
                    
                    <div class="card-actions">
                        ${item.status !== 'Claimed' ? `
                            <button class="btn btn-claim" onclick="markClaimed(${item.id})">
                                ✓ Claim Item
                            </button>
                        ` : ''}
                        
                        <div class="actions-bottom">
                            <span class="timestamp">${formatTime(item.created_at)}</span>
                            <button class="btn-delete" onclick="deleteItem(${item.id})">Delete</button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // 5. Submit Notice (Attached with current username)
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentUser) {
            showToast('Please log in first.');
            checkAuthentication();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Publishing...';

        const payload = {
            title: document.getElementById('itemTitle').value,
            category: document.getElementById('itemCategory').value,
            status: document.getElementById('itemStatus').value,
            location: document.getElementById('itemLocation').value,
            contact: document.getElementById('itemContact').value,
            image: currentBase64,
            reported_by: currentUser
        };

        try {
            const res = await fetch('/api/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                reportForm.reset();
                removeImgBtn.click();
                showToast('Notice published successfully!');
                await fetchItems();
            } else {
                showToast('Failed to save notice.');
            }
        } catch (err) {
            showToast('Network error while posting.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Publish Notice';
        }
    });

    // 6. Claim Item (Attached with current username)
    window.markClaimed = async function(id) {
        if (!currentUser) {
            showToast('Please log in first.');
            checkAuthentication();
            return;
        }

        try {
            const res = await fetch(`/api/claim/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ claimed_by: currentUser })
            });
            if (res.ok) {
                showToast(`Item marked as claimed by @${currentUser}!`);
                fetchItems();
            }
        } catch (err) {
            showToast('Failed to update status.');
        }
    };

    window.deleteItem = async function(id) {
        if (!confirm('Are you sure you want to remove this notice?')) return;
        try {
            const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message || 'Notice deleted.');
                await fetchItems();
            } else {
                showToast(data.error || 'Failed to delete item.');
            }
        } catch (err) {
            showToast('Failed to delete notice.');
        }
    };

    // Filter listeners
    searchQuery.addEventListener('input', render);
    filterCategory.addEventListener('change', render);
    filterStatus.addEventListener('change', render);

    function showToast(msg) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.add('active');
        setTimeout(() => toast.classList.remove('active'), 3200);
    }

    function escapeHtml(str) {
        return (str || '').replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    function formatTime(isoStr) {
        if (!isoStr) return '';
        const d = new Date(isoStr.replace(' ', 'T') + 'Z');
        return isNaN(d) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    // Startup check
    checkAuthentication();
});