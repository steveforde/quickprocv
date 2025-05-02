// Updated auth.js content
document.addEventListener('DOMContentLoaded', async () => {
  const currentPage = window.location.pathname.split("/").pop();
  const publicPages = ["login.html", "register.html", "landing.html", ""];

  // Protect private pages
  if (!publicPages.includes(currentPage)) {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session?.user) {
      alert("Please log in to access QuickProCV.");
      window.location.href = "login.html";
      return;
    }

    const welcome = document.getElementById("welcome-msg");
    if (welcome) {
      welcome.textContent = `Welcome, ${session.user.email}`;
    }
  }

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const { error } = await supabase.auth.signOut();
      if (error) {
        alert("Logout failed.");
        console.error(error.message);
      } else {
        window.location.href = "login.html";
      }
    });
  }
});
