// Global State
let customers = JSON.parse(localStorage.getItem('qr_customers')) || [];
let qrcodeInstance = null;
let currentQRId = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    
    // Determine context based on DOM elements
    if (document.getElementById('customer-table-body')) {
        // Admin Dashboard
        renderTable();
        updateStats();
        setupImageUpload();
        
        // Reset modal on close
        const customerModalEl = document.getElementById('customerModal');
        if (customerModalEl) {
            customerModalEl.addEventListener('hidden.bs.modal', event => {
                document.getElementById('customerForm').reset();
                document.getElementById('customerId').value = '';
                document.getElementById('custImageBase64').value = '';
                document.getElementById('modalTitle').innerText = 'Add Customer';
            });
        }
    } else if (document.getElementById('profileCard')) {
        // Customer Profile Page
        loadProfileData();
    }
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        });
    }
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (icon) {
        icon.className = theme === 'dark' ? 'bi bi-sun-fill text-warning' : 'bi bi-moon-fill text-dark';
    }
}

// Sidebar Toggle
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

// Image Upload Handling (Convert to Base64)
function setupImageUpload() {
    const fileInput = document.getElementById('custImageFile');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                // Check file size (limit to ~2MB to save localStorage space)
                if(file.size > 2 * 1024 * 1024) {
                    showToast('Image is too large. Please select an image under 2MB.', 'danger');
                    this.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = function(event) {
                    document.getElementById('custImageBase64').value = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

// Generate Unique ID
function generateId() {
    return 'CUST-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Save Customer (Handles both Add and Edit)
function saveCustomer() {
    const idField = document.getElementById('customerId').value;
    const name = document.getElementById('custName').value.trim();
    const company = document.getElementById('custCompany').value.trim();
    const mobile = document.getElementById('custMobile').value.trim();
    const email = document.getElementById('custEmail').value.trim();
    const address = document.getElementById('custAddress').value.trim();
    const notes = document.getElementById('custNotes').value.trim();
    const imageBase64 = document.getElementById('custImageBase64').value;

    if (!name || !mobile) {
        showToast('Full Name and Mobile Number are required!', 'danger');
        return;
    }

    const customer = {
        id: idField || generateId(),
        name,
        company,
        mobile,
        email,
        address,
        notes,
        // Fallback to UI Avatars if no image uploaded
        image: imageBase64 || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=200`,
        timestamp: new Date().toISOString()
    };

    if (idField) {
        // Update existing
        const index = customers.findIndex(c => c.id === idField);
        if (index > -1) customers[index] = customer;
        showToast('Customer profile updated successfully!', 'success');
    } else {
        // Add new
        customers.push(customer);
        showToast('New customer added successfully!', 'success');
    }

    // Save to localStorage
    try {
        localStorage.setItem('qr_customers', JSON.stringify(customers));
    } catch (e) {
        // Handle QuotaExceededError (localStorage limit ~5MB)
        showToast('Storage full! Please clear some data or reduce image sizes.', 'danger');
        return;
    }
    
    // Reset and close modal
    bootstrap.Modal.getInstance(document.getElementById('customerModal')).hide();
    
    renderTable();
    updateStats();
}

// Render Table
function renderTable() {
    const tbody = document.getElementById('customer-table-body');
    if (!tbody) return;

    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    
    tbody.innerHTML = '';
    
    // Sort by newest first
    const sortedCustomers = [...customers].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const filteredCustomers = sortedCustomers.filter(c => 
        c.name.toLowerCase().includes(searchTerm) || 
        c.id.toLowerCase().includes(searchTerm) ||
        c.company.toLowerCase().includes(searchTerm) ||
        c.mobile.includes(searchTerm)
    );

    if(filteredCustomers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No customers found.</td></tr>`;
        return;
    }

    filteredCustomers.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="badge bg-light text-dark border font-monospace">${c.id}</span></td>
            <td>
                <div class="d-flex align-items-center">
                    <img src="${c.image}" alt="${c.name}" class="rounded-circle me-3 shadow-sm" width="40" height="40" style="object-fit:cover;">
                    <div class="fw-semibold">${c.name}</div>
                </div>
            </td>
            <td>${c.company || '<span class="text-muted">-</span>'}</td>
            <td><i class="bi bi-telephone text-muted me-1"></i> ${c.mobile}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="showQR('${c.id}')"><i class="bi bi-qr-code-scan me-1"></i> QR Code</button>
            </td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-light border text-primary" onclick="editCustomer('${c.id}')" title="Edit"><i class="bi bi-pencil-fill"></i></button>
                    <button class="btn btn-sm btn-light border text-danger" onclick="deleteCustomer('${c.id}')" title="Delete"><i class="bi bi-trash-fill"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Update Dashboard Stats
function updateStats() {
    const el = document.getElementById('total-customers');
    if (el) el.innerText = customers.length;
}

// Edit Customer
function editCustomer(id) {
    const c = customers.find(x => x.id === id);
    if (!c) return;

    document.getElementById('customerId').value = c.id;
    document.getElementById('custName').value = c.name;
    document.getElementById('custCompany').value = c.company;
    document.getElementById('custMobile').value = c.mobile;
    document.getElementById('custEmail').value = c.email;
    document.getElementById('custAddress').value = c.address;
    document.getElementById('custNotes').value = c.notes;
    document.getElementById('custImageBase64').value = c.image.startsWith('data:image') ? c.image : '';

    document.getElementById('modalTitle').innerText = 'Edit Customer Profile';
    new bootstrap.Modal(document.getElementById('customerModal')).show();
}

// Delete Customer
function deleteCustomer(id) {
    if (confirm('Are you sure you want to permanently delete this customer?')) {
        customers = customers.filter(x => x.id !== id);
        localStorage.setItem('qr_customers', JSON.stringify(customers));
        renderTable();
        updateStats();
        showToast('Customer deleted successfully.', 'warning text-dark');
    }
}

// QR Code Functionality
function showQR(id) {
    currentQRId = id;
    const customer = customers.find(c => c.id === id);
    if (!customer) return;

    const qrContainer = document.getElementById('qrcode-display');
    qrContainer.innerHTML = ''; 
    
    const currentUrl = window.location.href.split('/').slice(0, -1).join('/');
    
    // To make this work on mobile (which doesn't have the data in its localStorage),
    // we encode the customer details directly into the URL.
    // Note: We exclude large base64 images to keep the QR code scan-friendly.
    const compactData = {
        i: customer.id,
        n: customer.name,
        c: customer.company,
        m: customer.mobile,
        e: customer.email,
        a: customer.address,
        nt: customer.notes
    };
    
    // Only include the image if it's a URL (not a massive base64 string)
    if (customer.image && !customer.image.startsWith('data:image')) {
        compactData.img = customer.image;
    }

    const encodedData = btoa(unescape(encodeURIComponent(JSON.stringify(compactData))));
    const profileUrl = `${currentUrl}/profile.html?data=${encodedData}`;

    qrcodeInstance = new QRCode(qrContainer, {
        text: profileUrl,
        width: 240, // Slightly larger for more data
        height: 240,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.M // Medium error correction to fit data
    });

    document.getElementById('qrProfileLink').href = profileUrl;
    new bootstrap.Modal(document.getElementById('qrModal')).show();
}

function downloadQR() {
    const qrImg = document.querySelector('#qrcode-display img');
    if (qrImg) {
        const link = document.createElement('a');
        link.download = `QR_${currentQRId}.png`;
        link.href = qrImg.src;
        link.click();
        showToast('QR Code downloaded successfully!');
    }
}

function printQR() {
    const qrImg = document.querySelector('#qrcode-display img');
    if (qrImg) {
        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write('<html><head><title>Print QR Code</title>');
        printWindow.document.write('<style>body{display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;} img{width:300px;height:300px;border:1px solid #ddd;padding:20px;border-radius:10px;}</style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write('<h2>Customer QR Code</h2>');
        printWindow.document.write(`<img src="${qrImg.src}" />`);
        printWindow.document.write(`<p>ID: ${currentQRId}</p>`);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    }
}

// Data Import / Export (JSON)
function exportData() {
    if(customers.length === 0) {
        showToast('No data to export!', 'warning text-dark');
        return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(customers, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `customers_backup_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchorElem.click();
    showToast('Customer data exported successfully!');
}

function importData(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const imported = JSON.parse(e.target.result);
                if (Array.isArray(imported)) {
                    // Merge or Replace? Let's replace for simplicity
                    customers = imported;
                    localStorage.setItem('qr_customers', JSON.stringify(customers));
                    renderTable();
                    updateStats();
                    showToast('Data imported successfully!');
                } else {
                    showToast('Invalid JSON file format!', 'danger');
                }
            } catch (err) {
                showToast('Error parsing file!', 'danger');
            }
        };
        reader.readAsText(file);
    }
    event.target.value = ''; // reset input
}

// ----------------------------------------------------
// Profile Page Logic
// ----------------------------------------------------
function loadProfileData() {
    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get('data');
    let customer = null;

    // First, try to get data encoded in the URL (for mobile scanners)
    if (dataParam) {
        try {
            const decoded = JSON.parse(decodeURIComponent(escape(atob(dataParam))));
            customer = {
                id: decoded.i,
                name: decoded.n,
                company: decoded.c,
                mobile: decoded.m,
                email: decoded.e,
                address: decoded.a,
                notes: decoded.nt,
                image: decoded.img || `https://ui-avatars.com/api/?name=${encodeURIComponent(decoded.n)}&background=random&color=fff&size=200`
            };
        } catch (e) {
            console.error("Failed to decode QR data:", e);
        }
    }

    // If no URL data, fallback to searching localStorage (for admin preview)
    if (!customer) {
        const id = params.get('id');
        customer = customers.find(c => c.id === id);
    }

    if (customer) {
        document.getElementById('profileCard').style.display = 'block';
        
        document.title = `${customer.name} - Profile Card`;
        document.getElementById('p-img').src = customer.image;
        document.getElementById('p-name').innerText = customer.name;
        
        if(customer.company) {
            document.getElementById('p-company').innerText = customer.company;
        } else {
            document.getElementById('p-company').style.display = 'none';
        }

        // Contact links
        document.getElementById('p-mobile').innerText = customer.mobile;
        document.getElementById('link-mobile').href = `tel:${customer.mobile}`;

        if(customer.email) {
            document.getElementById('p-email').innerText = customer.email;
            document.getElementById('link-email').href = `mailto:${customer.email}`;
        } else {
            document.getElementById('p-email').innerText = 'Not provided';
            document.getElementById('link-email').style.pointerEvents = 'none';
        }

        document.getElementById('p-address').innerText = customer.address || 'Not provided';

        if(customer.notes) {
            document.getElementById('notes-container').style.display = 'block';
            document.getElementById('p-notes').innerText = customer.notes;
        }
    } else {
        // Show error card
        document.getElementById('errorCard').style.display = 'block';
    }
}

function shareProfile() {
    if (navigator.share) {
        navigator.share({
            title: document.title,
            text: 'Check out my digital profile!',
            url: window.location.href
        }).catch(console.error);
    } else {
        navigator.clipboard.writeText(window.location.href)
            .then(() => alert('Profile link copied to clipboard!'))
            .catch(err => console.error('Could not copy text: ', err));
    }
}

function saveContact() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const customer = customers.find(c => c.id === id);
    if(!customer) return;

    // Generate vCard format
    let vcard = `BEGIN:VCARD\nVERSION:3.0\nN:;${customer.name};;;\nFN:${customer.name}\n`;
    if(customer.company) vcard += `ORG:${customer.company}\n`;
    if(customer.mobile) vcard += `TEL;TYPE=CELL:${customer.mobile}\n`;
    if(customer.email) vcard += `EMAIL:${customer.email}\n`;
    if(customer.address) vcard += `ADR;TYPE=WORK,PREF:;;${customer.address.replace(/\n/g, ' ')};;;;\n`;
    if(customer.notes) vcard += `NOTE:${customer.notes.replace(/\n/g, ' ')}\n`;
    vcard += `END:VCARD`;

    const blob = new Blob([vcard], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${customer.name.replace(/\s+/g, '_')}.vcf`;
    link.click();
    URL.revokeObjectURL(url);
}

// ----------------------------------------------------
// UI Utilities
// ----------------------------------------------------
function showToast(message, bgClass = 'success') {
    const toastEl = document.getElementById('liveToast');
    if (!toastEl) return;
    
    // bg-success, bg-danger, bg-warning etc
    document.getElementById('toastMessage').innerText = message;
    
    // Reset classes
    toastEl.className = `toast align-items-center border-0 shadow glass-card text-bg-${bgClass.split(' ')[0]}`;
    
    // If it's warning, make text dark for readability
    if(bgClass.includes('text-dark')) {
        toastEl.classList.add('text-dark');
        const btnClose = toastEl.querySelector('.btn-close');
        if(btnClose) btnClose.classList.remove('btn-close-white');
    } else {
        const btnClose = toastEl.querySelector('.btn-close');
        if(btnClose) btnClose.classList.add('btn-close-white');
    }
    
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
}
