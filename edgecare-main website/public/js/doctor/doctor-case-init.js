// Doctor case page initializer (CSP-safe)
(function(){
  const caseId = Number(new URLSearchParams(window.location.search).get("id"));
  const errorBanner = document.getElementById("chat-error") || document.createElement("div");

  function setError(msg){
    if (!errorBanner) return;
    if (!msg){
      errorBanner.style.display = "none";
      errorBanner.textContent = "";
      return;
    }
    errorBanner.style.display = "block";
    errorBanner.textContent = msg;
  }

  function initChat(currentUser){
    if (!caseId){
      setError("Missing case id in URL");
      return;
    }
    EdgeCareChat.init({ caseId, token: getAccessToken(), currentUser });
  }

  async function loadMeAndInit(){
    try{
      const meResp = await apiFetch("/users/me", { method:"GET" });
      initChat(meResp?.data);
    }catch(e){
      setError(e?.message || "Unable to load user");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadMeAndInit();
    const logoutBtn = document.getElementById("logoutBtn");
    logoutBtn?.addEventListener("click", () => logout("/doctor-login.html?role=DOCTOR"));
  });
})();