import { deriveEnvironmentGuidance, deriveVisibleFollowUpGroups } from "./questionnaire-config.js";

requirePatientAuth();
const config = {
  apiBase: window.EDGECARE_API_BASE,
  mlBase: window.EDGECARE_ML_BASE,
  cloudinary: window.CLOUDINARY_CONFIG || {
    cloudName: window.CLOUDINARY_CLOUD_NAME || "dyhnozulq",
    uploadPreset: window.CLOUDINARY_UPLOAD_PRESET || "edgecare_unsigned",
  },
};

const form = document.getElementById("caseForm");
const titleEl = document.getElementById("title");
const durationEl = document.getElementById("duration");
const durationLabelEl = document.getElementById("durationLabel");
const rashLocationEl = document.getElementById("rashLocation");
const medicationsEl = document.getElementById("medications");
const descriptionEl = document.getElementById("description");
const triggersEl = document.getElementById("triggers");
const isEmergencyEl = document.getElementById("isEmergency");
const severityEl = document.getElementById("severity");
const severityValue = document.getElementById("severityValue");
const itchinessEl = document.getElementById("itchiness");
const itchinessValue = document.getElementById("itchinessValue");
const spreadRadios = document.querySelectorAll("input[name='spread']");
const photoInput = document.getElementById("photos");
const photoPreview = document.getElementById("photoPreview");
const submitBtn = document.getElementById("submitBtn");
const resetBtn = document.getElementById("resetBtn");
const formError = document.getElementById("formError");
const statusBanner = document.getElementById("statusBanner");
const out = document.getElementById("out");
const meLabel = document.getElementById("meLabel");
const logoutBtn = document.getElementById("logoutBtn");
const followUpSection = document.getElementById("followUpSection");
const followUpQuestions = document.getElementById("followUpQuestions");
const environmentClimateRadios = document.querySelectorAll("input[name='environmentClimate']");
const environmentExposureOptions = document.querySelectorAll("#environmentExposureOptions input[type='checkbox']");
const environmentContextNote = document.getElementById("environmentContextNote");

const state = {
  files: [],
  severityTouched: false,
  itchinessTouched: false,
  lastCaseId: null,
  lastCasePayload: null,
  followUps: {},
};

function selectedSymptomsFromPayload(payload = {}) {
  if (Array.isArray(payload.symptoms)) return payload.symptoms;
  if (Array.isArray(payload.symptoms?.selected)) return payload.symptoms.selected;
  return [];
}

function symptomFollowUpsFromPayload(payload = {}) {
  return payload?.symptoms && typeof payload.symptoms === "object" && !Array.isArray(payload.symptoms)
    ? payload.symptoms.followUps || {}
    : {};
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function setError(msg) {
  if (!formError) return;
  if (!msg) {
    formError.style.display = "none";
    formError.textContent = "";
    return;
  }
  formError.style.display = "block";
  formError.textContent = msg;
  toast?.error?.(msg);
}

function setStatus(msg, variant = "info") {
  if (!statusBanner) return;
  if (!msg) {
    statusBanner.style.display = "none";
    statusBanner.textContent = "";
    statusBanner.classList.remove("error");
    return;
  }
  statusBanner.style.display = "block";
  statusBanner.textContent = msg;
  statusBanner.classList.toggle("error", variant === "error");
}

function showDebug(obj) {
  if (!out) return;
  out.style.display = "block";
  out.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

function patientDisplayName(profile = {}) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  const email = profile.user?.email || "";
  return email ? email.split("@")[0] : "Patient";
}

function setPatientIdentity(profile = {}) {
  if (!meLabel) return;
  meLabel.innerHTML = `
    <span class="user-chip__primary">${escapeHtml(patientDisplayName(profile))}</span>
    <span class="user-chip__role">Patient</span>
  `;
}

async function loadMe() {
  const profile = await apiFetch("/patient/profile", { method: "GET" }, { loginPath: "/patient-login.html" });
  setPatientIdentity(profile?.data || {});
}

async function renderPreviews() {
  if (!photoPreview) return;
  photoPreview.innerHTML = "";
  const previewFiles = state.files.slice(0, 5);
  const dataUrls = await Promise.all(previewFiles.map((f) => fileToDataUrl(f).catch(() => null)));

  dataUrls.forEach((url, idx) => {
    if (!url) return;
    const wrapper = document.createElement("div");
    wrapper.className = "thumb";
    wrapper.innerHTML = `<img src="${url}" alt="preview ${idx + 1}" />
      <button type="button" data-idx="${idx}">Remove</button>`;
    wrapper.querySelector("button").addEventListener("click", () => {
      state.files.splice(idx, 1);
      renderPreviews();
    });
    photoPreview.appendChild(wrapper);
  });
}

function resetForm() {
  form?.reset();
  state.files = [];
  state.severityTouched = false;
  state.itchinessTouched = false;
  state.followUps = {};
  severityValue.textContent = severityEl?.value || "5";
  itchinessValue.textContent = itchinessEl?.value || "5";
  renderPreviews();
  renderEnvironmentGuidance();
  renderFollowUpQuestions();
  setError(null);
  setStatus(null);
}

function collectSelectedSymptoms() {
  const boxes = document.querySelectorAll("#symptomOptions input[type='checkbox']");
  return Array.from(boxes)
    .filter((b) => b.checked)
    .map((b) => b.value);
}

function collectSpreadChoice() {
  const selected = Array.from(spreadRadios).find((r) => r.checked);
  return selected ? selected.value : undefined;
}

function collectEnvironmentClimate() {
  const selected = Array.from(environmentClimateRadios).find((radio) => radio.checked);
  return selected ? selected.value : undefined;
}

function collectEnvironmentalExposures() {
  return Array.from(environmentExposureOptions)
    .filter((box) => box.checked)
    .map((box) => box.value);
}

function currentQuestionnaireState() {
  const durationVal = durationEl.value.trim();
  const parsedDuration = durationVal ? Number(durationVal) : undefined;
  return {
    selectedSymptoms: collectSelectedSymptoms(),
    spreadingStatus: collectSpreadChoice(),
    durationDays: Number.isFinite(parsedDuration) ? parsedDuration : undefined,
    durationLabel: durationLabelEl.value || "",
    isEmergency: Boolean(isEmergencyEl.checked),
    environmentClimate: collectEnvironmentClimate(),
    environmentalExposures: collectEnvironmentalExposures(),
  };
}

function updateFollowUpAnswer(groupId, fieldKey, value) {
  state.followUps[groupId] = {
    ...(state.followUps[groupId] || {}),
    [fieldKey]: value,
  };
}

function fieldValue(groupId, fieldKey) {
  return state.followUps[groupId]?.[fieldKey];
}

function renderChoiceField(group, field) {
  const selectedValue = fieldValue(group.id, field.key);
  return `
    <div class="followup-question">
      <label class="label">${escapeHtml(field.label)}</label>
      <div class="radio-row">
        ${field.options
          .map(
            (option) => `
              <label class="radio-pill">
                <input
                  type="radio"
                  name="followup-${group.id}-${field.key}"
                  data-group="${escapeHtml(group.id)}"
                  data-field="${escapeHtml(field.key)}"
                  value="${escapeHtml(option)}"
                  ${selectedValue === option ? "checked" : ""}
                />
                ${escapeHtml(option)}
              </label>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderBooleanField(group, field) {
  const selectedValue = fieldValue(group.id, field.key);
  return `
    <div class="followup-question">
      <label class="label">${escapeHtml(field.label)}</label>
      <div class="radio-row">
        <label class="radio-pill">
          <input
            type="radio"
            name="followup-${group.id}-${field.key}"
            data-group="${escapeHtml(group.id)}"
            data-field="${escapeHtml(field.key)}"
            value="true"
            ${selectedValue === true ? "checked" : ""}
          />
          ${escapeHtml(field.trueLabel || "Yes")}
        </label>
        <label class="radio-pill">
          <input
            type="radio"
            name="followup-${group.id}-${field.key}"
            data-group="${escapeHtml(group.id)}"
            data-field="${escapeHtml(field.key)}"
            value="false"
            ${selectedValue === false ? "checked" : ""}
          />
          ${escapeHtml(field.falseLabel || "No")}
        </label>
      </div>
    </div>
  `;
}

function renderFollowUpQuestions() {
  if (!followUpQuestions || !followUpSection) return;
  const groups = deriveVisibleFollowUpGroups(currentQuestionnaireState());

  if (!groups.length) {
    followUpSection.style.display = "none";
    followUpQuestions.innerHTML = "";
    return;
  }

  followUpSection.style.display = "block";
  followUpQuestions.innerHTML = groups
    .map((group) => {
      const fieldsMarkup = group.fields
        .map((field) => (field.type === "choice" ? renderChoiceField(group, field) : renderBooleanField(group, field)))
        .join("");

      return `
        <div class="followup-group">
          <h3>${escapeHtml(group.title)}</h3>
          <p>${escapeHtml(group.note)}</p>
          ${fieldsMarkup}
          ${group.alert ? `<div class="followup-alert">${escapeHtml(group.alert)}</div>` : ""}
        </div>
      `;
    })
    .join("");
}

function renderEnvironmentGuidance() {
  if (!environmentContextNote) return;
  const guidance = deriveEnvironmentGuidance(currentQuestionnaireState());
  if (!guidance) {
    environmentContextNote.style.display = "none";
    environmentContextNote.innerHTML = "";
    return;
  }

  environmentContextNote.style.display = "block";
  environmentContextNote.innerHTML = `
    <span class="context-note__eyebrow">${escapeHtml(guidance.eyebrow)}</span>
    <p class="context-note__text">${escapeHtml(guidance.body)}</p>
  `;
}

function collectFollowUpPayload() {
  const activeGroups = deriveVisibleFollowUpGroups(currentQuestionnaireState());
  return activeGroups.reduce((acc, group) => {
    const answers = {};
    group.fields.forEach((field) => {
      const value = fieldValue(group.id, field.key);
      if (value !== undefined) answers[field.key] = value;
    });
    if (Object.keys(answers).length) acc[group.id] = answers;
    return acc;
  }, {});
}

function buildPayload() {
  const title = titleEl.value.trim();
  const durationVal = durationEl.value.trim();
  const durationDaysRaw = durationVal ? Number(durationVal) : undefined;
  const durationDays = Number.isFinite(durationDaysRaw) ? durationDaysRaw : undefined;
  const duration = durationVal ? String(durationVal) : undefined;
  const severityVal = Number(severityEl.value || 5);
  const itchVal = Number(itchinessEl.value || 5);

  const payload = {
    title,
    duration,
    durationDays,
    durationLabel: durationLabelEl.value || undefined,
    rashLocation: rashLocationEl.value || undefined,
    medications: medicationsEl.value.trim() || undefined,
    triggers: triggersEl.value.trim() || undefined,
    description: descriptionEl.value.trim() || undefined,
    isEmergency: Boolean(isEmergencyEl.checked),
    spreadingStatus: collectSpreadChoice(),
    severity: Number.isFinite(severityVal) ? severityVal : undefined,
    itchiness: Number.isFinite(itchVal) ? itchVal : undefined,
  };

  const selectedSymptoms = collectSelectedSymptoms();
  const followUps = collectFollowUpPayload();
  const additionalNotes = descriptionEl.value.trim() || undefined;
  const environmentClimate = collectEnvironmentClimate();
  const environmentalExposures = collectEnvironmentalExposures();
  const environmentContext =
    environmentClimate || environmentalExposures.length
      ? {
          ...(environmentClimate ? { climate: environmentClimate } : {}),
          ...(environmentalExposures.length ? { exposures: environmentalExposures } : {}),
        }
      : undefined;

  if (selectedSymptoms.length || Object.keys(followUps).length || additionalNotes || environmentContext) {
    payload.symptoms = {
      selected: selectedSymptoms,
      followUps: Object.keys(followUps).length ? followUps : undefined,
      additionalNotes,
      environmentContext,
    };
  }

  if (!state.severityTouched && payload.severity === undefined) payload.severity = 5;
  if (!state.itchinessTouched && payload.itchiness === undefined) payload.itchiness = 5;

  return payload;
}

async function uploadToCloudinary(files) {
  const uploaded = [];
  const failures = [];
  if (!files?.length) return { uploaded, failures };

  if (!config.cloudinary.cloudName || !config.cloudinary.uploadPreset) {
    failures.push("Cloudinary config missing");
    return { uploaded, failures };
  }

  await Promise.all(
    files.map(async (file, idx) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", config.cloudinary.uploadPreset);

      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/image/upload`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Upload failed for image ${idx + 1}`);
        if (data.secure_url) uploaded.push(data.secure_url);
        else failures.push(`Upload missing url for image ${idx + 1}`);
      } catch (e) {
        console.error("Cloudinary upload error", e);
        failures.push(e.message || `Upload error for image ${idx + 1}`);
      }
    })
  );

  return { uploaded, failures };
}

async function saveImageUrls(caseId, imageUrls) {
  if (!imageUrls?.length) return;
  await apiFetch(
    `/cases/${caseId}/images`,
    { method: "POST", body: JSON.stringify({ imageUrls }) },
    { loginPath: "/patient-login.html" }
  );
}

async function analyzeImage(firstFile, mlHeaders) {
  if (!firstFile) return { data: null };
  const fd = new FormData();
  fd.append("file", firstFile);
  try {
    const res = await fetch(`${config.mlBase}/ml/analyze-image`, {
      method: "POST",
      headers: mlHeaders,
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Image analysis failed");
    return { data };
  } catch (e) {
    console.error("ML analyze-image failed", e);
    return { error: e.message || "Image analysis failed" };
  }
}

async function analyzeSymptoms(formPayload, mlHeaders) {
  try {
    const selectedSymptoms = selectedSymptomsFromPayload(formPayload);
    const followUps = symptomFollowUpsFromPayload(formPayload);
    const body = {
      itching: selectedSymptoms.includes("Itching"),
      fever: selectedSymptoms.includes("Fever/Chills") || followUps?.urgent?.feverPresent === true,
      pain_level: formPayload.severity ?? 5,
      duration_days: formPayload.durationDays ?? null,
    };
    const res = await fetch(`${config.mlBase}/ml/analyze-symptoms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...mlHeaders },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Symptom analysis failed");
    return { data };
  } catch (e) {
    console.error("ML analyze-symptoms failed", e);
    return { error: e.message || "Symptom analysis failed" };
  }
}

function imageSeverityScore(imageResult) {
  if (!imageResult) return 0.5;
  const cls = String(imageResult.predicted_class || imageResult.label || "").toLowerCase();
  if (cls.includes("severe")) return 1;
  if (cls.includes("moderate")) return 0.5;
  if (cls.includes("mild")) return 0;
  const conf = [imageResult.confidence, imageResult.confidence_score, imageResult.score].find(
    (v) => typeof v === "number" && v >= 0 && v <= 1
  );
  return conf !== undefined ? conf : 0.5;
}

function symptomRiskScore(symResult) {
  const v = symResult?.symptom_risk_score;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return 0.5;
}

async function fuseResults(imageResult, symptomResult, mlHeaders) {
  const payload = {
    image_severity_score: imageSeverityScore(imageResult),
    symptom_risk_score: symptomRiskScore(symptomResult),
  };
  try {
    const res = await fetch(`${config.mlBase}/ml/fuse-results`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...mlHeaders },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Fusion failed");
    return { data };
  } catch (e) {
    console.error("ML fuse-results failed", e);
    return { error: e.message || "Fusion failed" };
  }
}

function buildMlPayload(mlPayload, warnings = []) {
  const body = {};
  ["mlImageResult", "mlSymptomsResult", "mlFusedResult", "mlReport", "mlDebug", "mlStatus", "mlLastError"].forEach((k) => {
    if (mlPayload[k] !== undefined) body[k] = mlPayload[k];
  });
  if (!body.mlStatus) {
    body.mlStatus = warnings.length ? "FAILED" : "COMPLETED";
  }
  if (warnings.length && !body.mlDebug) {
    body.mlDebug = { warnings };
  }
  return body;
}

async function persistMlProgress(caseId, mlPayload, warnings) {
  const body = buildMlPayload(mlPayload, warnings);
  if (!Object.keys(body).length) return;

  await apiFetch(
    `/cases/${caseId}/ml`,
    { method: "POST", body: JSON.stringify(body) },
    { loginPath: "/patient-login.html" }
  );
}

async function runAiPipeline(caseId, payload, mlHeaders, warnings) {
  const result = await window.EdgeCareCaseMl.runAiPipeline({
    caseId,
    files: state.files,
    payload,
    mode: "append",
    onStatus: (message) => setStatus(message),
  });

  result.warnings.forEach((warning) => warnings.push(warning));
  return result;
}

function addRetryButton() {
  if (!statusBanner) return;
  let btn = statusBanner.querySelector("button.retry-ai");
  if (btn) return;
  btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Retry AI review";
  btn.className = "btn retry-ai";
  btn.style.marginLeft = "12px";
  btn.addEventListener("click", retryAiAnalysis);
  statusBanner.appendChild(btn);
}

async function submitCase(evt) {
  evt?.preventDefault?.();
  setError(null);
  setStatus("Creating your case...");

  const payload = buildPayload();
  if (!payload.title) {
    setError("Title is required");
    setStatus(null);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Creating case...";

  const warnings = [];
  let caseId;

  try {
    const res = await apiFetch(
      "/cases",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      { loginPath: "/patient-login.html" }
    );
    caseId = res?.data?.id;
    state.lastCaseId = caseId;
    state.lastCasePayload = payload;
    setStatus("Case created. Starting AI review...");
  } catch (e) {
    const errMsg = e?.payload?.message || e?.message || "Failed to submit case";
    const fieldErrors = e?.payload?.details?.fieldErrors;
    const firstFieldError = fieldErrors ? Object.values(fieldErrors).flat()[0] : null;
    setError(firstFieldError || errMsg);
    showDebug(e?.payload || e);
    submitBtn.disabled = false;
    submitBtn.textContent = "Create case";
    setStatus(null);
    return;
  }

  if (!caseId) {
    setStatus("Case created. Redirecting...");
    toast?.success?.("Case created");
    window.location.href = "/patient-cases.html";
    return;
  }

  const token = getAccessToken();
  const mlHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    await runAiPipeline(caseId, payload, mlHeaders, warnings);
  } catch (e) {
    console.error("AI pipeline crashed", e);
    warnings.push(e.message || "AI analysis failed unexpectedly");
  }

  const warningText = warnings.length ? ` (${warnings.join("; ")})` : "";
  submitBtn.textContent = "Case created";

  if (warnings.length) {
    setStatus(`Case created. AI review is still pending${warningText}. You can retry it here.`, "info");
    toast?.warn?.("Case created. AI review is still pending. You can retry it here.");
    addRetryButton();
    submitBtn.disabled = false;
    return;
  }

  setStatus("Case created and AI review saved. Redirecting...");
  toast?.success?.("Case created and AI review saved");
  setTimeout(() => {
    window.location.href = `/patient-case.html?id=${caseId}`;
  }, 500);
}

async function retryAiAnalysis() {
  setError(null);
  if (!state.lastCaseId) {
    setStatus("Nothing to retry yet. Please submit the case first.", "error");
    return;
  }

  const warnings = [];
  submitBtn.disabled = true;
  submitBtn.textContent = "Retrying AI review...";
  setStatus("Retrying AI review...");

  const token = getAccessToken();
  const mlHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    await runAiPipeline(state.lastCaseId, state.lastCasePayload || buildPayload(), mlHeaders, warnings);
  } catch (e) {
    console.error("Retry AI pipeline failed", e);
    warnings.push(e.message || "Retry failed");
  }

  if (warnings.length) {
    setStatus(`AI review retry is still failing (${warnings.join("; ")}). You can try again.`, "error");
    toast?.warn?.("AI review retry is still failing. You can try again.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Create case";
    return;
  }

  setStatus("AI review saved. You can view your case now.", "info");
  toast?.success?.("AI review saved");
  submitBtn.disabled = false;
  submitBtn.textContent = "Create case";
}

submitBtn?.addEventListener("click", submitCase);
form?.addEventListener("submit", submitCase);
resetBtn?.addEventListener("click", resetForm);

severityEl?.addEventListener("input", () => {
  severityValue.textContent = severityEl.value;
  state.severityTouched = true;
});
itchinessEl?.addEventListener("input", () => {
  itchinessValue.textContent = itchinessEl.value;
  state.itchinessTouched = true;
});
document.querySelectorAll("#symptomOptions input[type='checkbox']").forEach((input) => {
  input.addEventListener("change", renderFollowUpQuestions);
});
spreadRadios.forEach((radio) => radio.addEventListener("change", renderFollowUpQuestions));
durationEl?.addEventListener("input", renderFollowUpQuestions);
durationLabelEl?.addEventListener("change", renderFollowUpQuestions);
isEmergencyEl?.addEventListener("change", renderFollowUpQuestions);
environmentClimateRadios.forEach((radio) =>
  radio.addEventListener("change", () => {
    renderEnvironmentGuidance();
    renderFollowUpQuestions();
  })
);
environmentExposureOptions.forEach((input) =>
  input.addEventListener("change", () => {
    renderEnvironmentGuidance();
    renderFollowUpQuestions();
  })
);
followUpQuestions?.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const groupId = input.dataset.group;
  const fieldKey = input.dataset.field;
  if (!groupId || !fieldKey) return;
  const nextValue = input.value === "true" ? true : input.value === "false" ? false : input.value;
  updateFollowUpAnswer(groupId, fieldKey, nextValue);
});
photoInput?.addEventListener("change", (e) => {
  const files = Array.from(e.target.files || []);
  if (files.length) state.files.push(...files);
  renderPreviews();
});

logoutBtn?.addEventListener("click", () => logout("/patient-login.html?role=PATIENT"));

(async function init() {
  await loadMe();
  severityValue.textContent = severityEl?.value || "5";
  itchinessValue.textContent = itchinessEl?.value || "5";
  renderEnvironmentGuidance();
  renderFollowUpQuestions();
})();
