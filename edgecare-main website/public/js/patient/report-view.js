requirePatientAuth();

(function () {
  const reportRoot = document.getElementById("reportRoot");
  const reportPrintBtn = document.getElementById("reportPrintBtn");
  const reportCloseBtn = document.getElementById("reportCloseBtn");
  const reportUtils = window.EdgeCareReports;

  function setState(title, description, variant = "loading") {
    if (!reportRoot) return;
    const className = variant === "error" ? "empty-state empty-state--error" : "empty-state empty-state--loading";
    reportRoot.innerHTML = `
      <div class="${className}">
        <strong>${reportUtils.escapeHtml(title)}</strong>
        <span>${reportUtils.escapeHtml(description)}</span>
      </div>
    `;
  }

  function renderReportPage({ title, subtitle, metadata = [], reports = [] }) {
    if (!reportRoot) return;
    const html = reportUtils.buildPrintableDocument({ title, subtitle, metadata, reports });
    const parser = new DOMParser();
    const parsed = parser.parseFromString(html, "text/html");
    const styleContent = parsed.querySelector("style")?.textContent || "";

    if (styleContent && !document.getElementById("reportViewStyles")) {
      const style = document.createElement("style");
      style.id = "reportViewStyles";
      style.textContent = styleContent;
      document.head.appendChild(style);
    }

    const shell = parsed.querySelector(".print-shell");
    reportRoot.className = "report-view-shell";
    reportRoot.innerHTML = shell ? shell.outerHTML : `
      <div class="empty-state empty-state--error">
        <strong>Unable to render report</strong>
        <span>The report content could not be prepared for this page.</span>
      </div>
    `;
  }

  async function loadProfile() {
    const response = await apiFetch("/patient/profile", { method: "GET" }, { loginPath: "/patient-login.html" });
    return response?.data || null;
  }

  async function loadCurrentCase(caseId) {
    const response = await apiFetch(`/cases/${caseId}`, { method: "GET" }, { loginPath: "/patient-login.html" });
    return response?.data || null;
  }

  async function loadAllCases() {
    const response = await apiFetch("/cases", { method: "GET" }, { loginPath: "/patient-login.html" });
    return response?.data || [];
  }

  async function init() {
    try {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("mode") || "current";
      const profile = await loadProfile();
      const patientName = profile
        ? [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || profile.user?.email || "Patient"
        : "Patient";

      if (mode === "current") {
        const caseId = Number(params.get("caseId"));
        if (!caseId) {
          setState("Report unavailable", "The report link is missing a case ID.", "error");
          return;
        }

        const caseData = await loadCurrentCase(caseId);
        if (!caseData) {
          setState("No report data", "This case could not be loaded for report viewing.", "error");
          return;
        }

        renderReportPage({
          title: "EdgeCare Case Report",
          subtitle: "Structured triage report for the selected case.",
          metadata: [
            `Case #${caseData.id}`,
            reportUtils.buildHealthReport(caseData, { patientName }).overview.status,
          ],
          reports: [
            {
              caseData,
              report: reportUtils.buildHealthReport(caseData, { patientName }),
            },
          ],
        });
        return;
      }

      const month = params.get("month") || "";
      const doctorReviewedOnly = params.get("doctorReviewedOnly") === "1";
      const allCases = await loadAllCases();
      const filteredCases = reportUtils.filterHistoryCases(allCases, { month, doctorReviewedOnly });

      if (!filteredCases.length) {
        setState(
          "No report data",
          "No cases matched the selected filters. Return to case history and adjust the export filters.",
          "error"
        );
        return;
      }

      renderReportPage({
        title: "EdgeCare Case History Export",
        subtitle: "Structured patient history export for the selected filters.",
        metadata: [
          reportUtils.formatMonthLabel(month),
          doctorReviewedOnly ? "Doctor-reviewed only" : "All matching cases",
          `${filteredCases.length} case${filteredCases.length === 1 ? "" : "s"}`,
        ],
        reports: filteredCases.map((caseData) => ({
          caseData,
          report: reportUtils.buildHealthReport(caseData, { patientName }),
        })),
      });
    } catch (error) {
      console.error("[patient_report_view_failed]", error);
      setState(
        "Unable to load report",
        error?.message || "The report could not be loaded. Try reopening it from the case page.",
        "error"
      );
      toast?.error?.(error?.message || "Unable to load the report");
    }
  }

  reportPrintBtn?.addEventListener("click", () => window.print());
  reportCloseBtn?.addEventListener("click", () => window.close());

  init();
})();
