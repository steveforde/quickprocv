// script.js
console.log("Script.js starting execution.");

// --- Configuration & Global State ---
const premiumTemplates = ['marketing', 'business', 'classic', 'student', 'temp'];
let isPro = false;

// --- AI Buttons Helper Function ---
// This function selectively unlocks AI buttons for Pro users and handles non-AI buttons.
function unlockAIButtons() {
  console.log("[unlockAIButtons] Running with isPro:", isPro);
  
  // Select only the AI buttons that are INTENDED to have AI functionality (Summary, Work Exp, Cover Letter)
  const aiButtonsForAI = document.querySelectorAll(
      '#generate-summary-button, #generate-work-experience-button, #generate-cover-letter-button'
  ); 
  console.log("[unlockAIButtons] Found", aiButtonsForAI.length, "AI buttons with IDs for AI functionality.");

  aiButtonsForAI.forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('locked');
    btn.title = "Generate with AI";

    const lockIcon = btn.querySelector('.lock-icon');
    if (lockIcon) {
      lockIcon.remove();
      console.log("[unlockAIButtons] Lock icon removed for AI button.");
    }
  });

  // Handle all other buttons with class 'ai-button' (Projects, Skills)
  // These should *not* be unlocked by AI logic, but remain consistent disabled/locked appearance.
  document.querySelectorAll('button.ai-button:not([id^="generate-"])').forEach(btn => {
      btn.disabled = true; // Keep them disabled
      btn.classList.add('locked');
      btn.title = "Feature not available"; 
      
      // Ensure they have a lock icon if applicable (e.g., if one wasn't in HTML initially)
      let lockIcon = btn.querySelector('.lock-icon');
      if (!lockIcon) {
          lockIcon = document.createElement('span');
          lockIcon.className = 'lock-icon';
          lockIcon.textContent = ' 🔒';
          btn.appendChild(lockIcon);
      }
      lockIcon.style.display = 'inline';
  });

  // LinkedIn Import button is now completely removed from HTML, so no JS handling here.
}

// Style template cards based on Pro status
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

    if (tpl === currentTemplate) {
      card.classList.add('active-template');
    } else {
      card.classList.remove('active-template');
    }
  });
}

// Update CV watermark visibility
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

// Update membership expiry display
function updateMembershipExpiryUI() {
  const expiryMessageEl = document.getElementById('membership-expiry-message');
  if (!expiryMessageEl) {
    console.warn("[updateMembershipExpiryUI] Target element #membership-expiry-message not found.");
    return;
  }

  const proExpiryDateString = localStorage.getItem('proExpiryDate');
  console.log(`[updateMembershipExpiryUI] proExpiryDateString from localStorage: ${proExpiryDateString}`);

  if (!isPro || !proExpiryDateString || proExpiryDateString === 'null') {
    expiryMessageEl.style.display = 'none';
    expiryMessageEl.innerHTML = '';
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
    const totalDaysLeft = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));

    const years = Math.floor(totalDaysLeft / 365);
    let remainingDays = totalDaysLeft % 365;

    const months = Math.floor(remainingDays / 30.44);
    remainingDays = Math.floor(remainingDays % 30.44);

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
    } else {
        message = `Your Pro membership has ${parts[0]}, ${parts[1]}, and ${parts[2]} remaining.`;
    }
  }

  expiryMessageEl.style.display = 'block';
  expiryMessageEl.innerHTML = message;
  console.log(`[updateMembershipExpiryUI] Displayed message: "${message}"`);
}

// Main function to refresh all Pro-gated UI
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

  styleTemplateCardsUI();

  const activeTemplateCard = document.querySelector('.template-card.active-template');
  const currentTemplateName = activeTemplateCard ? activeTemplateCard.dataset.template : '';
  updateWatermarkUI(currentTemplateName);

  unlockAIButtons(); // Call the AI button unlock function (now more selective)
  updateMembershipExpiryUI(); // Call the membership expiry function
}

// Check Pro status from backend
async function checkProStatus() {
  let email = localStorage.getItem('userEmail');
  let emailSource = 'localStorage';

  const params = new URLSearchParams(window.location.search);
  const emailFromUrl = params.get('email');

  if (emailFromUrl && emailFromUrl !== 'null' && emailFromUrl.includes('@')) {
    console.log(`👤 [checkProStatus] Email from URL: ${emailFromUrl}`);
    email = decodeURIComponent(emailFromUrl);
    emailSource = 'URL parameter';
    localStorage.setItem('userEmail', email);
    if (window.history.replaceState) {
      const cleanURL = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanURL);
      console.log("[checkProStatus] Cleaned email from URL.");
    }
  }

  if (!email) {
    console.error("❌ [checkProStatus] No email found.");
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
      localStorage.removeItem('proExpiryDate');
      return;
    }

    const result = await response.json();
    if (result && typeof result.isPro === 'boolean') {
      isPro = result.isPro;

      if (isPro && result.pro_expiry) {
        localStorage.setItem('proExpiryDate', result.pro_expiry);
        console.log(`[checkProStatus] Stored proExpiryDate in localStorage: ${result.pro_expiry}`);
      } else {
        localStorage.removeItem('proExpiryDate');
        console.log("[checkProStatus] Not Pro or no pro_expiry received. Cleared proExpiryDate.");
      }

      const toastEl = document.getElementById('pro-toast');

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
      localStorage.removeItem('proExpiryDate');
    }
  } catch (err) {
    console.error(`❌ [checkProStatus] Network error: ${err.message}`);
    isPro = false;
    localStorage.removeItem('proExpiryDate');
  }
}

let currentTemplate = 'tech';

function switchTemplate(templateName) {
  if (premiumTemplates.includes(templateName) && !isPro) {
    alert("✨ Upgrade to Pro to use this template.");
    return;
  }

  currentTemplate = templateName;

  const preview = document.getElementById('cv-preview');
  if (!preview) return;

  preview.className = 'preview-section card';
  preview.classList.add(`template-${templateName}`);

  styleTemplateCardsUI();
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
  document.getElementById('linkedin').value = 'https://www.linkedin.com/in/sarahthompson'; // KEPT LinkedIn autofill
  document.getElementById('portfolio').value = 'https://sarahcodes.dev';
  document.getElementById('summary').value = `Experienced developer with 8+ years in full-stack development, leading teams and delivering scalable solutions. Passionate about clean code, mentorship, and continuous learning.`;
  document.getElementById('work').value = `Senior Engineer at TechCorp (2020–Present):\n- Led migration to microservices.\n- Mentored 4 junior developers.\n\nSoftware Engineer at DevSoft (2016–2020):\n- Built core features for e-commerce platform.`;
  document.getElementById('education').value = `B.Sc. in Computer Science – University of Limerick (2012–2016)`;
  document.getElementById('projects').value = `Open Source: Contributed to Vue.js\nFreelance: Built portfolio sites for 12 clients`;
  document.getElementById('certifications').value = `AWS Certified Solutions Architect\nScrum Master Certification`;
  document.getElementById('languages').value = `English (Fluent), German (Basic)`;
  document.getElementById('skills').value = `JavaScript HTML CSS React Node.js MongoDB Git Docker`; // KEPT skills autofill
  document.getElementById('hobbies').value = `Hiking, Photography, Blogging`;

  // Autofill Cover Letter fields
  document.getElementById('targetCompany').value = 'AI Solutions Inc.';
  document.getElementById('jobDescription').value = `Seeking a highly motivated and experienced Software Engineer to join our innovative team. Responsibilities include full-stack development, cloud architecture, and mentoring junior staff.`;

  const cvForm = document.getElementById('cv-form');
  if (cvForm) cvForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

// --- DOMContentLoaded: Main Initialization and Event Listener Setup ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log("🚀 DOM fully loaded and parsed. Initializing main page.");

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
  'name', 'jobTitle', 'email', 'phone', 'linkedin',
  'portfolio', 'summary', 'work', 'projects', 'education', 'certifications',
  'languages', 'skills', 'hobbies',
  'targetCompany', 'jobDescription', 'generatedCoverLetter'
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

  await checkProStatus();
  refreshAllProUI();

const confirmedEmail = localStorage.getItem('userEmail');
if (!confirmedEmail || confirmedEmail === 'null') {
  console.warn('No confirmed email found. Redirecting...');
  alert('Not logged in. Redirecting to login page.');
  window.location.href = 'login.html';
  return;
}

// --- AI Button Listeners and Logic (UPDATED SECTION) ---
// Get AI button elements by their unique IDs
const generateSummaryButton = document.getElementById('generate-summary-button');
const generateWorkExperienceButton = document.getElementById('generate-work-experience-button');
const generateCoverLetterButton = document.getElementById('generate-cover-letter-button');

// Get input fields for AI generation context
const jobTitleInput = document.getElementById('jobTitle');
const summaryTextarea = document.getElementById('summary');
const workExperienceTextarea = document.getElementById('work');
const skillsTextarea = document.getElementById('skills'); // KEPT for manual input and potential context

// Add cover letter specific input/output elements
const targetCompanyInput = document.getElementById('targetCompany');
const jobDescriptionTextarea = document.getElementById('jobDescription');
const generatedCoverLetterTextarea = document.getElementById('generatedCoverLetter');


// Function to call AI backend
async function callAIGenerate(prompt, targetTextarea) {
  if (!isPro) { // isPro is a global variable updated by checkProStatus
    alert('This AI feature is only available to Pro users. Upgrade to unlock.');
    return;
  }

  targetTextarea.value = "Generating content with AI...";
  targetTextarea.disabled = true;
  targetTextarea.style.opacity = 0.5;

  try {
    const response = await fetch('http://localhost:3000/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Backend AI Error: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }

    const data = await response.json();
    if (data && data.result) {
      targetTextarea.value = data.result;
    } else {
      targetTextarea.value = "AI generation failed: No result received.";
    }

  } catch (error) {
    console.error("Error calling AI backend:", error);
    targetTextarea.value = `Error: ${error.message}`;
  } finally {
    targetTextarea.disabled = false;
    targetTextarea.style.opacity = 1;
  }
}

// --- AI Button Event Listeners (Refined for Summary, Work Exp, Cover Letter) ---

// Generate Summary
if (generateSummaryButton) {
    generateSummaryButton.addEventListener('click', async () => {
        const prompt = `Write a concise and professional summary for a CV based on the following information:
Job Title: ${jobTitleInput.value || 'N/A'}
Work Experience Highlights: ${workExperienceTextarea.value || 'N/A'}
Skills: ${skillsTextarea.value || 'N/A'}
Keep it under 150 words.`;
        await callAIGenerate(prompt, summaryTextarea);
    });
} else {
    console.warn("Generate Summary button not found. Ensure its ID is 'generate-summary-button'.");
}

// Generate Work Experience
if (generateWorkExperienceButton) {
    generateWorkExperienceButton.addEventListener('click', async () => {
        const currentWorkText = workExperienceTextarea.value;
        const jobTitle = jobTitleInput.value;
        const skills = skillsTextarea.value; // Get skills for context

        let prompt;
        if (currentWorkText.trim()) {
            prompt = `Rewrite the following work experience for a CV. For each entry, format it as:
            "Job Title at Company Name (Years - Years):
            - [Bullet point 1 focused on achievement]
            - [Bullet point 2 focused on achievement]
            - [Bullet point 3 focused on achievement]"
            
            Focus on achievements and quantifiable results. Ensure Company Name and Years are included as specified if extractable from the text.
            User's Job Title: ${jobTitle || 'N/A'}
            Relevant Skills: ${skills || 'N/A'}
            Existing Work Experience:
            ${currentWorkText}`;
        } else {
            prompt = `Generate a few work experience entries for a CV. For each entry, format it as:
            "Job Title at Company Name (Start Year - End Year):
            - [Bullet point 1 focused on achievement]
            - [Bullet point 2 focused on achievement]
            - [Bullet point 3 focused on achievement]"

            Generate entries for a ${jobTitle || 'general professional'} role. Include realistic company names and years. Focus on achievements and quantifiable results.
            Relevant Skills: ${skills || 'N/A'}`;
        }
        await callAIGenerate(prompt, workExperienceTextarea);
    });
} else {
    console.warn("Generate Work Experience button not found. Ensure its ID is 'generate-work-experience-button'.");
}

// Generate Cover Letter
if (generateCoverLetterButton) {
    generateCoverLetterButton.addEventListener('click', async () => {
        const companyName = targetCompanyInput.value;
        const jobDesc = jobDescriptionTextarea.value;
        const skills = skillsTextarea.value; // Get skills for context

        if (!companyName.trim() || !jobDesc.trim()) {
            alert('Please enter the Target Company Name and paste the Job Description to generate a cover letter.');
            return;
        }

        const prompt = `Write a professional and concise cover letter for the position of ${jobTitleInput.value || 'a candidate'} at ${companyName}.
        Highlight how the following experiences and skills align with the provided job description.
        CV Summary: ${summaryTextarea.value || 'N/A'}
        Work Experience Highlights: ${workExperienceTextarea.value || 'N/A'}
        Key Skills: ${skills || 'N/A'}
        
        Job Description:
        ${jobDesc}
        
        Keep it to one page, addressing the company directly. Start with "Dear Hiring Manager,".`;

        await callAIGenerate(prompt, generatedCoverLetterTextarea);
    });
} else {
    console.warn("Generate Cover Letter button not found. Ensure its ID is 'generate-cover-letter-button'.");
}

// REMOVED: Generate Projects button listener and logic
// REMOVED: Generate Skills button listener and logic


// Restore saved CV data
const savedCV = JSON.parse(localStorage.getItem('cvData'));
if (savedCV) {
  for (const [key, value] of Object.entries(savedCV)) {
    const field = document.getElementById(key);
    if (field) field.value = value;
  }
  document.getElementById('cv-form')?.dispatchEvent(new Event('submit'));
}

// Initial AI button state setup
// The unlockAIButtons() function will be called by refreshAllProUI()
// based on the isPro status retrieved by checkProStatus().

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

// Accent Color Picker Setup
const accentPicker = document.getElementById('accent-picker');

if (accentPicker) {
  const defaultAccent = '#007bff';
  const savedAccent = localStorage.getItem('accentColor') || defaultAccent;

  document.documentElement.style.setProperty('--accent', savedAccent); // Corrected: use savedAccent here
  accentPicker.value = savedAccent;

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
  window.location.href = "login.html";
});

document.getElementById("buy-pro-btn")?.addEventListener("click", () => {
  startCheckout();
});

// REMOVED: All LinkedIn import button logic and event listener
/*
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
*/

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
      // Use the linkedin input value directly for preview
      const linkedinUrl = document.getElementById('linkedin')?.value || ''; // KEPT this
      const portfolioUrl = document.getElementById('portfolio')?.value || '';
      const linksEl = document.getElementById('preview-links');
      if (linksEl) {
          const linksHtml = [];
          if (linkedinUrl) linksHtml.push(`<a href="${linkedinUrl}" target="_blank">LinkedIn</a>`); // KEPT this
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
      if (hobbiesEl) hobbies.textContent = document.getElementById('hobbies')?.value || '';
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
    if (!defaultTemplateButton.classList.contains('locked-template')) {
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

  console.log("🏁 Main page initialization complete.");

// Global Event Listeners (pageshow, visibilitychange)
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

// Final closing of DOMContentLoaded and script.js logging
});
console.log("Script.js finished initial execution pass.");