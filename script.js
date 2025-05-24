// script.js
console.log("Script.js starting execution.");

// --- Configuration & Global State ---
const premiumTemplates = ['marketing', 'business', 'classic', 'student', 'temp'];
let isPro = false;

function unlockAIButtons() {
  console.log("[unlockAIButtons] Running with isPro:", isPro);
  const aiButtons = document.querySelectorAll('.ai-button');
  console.log("[unlockAIButtons] Found", aiButtons.length, "AI buttons");

  aiButtons.forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('locked');
    btn.title = "Generate with AI";

    // ✅ Remove the lock icon inside the button if it exists
    const lockIcon = btn.querySelector('.lock-icon');
    if (lockIcon) {
      lockIcon.remove();
      console.log("[unlockAIButtons] Lock icon removed.");
    }
  });

  // ✅ Also update LinkedIn button
  const linkedinBtn = document.getElementById('linkedin-import');
  if (linkedinBtn) {
    linkedinBtn.disabled = false;
    linkedinBtn.classList.remove('locked');
    linkedinBtn.title = "Import from LinkedIn";

    // Remove any embedded lock icon span
    const lockSpan = linkedinBtn.querySelector('.lock-icon');
    if (lockSpan) lockSpan.remove();

    // Clean any accidental emoji
    linkedinBtn.textContent = "🔗 Import from LinkedIn";
  }
}

// Log initial state
console.log("[Initial State] isPro:", isPro);
const initialEmailOnLoad = localStorage.getItem('userEmail');
console.log("[Initial State] LocalStorage userEmail on script load:", initialEmailOnLoad);

// --- CORE UI UPDATE FUNCTIONS ---

/**
 * Updates the LinkedIn import button's state and appearance.
 */
function updateLinkedInAccessUI() {
  const linkedinButton = document.getElementById('linkedin-import');
  if (!linkedinButton) return;

  // Get or create the lock icon span
  let lockIcon = linkedinButton.querySelector('.lock-icon');
  if (!lockIcon) {
    lockIcon = document.createElement('span');
    lockIcon.className = 'lock-icon';
    lockIcon.textContent = ' 🔒';
    linkedinButton.appendChild(lockIcon);
  }

  if (!isPro) {
    linkedinButton.disabled = true;
    linkedinButton.classList.add('locked');
    linkedinButton.title = "Upgrade to Pro to use LinkedIn import";
    lockIcon.style.display = 'inline';
  } else {
    linkedinButton.disabled = false;
    linkedinButton.classList.remove('locked');
    linkedinButton.title = "Import from LinkedIn";
    lockIcon.style.display = 'none';
  }
}

function styleTemplateCardsUI() {
  document.querySelectorAll('.template-card').forEach(card => {
    const tpl = card.dataset.template;
    const isPremium = premiumTemplates.includes(tpl);
    let lockIcon = card.querySelector('.lock-icon');

    if (isPremium && !lockIcon) {
      lockIcon = card.querySelector('.template-lock-icon');
      if (!lockIcon) {
        lockIcon = document.createElement('span');
        lockIcon.className = 'template-lock-icon lock-icon';
        lockIcon.innerHTML = '&#128274;';
        lockIcon.style.marginLeft = '5px';
        card.appendChild(lockIcon);
      }
    }

    if (isPremium && !isPro) {
      card.classList.add('locked-template');
      card.title = "Upgrade to Pro to use this template";
      if (lockIcon) lockIcon.style.display = 'inline';
    } else {
      card.classList.remove('locked-template');
      card.title = `Use ${tpl} template`;
      if (lockIcon) lockIcon.style.display = 'none';
    }

    // ✅ Highlight active template
    if (tpl === currentTemplate) {
      card.classList.add('active-template');
    } else {
      card.classList.remove('active-template');
    }
  });
}

/**
 * Updates the visibility of the CV watermark.
 */
function updateWatermarkUI(templateName) {
  const watermark = document.getElementById('cv-watermark');
  if (!watermark) return;

  if (templateName === 'tech' && !isPro) {
    watermark.style.display = 'block';
  } else if (!isPro) {
    watermark.style.display = 'block';
  } else {
    watermark.style.display = 'none';
  }
}

/**
 * Updates the display for membership expiry date.
 */
function updateMembershipExpiryUI() {
  const expiryMessageEl = document.getElementById('membership-expiry-message');
  if (!expiryMessageEl) {
    console.warn("[updateMembershipExpiryUI] Target element #membership-expiry-message not found.");
    return;
  }

  const proExpiryDateString = localStorage.getItem('proExpiryDate');
  console.log(`[updateMembershipExpiryUI] proExpiryDateString from localStorage: ${proExpiryDateString}`);

  // Check if user is Pro AND if an expiry date string exists
  if (!isPro || !proExpiryDateString || proExpiryDateString === 'null') {
    expiryMessageEl.style.display = 'none'; // Hide if not pro or no expiry date
    expiryMessageEl.innerHTML = ''; // Clear content
    console.log("[updateMembershipExpiryUI] Not Pro or no expiry date, hiding message.");
    return;
  }

  const membershipEndDate = new Date(proExpiryDateString);
  const now = new Date();
  let message = '';

  const timeLeftMs = membershipEndDate.getTime() - now.getTime();

  console.log(`[updateMembershipExpiryUI] Time left in milliseconds: ${timeLeftMs}`);

  if (timeLeftMs <= 0) {
    message = "Your Pro membership has **expired**. Please renew to continue using all features.";
    if (isPro) {
        isPro = false;
        refreshAllProUI();
        console.log("[updateMembershipExpiryUI] Membership expired, setting isPro to false and refreshing UI.");
    }
  } else {
    // Calculate remaining time more precisely for years, months, days
    const totalDaysLeft = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));

    const years = Math.floor(totalDaysLeft / 365);
    let remainingDays = totalDaysLeft % 365;

    const months = Math.floor(remainingDays / 30.44); // Using average days in a month for better approximation
    remainingDays = Math.floor(remainingDays % 30.44); // Remaining days after accounting for months

    let parts = [];

    if (years > 0) {
      parts.push(`**${years} year${years > 1 ? 's' : ''}**`);
    }
    if (months > 0) {
      parts.push(`**${months} month${months > 1 ? 's' : ''}**`);
    }
    if (remainingDays > 0) {
      parts.push(`**${remainingDays} day${remainingDays > 1 ? 's' : ''}**`);
    }

    if (parts.length === 0) {
        message = "Your Pro membership has **less than a day** remaining.";
    } else if (parts.length === 1) {
        message = `Your Pro membership has ${parts[0]} remaining.`;
    } else if (parts.length === 2) {
        message = `Your Pro membership has ${parts[0]} and ${parts[1]} remaining.`;
    } else { // parts.length === 3 (years, months, days)
        message = `Your Pro membership has ${parts[0]}, ${parts[1]}, and ${parts[2]} remaining.`;
    }
  }

  expiryMessageEl.style.display = 'block';
  expiryMessageEl.innerHTML = message;
  console.log(`[updateMembershipExpiryUI] Displayed message: "${message}"`);
}

// --- MAIN FUNCTION TO REFRESH ALL PRO-GATED UI ---
/**
 * Updates all relevant UI elements based on the current global `isPro` status.
 */
function refreshAllProUI() {
  console.log(`🔄 [refreshAllProUI] Refreshing UI. isPro: ${isPro}`);

  const welcomeMsg = document.getElementById('welcome-msg');
  const currentStoredEmail = localStorage.getItem('userEmail');
  if (welcomeMsg) {
    if (currentStoredEmail) {
      welcomeMsg.textContent = `Welcome, ${currentStoredEmail}! ${isPro ? '(Pro User ✨)' : ''}`;
    } else {
      welcomeMsg.textContent = 'Welcome! Please log in.';
    }
  }

  updateLinkedInAccessUI();
  styleTemplateCardsUI();

  const activeTemplateCard = document.querySelector('.template-card.active-template');
  const currentTemplateName = activeTemplateCard ? activeTemplateCard.dataset.template : '';
  updateWatermarkUI(currentTemplateName);

  // ✅ ADD THIS LINE: Call the new function
  updateMembershipExpiryUI();
}

// --- Core Functions (checkProStatus, switchTemplate, etc.) ---

async function checkProStatus() {
  let email = localStorage.getItem('userEmail');
  let emailSource = 'localStorage';

  // ✅ Always check URL param first — it should override anything in localStorage
  const params = new URLSearchParams(window.location.search);
  const emailFromUrl = params.get('email');

  if (emailFromUrl && emailFromUrl !== 'null' && emailFromUrl.includes('@')) {
    console.log(`👤 [checkProStatus] Email from URL: ${emailFromUrl}`);
    email = decodeURIComponent(emailFromUrl);
    emailSource = 'URL parameter';
    localStorage.setItem('userEmail', email);
    if (window.history.replaceState) {
      const cleanURL = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanURL); // Clean the URL
      console.log("[checkProStatus] Cleaned email from URL.");
    }
  }

  if (!email) {
    console.error("❌ [checkProStatus] No email found.");
    // Ensure proExpiryDate is cleared if no email is found
    localStorage.removeItem('proExpiryDate');
    return;
  }

  console.log(`👤 [checkProStatus] Checking Pro for: ${email} (Source: ${emailSource})`);

  try {
    const response = await fetch('http://localhost:3002/api/check-pro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.toLowerCase().trim() })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: response.statusText }));
      console.error(`❌ [checkProStatus] API Error - Status: ${response.status}, Msg: ${errData.error || 'N/A'}`);
      isPro = false;
      // Clear proExpiryDate on API error
      localStorage.removeItem('proExpiryDate');
      return;
    }

    const result = await response.json();
    if (result && typeof result.isPro === 'boolean') {
      isPro = result.isPro;

      // ⭐⭐⭐ CRUCIAL ADDITION HERE ⭐⭐⭐
      if (isPro && result.pro_expiry) { // Only store if user is Pro AND pro_expiry is provided
        localStorage.setItem('proExpiryDate', result.pro_expiry);
        console.log(`[checkProStatus] Stored proExpiryDate in localStorage: ${result.pro_expiry}`);
      } else {
        localStorage.removeItem('proExpiryDate'); // Clear if not Pro or no expiry provided
        console.log("[checkProStatus] Not Pro or no pro_expiry received. Cleared proExpiryDate.");
      }
      // ⭐⭐⭐ END CRUCIAL ADDITION ⭐⭐⭐

      const toastEl = document.getElementById('pro-toast');

      // ✅ Show toast only if just became Pro via Stripe redirect
      if (isPro && emailSource === 'URL parameter' && toastEl) {
        toastEl.style.display = 'block';
        setTimeout(() => {
          toastEl.style.opacity = '1';
        }, 10);

        setTimeout(() => {
          toastEl.style.opacity = '0';
          setTimeout(() => toastEl.style.display = 'none', 500);
        }, 5000);
      }

      console.log(`✅ [checkProStatus] Pro status from backend: ${isPro}, Expiry: ${result.pro_expiry || 'N/A'}`);
    } else {
      console.warn("❓ [checkProStatus] Invalid response:", result);
      isPro = false;
      localStorage.removeItem('proExpiryDate'); // Clear proExpiryDate on invalid response
    }
  } catch (err) {
    console.error(`❌ [checkProStatus] Network error: ${err.message}`);
    isPro = false;
    localStorage.removeItem('proExpiryDate'); // Clear proExpiryDate on network error
  }
}

let currentTemplate = 'tech'; // or your default

function switchTemplate(templateName) {
  if (premiumTemplates.includes(templateName) && !isPro) {
    alert("✨ Upgrade to Pro to use this template.");
    return;
  }

  currentTemplate = templateName; // ✅ store current selection

  const preview = document.getElementById('cv-preview');
  if (!preview) return;

  preview.className = 'preview-section card';
  preview.classList.add(`template-${templateName}`);

  styleTemplateCardsUI(); // ✅ call to restyle buttons after switch
  updateWatermarkUI(templateName);
}

function convertToBullets(text) {
  if (!text || typeof text !== 'string') return '';
  const lines = text.split('\n').filter(l => l.trim() !== '');
  return lines.length > 0 ? `<ul>${lines.map(l => `<li>${l.trim()}</li>`).join('')}</ul>` : '';
}

function startCheckout() {
  const email = localStorage.getItem('userEmail');
  console.log(`[startCheckout] Email from localStorage at start: ${email}`);

  if (!email) {
    alert("Please log in first to purchase Pro.");
    return;
  }

  // ✅ This is the correct place for the console log
  console.log("[startCheckout] Email being sent to /create-checkout-session:", email);
  console.log("IMPORTANT CHECK! Email going to payment helper is:", email);
  fetch('http://localhost:3000/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
  .then(response => {
    if (!response.ok) {
      return response.json().then(err => { throw new Error(err.error || `HTTP error ${response.status}`); });
    }
    return response.json();
  })
  .then(data => {
    if (data && data.url) {
      console.log("[startCheckout] Stripe URL received. Redirecting...");
      window.location.href = data.url;
    } else {
      console.error('[startCheckout] Checkout session response missing URL:', data);
      alert('Failed to get checkout URL. Please try again.');
    }
  })
  .catch(err => {
    console.error('❌ [startCheckout] Error:', err.message);
    alert(`Failed to start checkout: ${err.message}`);
  });
}

function autofillTestData() {
  console.log("[autofillTestData] Filling form...");
  document.getElementById('jobTitle').value = 'Senior Software Engineer';
  document.getElementById('name').value = 'Sarah Thompson';
  document.getElementById('email').value = 'sarah.thompson@example.com';
  document.getElementById('phone').value = '+353 87 123 4567';
  document.getElementById('linkedin').value = 'https://www.linkedin.com/in/sarahthompson';
  document.getElementById('portfolio').value = 'https://sarahcodes.dev';
  document.getElementById('summary').value = `Experienced developer with 8+ years in full-stack development, leading teams and delivering scalable solutions. Passionate about clean code, mentorship, and continuous learning.`;
  document.getElementById('work').value = `Senior Engineer at TechCorp (2020–Present):\n- Led migration to microservices.\n- Mentored 4 junior developers.\n\nSoftware Engineer at DevSoft (2016–2020):\n- Built core features for e-commerce platform.`;
  document.getElementById('education').value = `B.Sc. in Computer Science – University of Limerick (2012–2016)`;
  document.getElementById('projects').value = `Open Source: Contributed to Vue.js\nFreelance: Built portfolio sites for 12 clients`;
  document.getElementById('certifications').value = `AWS Certified Solutions Architect\nScrum Master Certification`;
  document.getElementById('languages').value = `English (Fluent), German (Basic)`;
  document.getElementById('skills').value = `JavaScript HTML CSS React Node.js MongoDB Git Docker`; // Adjusted skills input for robust splitting
  document.getElementById('hobbies').value = `Hiking, Photography, Blogging`;

  const cvForm = document.getElementById('cv-form');
  if (cvForm) cvForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

// --- DOMContentLoaded: Main Initialization and Event Listener Setup ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log("🚀 DOM fully loaded and parsed. Initializing main page...");

  // Add temporary print-mode class to force dark styling in print
  window.onbeforeprint = () => {
    const preview = document.getElementById('cv-preview');
    if (preview && preview.classList.contains('template-tech')) {
      preview.classList.add('print-mode-tech');
    }
  };

  window.onafterprint = () => {
    const preview = document.getElementById('cv-preview');
    if (preview) {
      preview.classList.remove('print-mode-tech');
    }
  };

  // ❌❌❌ NESTED LISTENER REMOVED FROM HERE ❌❌❌

  const saveFields = [
    'name', 'jobTitle', 'email', 'phone', 'linkedin', 'portfolio',
    'summary', 'work', 'projects', 'education', 'certifications',
    'languages', 'skills', 'hobbies'
  ];

  saveFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        const data = {};
        saveFields.forEach(fid => {
          const f = document.getElementById(fid);
          if (f) data[fid] = f.value;
        });
        localStorage.setItem('cvData', JSON.stringify(data));
      });
    }
  });

  await checkProStatus(); // Checks localStorage & URL param, then backend
  refreshAllProUI(); // Updates all UI based on isPro

  const currentPage = window.location.pathname.split('/').pop();

  if (['main.html'].includes(currentPage)) {
    const confirmedEmail = localStorage.getItem('userEmail');
    if (!confirmedEmail || confirmedEmail === 'null') {
      console.warn('[Guard] No confirmed email found. Redirecting...');
      alert('Not logged in. Redirecting to login page.');
      window.location.href = 'login.html';
      return;
    } else {
      console.log('[Guard] User confirmed on main.html:', confirmedEmail);
    }
  }

  if (isPro) {
    unlockAIButtons(); // 👈 Make sure this is here
  } else {
    // fallback for free users
    document.querySelectorAll('.ai-button').forEach(btn => {
      btn.addEventListener('click', () => {
        alert('This AI feature is only available to Pro users. Upgrade to unlock.');
      });
    });
  }

  const savedCV = JSON.parse(localStorage.getItem('cvData'));
  if (savedCV) {
    for (const [key, value] of Object.entries(savedCV)) {
      const field = document.getElementById(key);
      if (field) field.value = value;
    }
    document.getElementById('cv-form')?.dispatchEvent(new Event('submit'));
  }

  // Theme Toggle
  const htmlEl = document.documentElement;
  const themeToggleBtn = document.getElementById('theme-toggle');

  function applyTheme(theme) {
    htmlEl.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    themeToggleBtn.textContent = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
  }

  // Load theme on page load
  const savedTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(savedTheme);

  // Toggle theme on click
  themeToggleBtn.addEventListener('click', () => {
    const newTheme = htmlEl.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
  });

  // Accent Color Picker Setup (Fixing double declaration issue)
  const accentPicker = document.getElementById('accent-picker');

  if (accentPicker) {
    const defaultAccent = '#007bff';
    const savedAccent = localStorage.getItem('accentColor') || defaultAccent;

    // Set the saved color on page load
    document.documentElement.style.setProperty('--accent', savedAccent);
    accentPicker.value = savedAccent;

    // Listen to all changes including slider drag
    accentPicker.addEventListener('input', (e) => {
      const newColor = e.target.value;
      document.documentElement.style.setProperty('--accent', newColor);
      localStorage.setItem('accentColor', newColor);
      console.log('[Accent Picker] Changed to:', newColor);
    });
  }

  // Logout Button
  const logoutButton = document.getElementById('logout-btn');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      console.log("[Logout] Logging out...");
      localStorage.removeItem('userEmail');
      isPro = false;
      refreshAllProUI();
      alert('Logged out successfully.');
      window.location.href = 'login.html';
    });
  } else { console.warn("Logout button not found."); }

  // Buy Pro Button
  const buyProButton = document.getElementById('buy-pro-btn');
  if (buyProButton) {
    buyProButton.addEventListener('click', startCheckout);
  } else { console.warn("Buy Pro button (id='buy-pro-btn') not found."); }

  // Autofill Button
  const autofillBtn = document.getElementById('autofill-btn');
  if (autofillBtn) {
    autofillBtn.addEventListener('click', autofillTestData);
  } else { console.warn("Autofill button not found."); }

  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    // await supabase.auth.signOut(); // Keep or remove based on whether you use Supabase auth
    localStorage.removeItem("userEmail");
    window.location.href = "login.html"; // or your login route
  });

  document.getElementById("buy-pro-btn")?.addEventListener("click", () => {
    startCheckout(); // assuming you already defined this function
  });

  // LinkedIn Import Button
  const linkedinImportButton = document.getElementById('linkedin-import');
  if (linkedinImportButton) {
    linkedinImportButton.addEventListener('click', async () => {
        if (!isPro) { alert('Please upgrade to Pro to use LinkedIn import.'); return; }
        const linkedinUrlInput = document.getElementById('linkedin');
        if (!linkedinUrlInput) { alert('LinkedIn URL input field not found.'); return; }
        const url = linkedinUrlInput.value.trim();
        if (!url || !url.includes('linkedin.com')) { alert('Please enter a valid LinkedIn profile URL.'); return; }
        console.log(`[LinkedIn Import] Importing from: ${url}`);
        try {
            const response = await fetch('http://localhost:3000/api/linkedin-import', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url })
            });
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ detail: "Import failed: " + response.statusText }));
                throw new Error(errData.detail || "LinkedIn import request failed");
            }
            const data = await response.json();
            if (data && data.full_name) {
                document.getElementById('name').value = data.full_name || '';
                document.getElementById('jobTitle').value = data.occupation || '';
                const cvEmailField = document.getElementById('email');
                if (cvEmailField && data.email) cvEmailField.value = data.email;
                document.getElementById('summary').value = data.summary || '';
                const cvFormForDispatch = document.getElementById('cv-form');
                if (cvFormForDispatch) cvFormForDispatch.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                alert('LinkedIn profile data imported successfully!');
            } else { alert('Profile import successful but returned no main data.'); }
        } catch (err) { console.error('❌ [LinkedIn Import] Error:', err); alert(`Error importing LinkedIn profile: ${err.message}`); }
    });
  } else { console.warn("LinkedIn import button not found."); }

  document.querySelectorAll('.template-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const tpl = btn.dataset.template;
      switchTemplate(tpl);
    });
  });

  // CV Form Submit Listener
  const cvForm = document.getElementById('cv-form');
  if (cvForm) {
    cvForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log("[CV Form] Previewing CV...");
        const nameEl = document.getElementById('preview-name');
        if (nameEl) nameEl.textContent = document.getElementById('name')?.value || '';
        const titleEl = document.getElementById('preview-title');
        if (titleEl) titleEl.textContent = document.getElementById('jobTitle')?.value || '';
        const contactEl = document.getElementById('preview-contact');
        const emailVal = document.getElementById('email')?.value || '';
        const phoneVal = document.getElementById('phone')?.value || '';
        if (contactEl) contactEl.textContent = `${emailVal} | ${phoneVal}`;
        const linkedinUrl = document.getElementById('linkedin')?.value || '';
        const portfolioUrl = document.getElementById('portfolio')?.value || '';
        const linksEl = document.getElementById('preview-links');
        if (linksEl) {
            const linksHtml = [];
            if (linkedinUrl) linksHtml.push(`<a href="${linkedinUrl}" target="_blank">LinkedIn</a>`);
            if (portfolioUrl) linksHtml.push(`<a href="${portfolioUrl}" target="_blank">Portfolio</a>`);
            linksEl.innerHTML = linksHtml.join(' | ');
        }
        const summaryEl = document.getElementById('preview-summary');
        if (summaryEl) summaryEl.textContent = document.getElementById('summary')?.value || '';
        const workEl = document.getElementById('preview-work');
        if (workEl) workEl.innerHTML = convertToBullets(document.getElementById('work')?.value || '');
        const projectsEl = document.getElementById('preview-projects');
        if (projectsEl) projectsEl.innerHTML = convertToBullets(document.getElementById('projects')?.value || '');
        const educationEl = document.getElementById('preview-education');
        if (educationEl) educationEl.textContent = document.getElementById('education')?.value || '';
        const certsEl = document.getElementById('preview-certifications');
        if (certsEl) certsEl.textContent = document.getElementById('certifications')?.value || '';
        const langsEl = document.getElementById('preview-languages');
        if (langsEl) langsEl.textContent = document.getElementById('languages')?.value || '';
        const hobbiesEl = document.getElementById('preview-hobbies');
        if (hobbiesEl) hobbiesEl.textContent = document.getElementById('hobbies')?.value || '';
        const skillsValue = document.getElementById('skills')?.value || '';
        const skillsArray = skillsValue ? skillsValue.split(/[\s,;]+/).filter(s => s.trim() !== "") : [];
        const skillsEl = document.getElementById('preview-skills');
        if (skillsEl) skillsEl.innerHTML = skillsArray.map(s => `<span class="skill-badge">${s.trim()}</span>`).join('');
    });
  } else { console.warn("CV Form not found."); }

  const downloadPdfBtn = document.getElementById('download-pdf');
  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // Profile Photo Upload Listener
  const photoUploadInput = document.getElementById('photo-upload');
  if (photoUploadInput) {
    photoUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        const profileImg = document.getElementById('profile-photo');
        if (!file || !profileImg) return;
        console.log(`[Photo Upload] File selected: ${file.name}`);
        const reader = new FileReader();
        reader.onload = (e) => {
            profileImg.src = e.target.result;
            profileImg.style.display = 'block';
            console.log("[Photo Upload] Preview updated.");
        };
        reader.readAsDataURL(file);
    });
  } else { console.warn("Photo upload input element not found."); }

  // Template Card Click Listener (Delegation)
  const templateOptionsDiv = document.querySelector('.template-options');
  if (templateOptionsDiv) {
    templateOptionsDiv.addEventListener('click', (event) => {
      const target = event.target.closest('.template-card');
      if (!target || target.classList.contains('locked-template')) return;
      const templateName = target.dataset.template;
      switchTemplate(templateName);
    });
  } else { console.warn("Template options container not found."); }

  // Initial Template Selection
  const defaultTemplate = 'tech';
  const defaultTemplateButton = document.querySelector(`.template-card[data-template="${defaultTemplate}"]`);
  if (defaultTemplateButton) {
    console.log(`[Initialization] Setting default template to: ${defaultTemplate}`);
    if (!defaultTemplateButton.classList.contains('locked-template')) { // Only switch if not locked
        switchTemplate(defaultTemplate);
    } else {
        console.warn(`Default template '${defaultTemplate}' is locked. Not switching initially.`);
        const firstAvailable = document.querySelector('.template-card:not(.locked-template)');
        if (firstAvailable) {
            console.log(`[Initialization] Switching to first available template: ${firstAvailable.dataset.template}`);
            switchTemplate(firstAvailable.dataset.template);
        } else {
             const preview = document.getElementById('cv-preview');
             if(preview && !Array.from(preview.classList).some(c => c.startsWith('template-'))) {
                preview.classList.add(`template-tech`);
             }
             updateWatermarkUI('tech');
        }
    }
  } else {
    console.warn(`Default template button for '${defaultTemplate}' not found. Applying class directly if preview exists.`);
    const preview = document.getElementById('cv-preview');
    if(preview) {
        preview.classList.add(`template-${defaultTemplate}`);
        updateWatermarkUI(defaultTemplate);
    }
  }
   
  // --- Attach AI Skills Button Listener ---
    console.log("DEBUG: Trying to attach Generate Skills button listener...");
    const generateSkillsButton = document.getElementById('generate-skills-btn');
    console.log("DEBUG: Result of getElementById('generate-skills-btn'):", generateSkillsButton);

    if (generateSkillsButton) {
        console.log("DEBUG: Generate Skills Button FOUND! Attaching listener...");
        generateSkillsButton.addEventListener('click', generateSkillsAI);
        console.log("DEBUG: Listener ATTACHED to Generate Skills button.");
    } else {
        console.error("DEBUG: Generate Skills button was NOT found. Listener NOT attached.");
    }
    // --- End Attach AI Skills Button Listener ---
     
    // --- Attach AI Work Experience Button Listener ---
    console.log("DEBUG: Trying to attach Generate Work Experience button listener...");
    const generateWorkButton = document.getElementById('generate-work-experience-button');
    console.log("DEBUG: Result of getElementById('generate-work-experience-button'):", generateWorkButton);

    if (generateWorkButton) {
        console.log("DEBUG: Generate Work Experience Button FOUND! Attaching listener...");
        generateWorkButton.addEventListener('click', generateWorkExperienceAI);
        console.log("DEBUG: Listener ATTACHED to Generate Work Experience button.");
    } else {
        console.error("DEBUG: Generate Work Experience button was NOT found. Listener NOT attached.");
    }
    // --- End Attach AI Work Experience Button Listener ---

     // --- Attach AI Cover Letter Button Listener ---
    console.log("DEBUG: Trying to attach Generate Cover Letter button listener...");
    const generateCoverLetterButton = document.getElementById('generate-cover-letter-button');
    console.log("DEBUG: Result of getElementById('generate-cover-letter-button'):", generateCoverLetterButton);

    if (generateCoverLetterButton) {
        console.log("DEBUG: Generate Cover Letter Button FOUND! Attaching listener...");
        generateCoverLetterButton.addEventListener('click', generateCoverLetterAI);
        console.log("DEBUG: Listener ATTACHED to Generate Cover Letter button.");
    } else {
        console.error("DEBUG: Generate Cover Letter button was NOT found. Listener NOT attached.");
    }
    // --- End Attach AI Cover Letter Button Listener ---

    // --- Attach AI Summary Button Listener ---
    console.log("DEBUG: Trying to attach Generate Summary button listener...");
    const generateSummaryButton = document.getElementById('generate-summary-button');
    console.log("DEBUG: Result of getElementById('generate-summary-button'):", generateSummaryButton);

    if (generateSummaryButton) {
        console.log("DEBUG: Generate Summary Button FOUND! Attaching listener...");
        generateSummaryButton.addEventListener('click', generateSummaryAI);
        console.log("DEBUG: Listener ATTACHED to Generate Summary button.");
    } else {
        console.error("DEBUG: Generate Summary button was NOT found. Listener NOT attached.");
    }
    // --- End Attach AI Summary Button Listener ---

  // ⭐⭐⭐ CODE ADDED HERE ⭐⭐⭐
  // --- Attach Clear All Button Listener ---
  console.log("DEBUG: Trying to attach Clear All button listener...");
  const clearAllButton = document.getElementById('clear-all-btn');
  console.log("DEBUG: Result of getElementById('clear-all-btn'):", clearAllButton);

  if (clearAllButton) {
      console.log("DEBUG: Button FOUND! Attaching listener...");
      clearAllButton.addEventListener('click', clearAllFields); // Make sure clearAllFields is defined!
      console.log("DEBUG: Listener ATTACHED to Clear All button.");
  } else {
      console.error("DEBUG: Clear All button was NOT found. Listener NOT attached.");
  }
  // --- End Attach Clear All Button Listener ---
  // ⭐⭐⭐ END OF ADDED CODE ⭐⭐⭐

  console.log("🏁 Main page initialization complete.");
  console.log("Script.js finished initial execution pass."); // Moved this log inside for clarity

}); // <-- This closes the big DOMContentLoaded function

// --- Global Event Listeners (pageshow, visibilitychange) ---
window.addEventListener('pageshow', async (event) => {
  console.log(`🌀 pageshow fired (persisted: ${event.persisted}) — rechecking status & refreshing UI`);
  await checkProStatus();
  refreshAllProUI();
});

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && window.location.pathname.includes('main.html')) {
    console.log("👁️ Page became visible, re-checking Pro status and refreshing UI.");
    await checkProStatus();
    refreshAllProUI();
  }
});

// ==================================================================
// --- Generate Skills AI Function (Updated for Real Backend) ---
// ==================================================================
async function generateSkillsAI() {
    console.log("[generateSkillsAI] Clicked.");
    if (!isPro) {
        alert('AI Skill Generation is a Pro feature. Please upgrade.');
        return;
    }

    // --- Get Context ---
    const jobTitle = document.getElementById('jobTitle')?.value || '';
    const summary = document.getElementById('summary')?.value || '';
    const skillsField = document.getElementById('skills');
    const skillsButton = document.getElementById('generate-skills-btn');

    if (!skillsField || !skillsButton) {
        console.error("Skills field or button not found!");
        return;
    }

    if (!jobTitle && !summary) {
        alert("Please fill in at least the Job Title or Summary to generate relevant skills.");
        return;
    }

    // --- Provide visual feedback ---
    const originalButtonHTML = skillsButton.innerHTML;
    skillsButton.innerHTML = "✨ Generating...";
    skillsField.value = "Contacting AI for skills, please wait...";
    skillsField.disabled = true;
    skillsButton.disabled = true;

    try {
        // --- CONSTRUCT THE PROMPT ---
        const promptText = `Based on the Job Title "${jobTitle}" and this summary "${summary}", list 10 to 15 key technical and soft skills. Present them as a single line, separated only by spaces. For example: JavaScript React Node.js Teamwork Communication`;
        console.log("[generateSkillsAI] Sending prompt to backend...");

        // --- MAKE THE REAL AI CALL ---
        const response = await fetch('http://localhost:3000/api/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: `Request failed: ${response.statusText}` }));
            throw new Error(errData.error || `Backend request failed with status ${response.status}`);
        }

        const data = await response.json();

        // --- UPDATE THE FIELD ---
        if (data && data.result) {
            skillsField.value = data.result;
            console.log("[generateSkillsAI] Skills generated successfully.");
        } else {
            throw new Error("Received an invalid response from the AI backend.");
        }

    } catch (error) {
        console.error("❌ [generateSkillsAI] Error:", error);
        skillsField.value = `Failed to generate skills: ${error.message}. Please try again.`;
        alert(`An error occurred while generating skills: ${error.message}`);
    } finally {
        // --- Restore button and field ---
        skillsField.disabled = false;
        skillsButton.disabled = false;
        skillsButton.innerHTML = `✨ Generate Skills <span class="lock-icon">🔒</span>`; // Reset

        if (isPro) {
            skillsButton.innerHTML = `✨ Generate Skills`;
            const lockIcon = skillsButton.querySelector('.lock-icon');
            if(lockIcon) lockIcon.remove();
        } else {
             skillsButton.disabled = true;
        }
    }
}

// ======================================================================
// --- Generate Cover Letter AI Function (Updated for Real Backend) ---
// ======================================================================
async function generateCoverLetterAI() {
    console.log("[generateCoverLetterAI] Clicked.");
    if (!isPro) {
        alert('AI Cover Letter Generation is a Pro feature. Please upgrade.');
        return;
    }

    // --- Get Context ---
    const name = document.getElementById('name')?.value || 'Your Name';
    const jobTitle = document.getElementById('jobTitle')?.value || 'Applicant';
    const summary = document.getElementById('summary')?.value || '';
    const work = document.getElementById('work')?.value || '';
    const skills = document.getElementById('skills')?.value || '';
    const targetCompany = document.getElementById('targetCompany')?.value;
    const jobDescription = document.getElementById('jobDescription')?.value;
    const coverLetterField = document.getElementById('generatedCoverLetter');
    const coverLetterButton = document.getElementById('generate-cover-letter-button');

    if (!coverLetterField || !coverLetterButton) {
        console.error("Cover Letter field or button not found!");
        return;
    }

    if (!targetCompany || !jobDescription) {
        alert("Please fill in both the Target Company Name and the Job Description to generate a cover letter.");
        return;
    }
     if (!name || !jobTitle) {
        alert("Please ensure your Name and current/target Job Title are filled in the CV section.");
        return;
    }

    // --- Provide visual feedback ---
    const originalButtonHTML = coverLetterButton.innerHTML;
    coverLetterButton.innerHTML = "✨ Generating...";
    coverLetterField.value = "Crafting your cover letter, this might take a moment...";
    coverLetterField.disabled = true;
    coverLetterButton.disabled = true;

    try {
        // --- CONSTRUCT THE PROMPT ---
        const promptText = `Write a professional and engaging cover letter from ${name} for the ${jobTitle} position at ${targetCompany}. Use the provided CV details (Summary: "${summary}", Work Experience: "${work}", Skills: "${skills}") to highlight suitability. Tailor the letter specifically to this Job Description: "${jobDescription}". The tone should be enthusiastic but professional. Structure it into 3-4 paragraphs and end with a standard closing.`;
        console.log("[generateCoverLetterAI] Sending prompt to backend...");

        // --- MAKE THE REAL AI CALL ---
        const response = await fetch('http://localhost:3000/api/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: `Request failed: ${response.statusText}` }));
            throw new Error(errData.error || `Backend request failed with status ${response.status}`);
        }

        const data = await response.json();

        // --- UPDATE THE FIELD ---
        if (data && data.result) {
            coverLetterField.value = data.result;
            console.log("[generateCoverLetterAI] Cover Letter generated successfully.");
        } else {
            throw new Error("Received an invalid response from the AI backend.");
        }

    } catch (error) {
        console.error("❌ [generateCoverLetterAI] Error:", error);
        coverLetterField.value = `Failed to generate cover letter: ${error.message}. Please try again.`;
        alert(`An error occurred while generating cover letter: ${error.message}`);
    } finally {
        // --- Restore button and field ---
        coverLetterField.disabled = false;
        coverLetterButton.disabled = false;
        coverLetterButton.innerHTML = `Generate Cover Letter <span class="lock-icon">🔒</span>`; // Reset

        if (isPro) {
            coverLetterButton.innerHTML = `Generate Cover Letter`;
            const lockIcon = coverLetterButton.querySelector('.lock-icon');
            if(lockIcon) lockIcon.remove();
        } else {
             coverLetterButton.disabled = true;
        }
    }
}


// ==========================================================================
// --- Generate Work Experience AI Function (Uses Existing Company Names) ---
// ==========================================================================
async function generateWorkExperienceAI() {
    console.log("[generateWorkExperienceAI] Clicked (Enhance Mode).");
    if (!isPro) {
        alert('AI Work Experience Generation is a Pro feature. Please upgrade.');
        return;
    }

    // --- Get Context ---
    const jobTitle = document.getElementById('jobTitle')?.value || 'Developer';
    const workField = document.getElementById('work');
    const workButton = document.getElementById('generate-work-experience-button');

    if (!workField || !workButton) {
        console.error("Work Experience field or button not found!");
        return;
    }

    const existingWork = workField.value.trim(); // Get existing text

    // --- NEW: Check if there's text to work with ---
    if (!existingWork) {
        alert("Please type your Company Names (one per line) into the Work Experience box first, then click 'Generate'.");
        return;
    }

    // --- NEW: Extract company names ---
    const companyNames = existingWork.split('\n').filter(line => line.trim() !== '');
    if (companyNames.length === 0) {
         alert("Couldn't find any company names in the Work Experience box. Please type them one per line.");
        return;
    }
    const companiesString = companyNames.join(', '); // Join for the prompt

     if (!jobTitle) {
        alert("Please fill in at least the Job Title to generate relevant work experience.");
        return;
    }

    // --- Provide visual feedback ---
    const originalButtonHTML = workButton.innerHTML;
    workButton.innerHTML = "✨ Enhancing..."; // Updated text
    workField.disabled = true;
    workButton.disabled = true;

    try {
        // --- CONSTRUCT THE NEW PROMPT ---
        const promptText = `For a CV with the job title "${jobTitle}", generate detailed work experience entries **only** for these companies: ${companiesString}. For each company, invent a plausible date range (within the last 10 years, ensuring logical order if multiple) and provide 3-4 bullet points detailing typical responsibilities and achievements. Format each entry clearly for a CV (using '-' for bullets) and ensure a blank line separates the entries.`;
        console.log("[generateWorkExperienceAI] Sending prompt to backend (Enhance Mode):", promptText);

        // --- MAKE THE REAL AI CALL ---
        const response = await fetch('http://localhost:3000/api/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: `Request failed: ${response.statusText}` }));
            throw new Error(errData.error || `Backend request failed with status ${response.status}`);
        }

        const data = await response.json();

        // --- UPDATE THE FIELD ---
        if (data && data.result) {
            workField.value = data.result; // Overwrite with enhanced text
            console.log("[generateWorkExperienceAI] Work Experience enhanced successfully.");
        } else {
            throw new Error("Received an invalid response from the AI backend.");
        }

    } catch (error) {
        console.error("❌ [generateWorkExperienceAI] Error:", error);
        workField.value = `Failed to generate work experience: ${error.message}. Please try again.`;
        alert(`An error occurred while generating work experience: ${error.message}`);
    } finally {
        // --- Restore button and field ---
        workField.disabled = false;
        workButton.disabled = false;
        workButton.innerHTML = `Generate Work Experience <span class="lock-icon">🔒</span>`; // Reset

        if (isPro) {
            workButton.innerHTML = `Generate Work Experience`;
            const lockIcon = workButton.querySelector('.lock-icon');
            if(lockIcon) lockIcon.remove();
        } else {
             workButton.disabled = true;
        }
    }
}


// --- Generate Summary AI Function (Updated for Real Backend) ---
async function generateSummaryAI() {
    console.log("[generateSummaryAI] Clicked.");
    if (!isPro) {
        alert('AI Summary Generation is a Pro feature. Please upgrade.');
        return;
    }

    // --- Get Context ---
    const jobTitle = document.getElementById('jobTitle')?.value || '';
    const work = document.getElementById('work')?.value || '';
    const skills = document.getElementById('skills')?.value || '';
    const summaryField = document.getElementById('summary');
    const summaryButton = document.getElementById('generate-summary-button');

    if (!summaryField || !summaryButton) {
        console.error("Summary field or button not found!");
        return;
    }

    if (!jobTitle && !work) {
        alert("Please fill in at least the Job Title or Work Experience to generate a relevant summary.");
        return;
    }

    // --- Provide visual feedback ---
    const originalButtonHTML = summaryButton.innerHTML;
    summaryButton.innerHTML = "✨ Generating...";
    summaryField.value = "Contacting AI, please wait..."; // Updated message
    summaryField.disabled = true;
    summaryButton.disabled = true;

    try {
        // --- CONSTRUCT THE PROMPT ---
        const promptText = `Generate a concise and professional 2-3 sentence CV summary for a ${jobTitle}. Incorporate key aspects from the following work experience: "${work}" and mention some of these skills: "${skills}". Focus on impact and suitability for a similar role.`;
        console.log("[generateSummaryAI] Sending prompt to backend:", promptText);

        // --- MAKE THE REAL AI CALL (via your backend) ---
        const response = await fetch('http://localhost:3000/api/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText }) // Send the prompt
        });

        if (!response.ok) {
            // Try to get error message from backend, or use status text
            const errData = await response.json().catch(() => ({ error: `Request failed: ${response.statusText}` }));
            throw new Error(errData.error || `Backend request failed with status ${response.status}`);
        }

        const data = await response.json();

        // --- UPDATE THE FIELD ---
        if (data && data.result) {
            summaryField.value = data.result; // Use the AI result
            console.log("[generateSummaryAI] Summary generated successfully.");
        } else {
            throw new Error("Received an invalid response from the AI backend.");
        }

    } catch (error) {
        console.error("❌ [generateSummaryAI] Error:", error);
        summaryField.value = `Failed to generate summary: ${error.message}. Please try again.`;
        alert(`An error occurred while generating summary: ${error.message}`);
    } finally {
        // --- Restore button and field ---
        summaryField.disabled = false;
        summaryButton.disabled = false;
        summaryButton.innerHTML = `Generate Summary <span class="lock-icon">🔒</span>`; // Reset

        // Re-apply Pro state
        if (isPro) {
            summaryButton.innerHTML = `Generate Summary`;
            const lockIcon = summaryButton.querySelector('.lock-icon');
            if(lockIcon) lockIcon.remove();
        } else {
             summaryButton.disabled = true;
        }
    }
}


// --- Function to Clear All Fields ---
function clearAllFields() {
  console.log("[clearAllFields] Clearing all CV form fields and local storage data.");

  // List all the IDs of your form fields
  const formFields = [
    'jobTitle', 'name', 'email', 'phone', 'linkedin', 'portfolio',
    'summary', 'work', 'education', 'projects', 'certifications',
    'languages', 'skills', 'hobbies',
    'targetCompany', 'jobDescription', 'generatedCoverLetter'
  ];

  // Loop through each ID and clear the corresponding field
  formFields.forEach(id => {
    const field = document.getElementById(id);
    if (field) {
      // This works for most <input> and <textarea> elements
      field.value = '';
    } else {
      console.warn(`Field with ID '${id}' not found.`);
    }
  });

  // Clear the profile photo
  const profileImg = document.getElementById('profile-photo');
  if (profileImg) {
    profileImg.src = ''; // Or set to a default placeholder image
    profileImg.style.display = 'none';
  } else {
      console.warn("Profile photo element not found.");
  }

  // Clear any saved data from local storage
  localStorage.removeItem('cvData');
  console.log("Local storage 'cvData' cleared.");

  // Trigger an update (Using 'input' is often safer than 'submit' for previews)
  const cvForm = document.getElementById('cv-form');
  if (cvForm) {
      console.log("Dispatching 'input' event on cv-form for preview update.");
      cvForm.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
      console.warn("CV Form with ID 'cv-form' not found.");
  }

  // Call your progress update function (make sure it's defined!)
  if (typeof updateCompletionProgress === 'function') {
      updateCompletionProgress();
  } else {
      console.warn("updateCompletionProgress() function is not defined.");
  }

  // Let the user know it's done
  alert('All fields have been cleared!');
}

// ❌❌❌ FINAL DOMContentLoaded LISTENER REMOVED FROM HERE ❌❌❌

// --- You need to define this function somewhere ---
// Example:
/*
function updateCompletionProgress() {
  console.log("Updating completion progress...");
  // Add your actual progress update logic here
}
*/

// ❌❌❌ REMOVED LOG THAT WAS OUTSIDE DOMContentLoaded ❌❌❌