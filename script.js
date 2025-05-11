const premiumTemplates = ['marketing', 'business', 'classic', 'student', 'temp'];

let isPro = false;

async function checkProStatus() {
  const email = localStorage.getItem('userEmail');
  if (!email) return;

  console.log("👤 Checking Pro status for:", email); // move it here

  try {
    const response = await fetch('http://localhost:3002/api/check-pro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const result = await response.json();
    if (result && result.isPro) {
      isPro = true;
    }
  } catch (err) {
    console.error('Error checking Pro status:', err.message);
  }
}

function updateLinkedInAccess() {
  const linkedinButton = document.getElementById('linkedin-import');
  const lockIcon = linkedinButton?.querySelector('.lock-icon');

  if (!linkedinButton) return;

  if (!isPro) {
    linkedinButton.disabled = true;
    linkedinButton.classList.add('locked');
    linkedinButton.title = "Upgrade to Pro to use LinkedIn import";
    if (lockIcon) lockIcon.style.display = 'inline';
  } else {
    linkedinButton.disabled = false;
    linkedinButton.classList.remove('locked');
    linkedinButton.title = "Import from LinkedIn";
    if (lockIcon) lockIcon.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await checkProStatus();
  updateLinkedInAccess();
  styleTemplateCardsBasedOnProStatus();

  const welcomeMsg = document.getElementById('welcome-msg');
  const storedEmail = localStorage.getItem('userEmail');
  if (storedEmail && welcomeMsg) {
    welcomeMsg.textContent = `Welcome, ${storedEmail}!`;
  }

  const themeToggle = document.getElementById('theme-toggle');
  const html = document.documentElement;
  const savedTheme = localStorage.getItem('theme') || 'light';
  html.dataset.theme = savedTheme;
  themeToggle.textContent = savedTheme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';

  themeToggle.addEventListener('click', () => {
    const currentTheme = html.dataset.theme;
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.dataset.theme = newTheme;
    localStorage.setItem('theme', newTheme);
    themeToggle.textContent = newTheme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
  });

  initializeTemplateCards();
});

if (window.location.pathname.includes('success.html')) {
  // Re-check and update the UI
  checkProStatus().then(() => {
    updateLinkedInAccess();
    styleTemplateCardsBasedOnProStatus();
    console.log('🏁 Success page logic executed');
  });
}


function switchTemplate(templateName) {
  const preview = document.getElementById('cv-preview');
  if (premiumTemplates.includes(templateName) && !isPro) {
    alert("✨ Upgrade to Pro to use this template.");
    return;
  }

  preview.className = 'preview-section card';
  preview.classList.add(`template-${templateName}`);

  const currentAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  document.querySelectorAll('#cv-preview h3').forEach(h3 => {
    h3.style.color = currentAccent;
  });

  const previewName = document.getElementById('preview-name');
  if (previewName) previewName.style.color = currentAccent;

  document.querySelectorAll('.template-card').forEach(btn => {
    btn.classList.remove('active-template');
  });
  const selectedBtn = document.querySelector(`.template-card[data-template="${templateName}"]`);
  if (selectedBtn) selectedBtn.classList.add('active-template');

  updateWatermark(templateName);
}

function convertToBullets(text) {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) return '';
  return `<ul>${lines.map(line => `<li>${line.trim()}</li>`).join('')}</ul>`;
}

function updateWatermark(templateName) {
  const watermark = document.getElementById('cv-watermark');
  if (!isPro && templateName === 'tech') {
    watermark.style.display = 'block';
    watermark.style.opacity = '0.4';
  } else {
    watermark.style.display = 'none';
  }
}

function startCheckout() {
  const email = localStorage.getItem('userEmail');
  if (!email) {
    alert("Please log in first.");
    return;
  }

  fetch('http://localhost:3000/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
  .then(res => res.json())
  .then(data => {
    if (data.url) window.location.href = data.url;
  });
}

const welcomeMsg = document.getElementById('welcome-msg');
const storedEmail = localStorage.getItem('userEmail');
if (storedEmail && welcomeMsg) {
  welcomeMsg.textContent = `Welcome, ${storedEmail}!`;
}

document.getElementById('cv-form').addEventListener('submit', (e) => {
  e.preventDefault();

  document.getElementById('preview-name').textContent = document.getElementById('name').value;
  document.getElementById('preview-title').textContent = document.getElementById('jobTitle').value;
  document.getElementById('preview-contact').textContent =
    `${document.getElementById('email').value} | ${document.getElementById('phone').value}`;

  const linkedin = document.getElementById('linkedin').value;
  const portfolio = document.getElementById('portfolio').value;
  document.getElementById('preview-links').innerHTML =
    `<a href="${linkedin}" target="_blank">LinkedIn</a> | <a href="${portfolio}" target="_blank">Portfolio</a>`;

  document.getElementById('preview-summary').textContent = document.getElementById('summary').value;
  document.getElementById('preview-work').innerHTML = convertToBullets(document.getElementById('work').value);
  document.getElementById('preview-projects').innerHTML = convertToBullets(document.getElementById('projects').value);
  document.getElementById('preview-education').textContent = document.getElementById('education').value;
  document.getElementById('preview-certifications').textContent = document.getElementById('certifications').value;
  document.getElementById('preview-languages').textContent = document.getElementById('languages').value;
  document.getElementById('preview-hobbies').textContent = document.getElementById('hobbies').value;

  const skills = document.getElementById('skills').value.split(/\s+/);
  document.getElementById('preview-skills').innerHTML =
    skills.map(skill => `<span>${skill}</span>`).join('');
});

document.getElementById('download-pdf').addEventListener('click', async () => {
  const preview = document.getElementById('cv-preview');
  const userName = document.getElementById('name').value.trim() || 'QuickProCV';

  const watermark = document.getElementById('cv-watermark');
  const button = document.getElementById('download-pdf');
  watermark.style.display = 'none';
  button.style.display = 'none';

  await new Promise(r => setTimeout(r, 100));

  const canvas = await html2canvas(preview, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff"
  });

  const imgData = canvas.toDataURL('image/jpeg', 1.0);
  const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = canvas.height * imgWidth / canvas.width;

  if (imgHeight <= pageHeight) {
    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
  } else {
    let remainingHeight = imgHeight;
    let page = 0;

    while (remainingHeight > 0) {
      const sourceY = page * pageHeight * canvas.width / pageWidth;
      const section = document.createElement('canvas');
      section.width = canvas.width;
      section.height = Math.min(canvas.height - sourceY, canvas.width * pageHeight / pageWidth);
      const context = section.getContext('2d');

      context.drawImage(
        canvas,
        0, sourceY, section.width, section.height,
        0, 0, section.width, section.height
      );

      const sectionImgData = section.toDataURL('image/jpeg', 1.0);
      if (page > 0) pdf.addPage();
      pdf.addImage(sectionImgData, 'JPEG', 0, 0, imgWidth, imgWidth * section.height / section.width);

      remainingHeight -= pageHeight;
      page++;
    }
  }

  pdf.save(`${userName}_CV.pdf`);

  button.style.display = 'block';
  if (!isPro && preview.classList.contains('template-tech')) {
    watermark.style.display = 'block';
    watermark.style.opacity = '0.4';
  }
});

const photoInput = document.getElementById('photo-upload');
const profilePhoto = document.getElementById('profile-photo');

photoInput.addEventListener('change', function (event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      profilePhoto.src = e.target.result;
      profilePhoto.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
});

const colorPicker = document.getElementById('color-picker');
if (colorPicker) {
  const savedColor = localStorage.getItem('accentColor') || '#007bff';
  document.documentElement.style.setProperty('--accent', savedColor);
  colorPicker.value = savedColor;

  colorPicker.addEventListener('input', (e) => {
    const newColor = e.target.value;
    document.documentElement.style.setProperty('--accent', newColor);
    localStorage.setItem('accentColor', newColor);
    document.querySelectorAll('#cv-preview h3').forEach(h3 => h3.style.color = newColor);
    const nameHeader = document.getElementById('preview-name');
    if (nameHeader) nameHeader.style.color = newColor;
  });
}

document.getElementById('linkedin-import').addEventListener('click', async () => {
  const url = document.getElementById('linkedin').value;
  if (!url || !url.includes('linkedin.com')) {
    alert('Please enter a valid LinkedIn profile URL');
    return;
  }

  try {
    const response = await fetch('http://localhost:3001/api/linkedin-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await response.json();

    if (data && data.full_name) {
      document.getElementById('name').value = data.full_name || '';
      document.getElementById('jobTitle').value = data.occupation || '';
      document.getElementById('email').value = data.email || '';
      document.getElementById('summary').value = data.summary || '';
    } else {
      alert('Profile import failed or returned no data.');
    }
  } catch (err) {
    console.error(err);
    alert('Error importing LinkedIn profile.');
  }
});

function autofillTestData() {
  document.getElementById('name').value = 'Sarah Thompson';
  document.getElementById('jobTitle').value = 'Senior Software Engineer';
  document.getElementById('email').value = 'sarah.thompson@example.com';
  document.getElementById('phone').value = '+353 87 123 4567';
  document.getElementById('linkedin').value = 'https://www.linkedin.com/in/sarahthompson';
  document.getElementById('portfolio').value = 'https://sarahcodes.dev';
  document.getElementById('summary').value = `Experienced developer with 8+ years in full-stack development, leading teams and delivering scalable solutions. Passionate about clean code, mentorship, and continuous learning.`;
  document.getElementById('work').value = `Senior Engineer at TechCorp (2020–Present):\n- Led migration to microservices.\n- Mentored 4 junior developers.\nSoftware Engineer at DevSoft (2016–2020):\n- Built core features for e-commerce platform.`;
  document.getElementById('education').value = `B.Sc. in Computer Science – University of Limerick (2012–2016)`;
  document.getElementById('projects').value = `Open Source: Contributed to Vue.js\nFreelance: Built portfolio sites for 12 clients`;
  document.getElementById('certifications').value = `AWS Certified Solutions Architect\nScrum Master Certification`;
  document.getElementById('languages').value = `English (Fluent), German (Basic)`;
  document.getElementById('skills').value = `JavaScript HTML CSS React Node.js MongoDB Git Docker`;
  document.getElementById('hobbies').value = `Hiking, Photography, Blogging`;
}

document.addEventListener('DOMContentLoaded', () => {
  const autofillBtn = document.getElementById('autofill-btn');
  if (autofillBtn) {
    autofillBtn.addEventListener('click', autofillTestData);
  }
});
