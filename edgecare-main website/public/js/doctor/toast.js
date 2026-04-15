(function initToast(){
  const wrap = document.createElement("div");
  wrap.className = "toast-wrap";
  document.body.appendChild(wrap);

  function addToast(type, title, message, ms=2600){
    const el = document.createElement("div");
    el.className = `toast ${type}`;

    el.innerHTML = `
      <div class="dot"></div>
      <div class="content">
        <p class="title">${escapeHtml(title)}</p>
        <p class="msg">${escapeHtml(message)}</p>
      </div>
      <button class="x" aria-label="Close">✕</button>
    `;

    const kill = () => {
      el.style.opacity = "0";
      el.style.transform = "translateY(-4px)";
      el.style.transition = "opacity 140ms ease, transform 140ms ease";
      setTimeout(() => el.remove(), 160);
    };

    el.querySelector(".x").addEventListener("click", kill);
    wrap.appendChild(el);

    if (ms && ms > 0) setTimeout(kill, ms);
    return el;
  }

  window.toast = {
    success: (msg, title="Success") => addToast("success", title, msg),
    error: (msg, title="Error") => addToast("error", title, msg, 4200),
    info: (msg, title="Info") => addToast("info", title, msg, 2800),
    warn: (msg, title="Warning") => addToast("info", title, msg, 3200),
  };

  function escapeHtml(str){
    return String(str ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
})();
