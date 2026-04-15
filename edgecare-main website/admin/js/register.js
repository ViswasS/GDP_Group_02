
const registerBtn = document.getElementById("registerBtn");
const goLoginBtn = document.getElementById("goLoginBtn");
const out = document.getElementById("out");
const API_ROOT = window.EDGECARE_API_ROOT || "/api/v1";

function show(obj){
    out.style.display = "block";
    out.textContent =
    typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

goLoginBtn.addEventListener("click", () => {
    window.location.href = "/admin/index.html";
});

registerBtn.addEventListener("click", async () => {
    if (registerBtn.disabled) return;
    const defaultText = registerBtn.textContent;
    registerBtn.disabled = true;
    registerBtn.textContent = "Registering...";

    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const adminLevel =
    document.getElementById("adminLevel").value.trim() || "Data Admin";

    if (!firstName || !lastName || !email || !password) {
    toast.error("First name, last name, email and password are required.");
    registerBtn.disabled = false;
    registerBtn.textContent = defaultText;
    return;
    }

    try {
    toast.info("Creating admin account...");
    const res = await fetch(`${API_ROOT}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        email,
        password,
        role: "ADMIN",
        profile: { firstName, lastName, adminLevel },
        }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw data;

    show(data);
    toast.success("Admin registered successfully. Please login.");
    } catch (e) {
    show(e);
    toast.error(e?.message || "Admin registration failed");
    registerBtn.disabled = false;
    registerBtn.textContent = defaultText;
    }
});
