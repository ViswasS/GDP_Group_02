(function () {
  function stripTrailingSlash(value = "") {
    return String(value).replace(/\/$/, "");
  }

  function selectedSymptoms(payload = {}) {
    if (Array.isArray(payload?.symptoms)) return payload.symptoms;
    if (Array.isArray(payload?.symptoms?.selected)) return payload.symptoms.selected;
    return [];
  }

  function symptomFollowUps(payload = {}) {
    return payload?.symptoms && typeof payload.symptoms === "object" && !Array.isArray(payload.symptoms)
      ? payload.symptoms.followUps || {}
      : {};
  }

  function getConfig() {
    return {
      apiBase: window.EDGECARE_API_BASE,
      mlBase: window.EDGECARE_ML_BASE,
      cloudinary: window.CLOUDINARY_CONFIG || {
        cloudName: window.CLOUDINARY_CLOUD_NAME || "dyhnozulq",
        uploadPreset: window.CLOUDINARY_UPLOAD_PRESET || "edgecare_unsigned",
      },
    };
  }

  async function uploadToCloudinary(files = [], config) {
    const uploaded = [];
    const failures = [];
    if (!files.length) return { uploaded, failures };

    const cloudName = config?.cloudinary?.cloudName;
    const uploadPreset = config?.cloudinary?.uploadPreset;
    if (!cloudName || !uploadPreset) {
      failures.push("Cloudinary config missing");
      return { uploaded, failures };
    }

    await Promise.all(
      files.map(async (file, idx) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", uploadPreset);

        try {
          const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error?.message || `Upload failed for image ${idx + 1}`);
          if (data?.secure_url) uploaded.push(data.secure_url);
          else failures.push(`Upload missing url for image ${idx + 1}`);
        } catch (error) {
          failures.push(error?.message || `Upload error for image ${idx + 1}`);
        }
      })
    );

    return { uploaded, failures };
  }

  async function analyzeImage(firstFile, mlBase, mlHeaders) {
    if (!firstFile) return { data: null };
    const formData = new FormData();
    formData.append("file", firstFile);

    try {
      const res = await fetch(`${stripTrailingSlash(mlBase)}/ml/analyze-image`, {
        method: "POST",
        headers: mlHeaders,
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Image analysis failed");
      return { data };
    } catch (error) {
      return { error: error?.message || "Image analysis failed" };
    }
  }

  async function analyzeSymptoms(payload = {}, mlBase, mlHeaders) {
    const selected = selectedSymptoms(payload);
    const followUps = symptomFollowUps(payload);
    const body = {
      itching: selected.includes("Itching"),
      fever: selected.includes("Fever/Chills") || followUps?.urgent?.feverPresent === true,
      pain_level: payload.severity ?? 5,
      duration_days: payload.durationDays ?? null,
    };

    try {
      const res = await fetch(`${stripTrailingSlash(mlBase)}/ml/analyze-symptoms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...mlHeaders },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Symptom analysis failed");
      return { data };
    } catch (error) {
      return { error: error?.message || "Symptom analysis failed" };
    }
  }

  function imageSeverityScore(imageResult) {
    if (!imageResult) return 0.5;
    const label = String(imageResult.predicted_class || imageResult.label || "").toLowerCase();
    if (label.includes("severe")) return 1;
    if (label.includes("moderate")) return 0.5;
    if (label.includes("mild")) return 0;
    const confidence = [imageResult.confidence, imageResult.confidence_score, imageResult.score].find(
      (value) => typeof value === "number" && value >= 0 && value <= 1
    );
    return confidence !== undefined ? confidence : 0.5;
  }

  function symptomRiskScore(symptomResult) {
    const value = symptomResult?.symptom_risk_score;
    return typeof value === "number" && Number.isFinite(value) ? value : 0.5;
  }

  async function fuseResults(imageResult, symptomResult, mlBase, mlHeaders) {
    const body = {
      image_severity_score: imageSeverityScore(imageResult),
      symptom_risk_score: symptomRiskScore(symptomResult),
    };

    try {
      const res = await fetch(`${stripTrailingSlash(mlBase)}/ml/fuse-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...mlHeaders },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Fusion failed");
      return { data };
    } catch (error) {
      return { error: error?.message || "Fusion failed" };
    }
  }

  function buildMlRequestBody(mlPayload = {}, warnings = []) {
    const body = {};
    ["mlImageResult", "mlSymptomsResult", "mlFusedResult", "mlReport", "mlDebug", "mlStatus", "mlLastError"].forEach((key) => {
      if (mlPayload[key] !== undefined) body[key] = mlPayload[key];
    });
    if (!body.mlStatus) {
      body.mlStatus = warnings.length ? "FAILED" : "COMPLETED";
    }
    if (warnings.length && !body.mlDebug) {
      body.mlDebug = { warnings };
    }
    if (warnings.length && !body.mlLastError) {
      body.mlLastError = warnings.join("; ");
    }
    return body;
  }

  function deriveDurationDays(caseLike = {}) {
    const raw = caseLike.durationDays ?? caseLike.duration ?? caseLike?.intake?.duration ?? null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function buildPayloadFromCase(caseData = {}) {
    return {
      title: caseData?.intake?.title || `Case #${caseData.id || ""}`.trim(),
      duration: caseData?.intake?.duration || undefined,
      durationDays: deriveDurationDays(caseData),
      durationLabel: caseData?.durationLabel || undefined,
      medications: caseData?.intake?.medications || undefined,
      isEmergency: Boolean(caseData?.isEmergency),
      rashLocation: caseData?.rashLocation || undefined,
      symptoms: caseData?.symptoms ?? undefined,
      severity: caseData?.severity ?? undefined,
      itchiness: caseData?.itchiness ?? undefined,
      spreadingStatus: caseData?.spreadingStatus || undefined,
      triggers: caseData?.triggers || undefined,
    };
  }

  async function persistMlProgress(caseId, mlPayload, warnings = []) {
    const body = buildMlRequestBody(mlPayload, warnings);
    if (!Object.keys(body).length) return null;
    return apiFetch(`/cases/${caseId}/ml`, {
      method: "POST",
      body: JSON.stringify(body),
    }, { loginPath: "/patient-login.html" });
  }

  async function saveCaseImages(caseId, imageUrls, mode) {
    const path = mode === "replace" ? `/cases/${caseId}/reupload-image` : `/cases/${caseId}/images`;
    return apiFetch(path, {
      method: "POST",
      body: JSON.stringify({ imageUrls }),
    }, { loginPath: "/patient-login.html" });
  }

  async function runAiPipeline({
    caseId,
    files = [],
    payload = {},
    mode = "append",
    onStatus = () => {},
  }) {
    const config = getConfig();
    const warnings = [];
    const token = typeof getAccessToken === "function" ? getAccessToken() : null;
    const mlHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    let mlImageResult = null;
    if (files[0]) {
      onStatus("Analyzing image...");
      const imageResult = await analyzeImage(files[0], config.mlBase, mlHeaders);
      if (imageResult.data) mlImageResult = imageResult.data;
      if (imageResult.error) warnings.push(imageResult.error);
    }

    let uploadedUrls = [];
    let imageUpdateResponse = null;
    if (files.length) {
      onStatus("Uploading photos...");
      const uploadResult = await uploadToCloudinary(files, config);
      uploadedUrls = uploadResult.uploaded;
      warnings.push(...uploadResult.failures);

      if (uploadedUrls.length) {
        imageUpdateResponse = await saveCaseImages(caseId, uploadedUrls, mode);
      }
    }

    onStatus("Analyzing symptoms...");
    const symptomResult = await analyzeSymptoms(payload, config.mlBase, mlHeaders);
    const mlSymptomsResult = symptomResult.data || null;
    if (symptomResult.error) warnings.push(symptomResult.error);

    let mlFusedResult = null;
    if (mlImageResult || mlSymptomsResult) {
      onStatus("Fusing AI results...");
      const fusedResult = await fuseResults(mlImageResult, mlSymptomsResult, config.mlBase, mlHeaders);
      if (fusedResult.data) mlFusedResult = fusedResult.data;
      if (fusedResult.error) warnings.push(fusedResult.error);
    }

    const mlPayload = { mlImageResult, mlSymptomsResult, mlFusedResult };
    const hasMlData = Object.values(mlPayload).some((value) => value !== null && value !== undefined);
    let savedMlResponse = null;

    if (hasMlData || warnings.length) {
      onStatus("Saving AI review...");
      savedMlResponse = await persistMlProgress(caseId, mlPayload, warnings);
    }

    return {
      warnings,
      uploadedUrls,
      mlPayload,
      imageUpdateResponse,
      savedMlResponse,
    };
  }

  window.EdgeCareCaseMl = {
    buildPayloadFromCase,
    runAiPipeline,
  };
})();
