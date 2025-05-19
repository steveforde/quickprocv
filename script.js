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
}



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





// Log initial state
console.log("[Initial State] isPro:", isPro);
const initialEmailOnLoad = localStorage.getItem('userEmail');
console.log("[Initial State] LocalStorage userEmail on script load:", initialEmailOnLoad);




const email = localStorage.getItem('userEmail');
if (!email) {
  alert('Not logged in. Redirecting to login page.');
  window.location.href = 'login.html';
}
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
      return;
    }

    const result = await response.json();
    if (result && typeof result.isPro === 'boolean') {
      isPro = result.isPro;
      console.log(`✅ [checkProStatus] Pro status from backend: ${isPro}`);
    } else {
      console.warn("❓ [checkProStatus] Invalid response:", result);
      isPro = false;
    }
  } catch (err) {
    console.error(`❌ [checkProStatus] Network error: ${err.message}`);
    isPro = false;
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
  refreshAllProUI();      // Updates all UI based on isPro
  

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
const savedTheme = localStorage.getItem('theme') || 'light';
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
  await supabase.auth.signOut();
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
        // Optionally, find the first *available* template and switch to that
        const firstAvailable = document.querySelector('.template-card:not(.locked-template)');
        if (firstAvailable) {
            console.log(`[Initialization] Switching to first available template: ${firstAvailable.dataset.template}`);
            switchTemplate(firstAvailable.dataset.template);
        } else {
            // If all templates are locked (e.g. non-pro user and all are premium except tech, but tech isn't found)
            // just ensure basic preview state.
             const preview = document.getElementById('cv-preview');
             if(preview && !Array.from(preview.classList).some(c => c.startsWith('template-'))) {
                preview.classList.add(`template-tech`); // Fallback to tech class for styling
             }
             updateWatermarkUI('tech'); // Show watermark if tech is the fallback and user not pro
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

  console.log("🏁 Main page initialization complete.");


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



console.log("Script.js finished initial execution pass.")}); // <-- This closes the big DOMContentLoaded function
