const loginBtn = document.getElementById("loginBtn");
const API_ROOT = window.EDGECARE_API_ROOT || "/api/v1";

loginBtn.addEventListener("click", async () => {
  if (loginBtn.disabled) return;
  const defaultText = loginBtn.textContent;
  loginBtn.disabled = true;
  loginBtn.textContent = "Logging in...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    toast.error("Email and password required");
    loginBtn.disabled = false;
    loginBtn.textContent = defaultText;
    return;
  }

  try {
    toast.info("Logging in...");
    const res = await fetch(`${API_ROOT}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role: "ADMIN" }),
    });

    const data = await res.json();
    if (!res.ok) throw data;

    localStorage.setItem("accessToken", data.data.accessToken);
    localStorage.setItem("refreshToken", data.data.refreshToken);
    localStorage.setItem("role", "ADMIN");

    toast.success("Welcome Admin");
    window.location.href = "/admin/dashboard.html";
  } catch (e) {
    toast.error(e?.message || "Login failed");
    loginBtn.disabled = false;
    loginBtn.textContent = defaultText;
  }
});
