const { prisma } = require("../../db/prisma");

const ACTIVE_CASE_STATUSES = ["SUBMITTED", "IN_REVIEW"];
const STATUS_LABELS = {
  SUBMITTED: "Submitted / AI-first",
  IN_REVIEW: "In review / doctor-assigned",
  CLOSED: "Closed",
};

function titleize(value = "") {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function patientDisplay(patient = {}) {
  const fullName = [patient.firstName, patient.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  const email = patient.user?.email || "";
  return email ? email.split("@")[0] : `Patient #${patient.patientId || ""}`.trim();
}

function doctorDisplay(doctor = {}) {
  if (!doctor) return "Unassigned";
  const fullName = [doctor.firstName, doctor.lastName].filter(Boolean).join(" ").trim();
  return fullName ? `Dr. ${fullName}` : doctor.user?.email || `Doctor #${doctor.doctorId || ""}`.trim();
}

function statusLabel(status = "") {
  return STATUS_LABELS[String(status || "").toUpperCase()] || titleize(status);
}

function careLevel(caseData = {}) {
  const fused = caseData.mlFusedResult || {};
  const display = fused.display || {};
  if (display.triage_text) return display.triage_text;

  const raw = String(
    fused?.recommended_actions?.care_level || fused.triage_level || fused.triage || fused.risk_level || ""
  ).toLowerCase();

  if (raw === "urgent_attention") return "Urgent attention";
  if (raw === "priority_review") return "Priority review";
  if (raw === "routine_review") return "Routine review";
  return "Home care / monitor";
}

function aiSupportState(caseData = {}) {
  const fused = caseData.mlFusedResult || {};
  return String(fused?.display?.support_state || "").toUpperCase() || null;
}

function isUrgentCase(caseData = {}) {
  const fused = caseData.mlFusedResult || {};
  const display = fused.display || {};
  const emergencySupport = display.emergency_support || {};
  const careLevelRaw = String(
    fused?.recommended_actions?.care_level || fused.triage_level || fused.triage || fused.risk_level || ""
  ).toLowerCase();

  return (
    caseData.isEmergency === true ||
    emergencySupport.is_emergency === true ||
    display.show_urgent_badge === true ||
    careLevelRaw === "urgent_attention"
  );
}

function isAiFirstCase(caseData = {}) {
  return String(caseData.status || "").toUpperCase() === "SUBMITTED" && !caseData.assignedDoctorId;
}

function isClearNonRashCase(caseData = {}) {
  const fused = caseData.mlFusedResult || {};
  const display = fused.display || {};
  const imageGate = fused.image_gate || {};
  const imageAssessment = String(display.image_assessment || imageGate.message || "").toLowerCase();
  const topLabel = String(imageGate.top_label || "").toLowerCase();

  return (
    aiSupportState(caseData) === "NO_OBVIOUS_RASH" ||
    imageAssessment.includes("no obvious rash") ||
    topLabel === "clear_or_normal_skin"
  );
}

function isUncertainCase(caseData = {}) {
  const fused = caseData.mlFusedResult || {};
  const display = fused.display || {};
  const condition = String(display.condition_text || "").toLowerCase();
  const severity = String(display.severity_text || "").toLowerCase();

  return (
    display.is_low_confidence === true ||
    aiSupportState(caseData) === "AI_CHAT" ||
    condition.includes("unclear") ||
    condition.includes("uncertain") ||
    severity.includes("uncertain")
  );
}

function buildDoctorReviewRequestedSet(auditLogs = []) {
  const requested = new Set();
  auditLogs.forEach((entry) => {
    if (entry?.targetId) requested.add(entry.targetId);
  });
  return requested;
}

function buildReuploadedCaseSet(cases = [], auditLogs = []) {
  const reuploaded = new Set();

  cases.forEach((caseData) => {
    if ((caseData._count?.images || 0) > 1) reuploaded.add(caseData.id);
  });

  auditLogs.forEach((entry) => {
    if (entry?.targetId) reuploaded.add(entry.targetId);
  });

  return reuploaded;
}

function sortRecentCases(cases = []) {
  return [...cases].sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
}

async function getAdminCaseQueue({ status, unassigned, page = 1, pageSize = 20 }) {
  const skip = (page - 1) * pageSize;

  const where = {};
  if (status) where.status = status;
  if (unassigned === true) where.assignedDoctorId = null;

  const [total, items] = await prisma.$transaction([
    prisma.triageCase.count({ where }),
    prisma.triageCase.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip,
      take: pageSize,
      include: {
        intake: true,
        patient: {
          select: {
            patientId: true,
            language: true,
            consentStatus: true,
            user: { select: { email: true } },
          },
        },
        assignedDoctor: {
          select: {
            doctorId: true,
            specialty: true,
            licenseNumber: true,
            user: { select: { email: true } },
          },
        },
        result: true,
      },
    }),
  ]);

  return {
    page,
    pageSize,
    total,
    items,
  };
}

async function updateProfile(userId, patch = {}) {
  const id = Number(userId);

  const data = {};
  const fields = ["firstName", "lastName", "adminLevel"];
  for (const key of fields) {
    if (patch[key] !== undefined) data[key] = patch[key];
  }

  const updated = await prisma.adminProfile
    .update({
      where: { adminId: id },
      data,
      select: {
        adminId: true,
        firstName: true,
        lastName: true,
        adminLevel: true,
        user: {
          select: { id: true, email: true, role: true, createdAt: true, updatedAt: true },
        },
      },
    })
    .catch((e) => {
      if (e.code === "P2025") return null;
      throw e;
    });

  return updated;
}

async function getInsightsDashboard() {
  const [
    patientCount,
    doctorCount,
    totalCases,
    cases,
    doctors,
    doctorReviewRequestAudits,
    imageReplaceAudits,
  ] = await prisma.$transaction([
    prisma.patientProfile.count({ where: { user: { role: "PATIENT" } } }),
    prisma.doctorProfile.count({ where: { user: { role: "DOCTOR" } } }),
    prisma.triageCase.count(),
    prisma.triageCase.findMany({
      select: {
        id: true,
        patientId: true,
        assignedDoctorId: true,
        status: true,
        submittedAt: true,
        isEmergency: true,
        mlStatus: true,
        mlFusedResult: true,
        doctorReviewedAt: true,
        doctorRecommendation: true,
        doctorSeverityOverride: true,
        intake: { select: { title: true } },
        patient: {
          select: {
            patientId: true,
            firstName: true,
            lastName: true,
            user: { select: { email: true } },
          },
        },
        assignedDoctor: {
          select: {
            doctorId: true,
            firstName: true,
            lastName: true,
            specialty: true,
            user: { select: { email: true } },
          },
        },
        _count: { select: { images: true } },
      },
    }),
    prisma.doctorProfile.findMany({
      where: { user: { role: "DOCTOR" } },
      select: {
        doctorId: true,
        firstName: true,
        lastName: true,
        specialty: true,
        experience: true,
      },
    }),
    prisma.auditLog.findMany({
      where: {
        targetTable: "Triage_Case",
        action: { in: ["CASE_DOCTOR_REQUESTED", "CASE_DOCTOR_REQUESTED_UNAVAILABLE"] },
      },
      select: { targetId: true, action: true, timestamp: true },
    }),
    prisma.auditLog.findMany({
      where: {
        targetTable: "Triage_Case",
        action: { in: ["CASE_IMAGE_REPLACED"] },
      },
      select: { targetId: true },
    }),
  ]);

  const submittedCases = cases.filter((caseData) => String(caseData.status).toUpperCase() === "SUBMITTED").length;
  const inReviewCases = cases.filter((caseData) => String(caseData.status).toUpperCase() === "IN_REVIEW").length;
  const closedCases = cases.filter((caseData) => String(caseData.status).toUpperCase() === "CLOSED").length;
  const openCases = cases.filter((caseData) => ACTIVE_CASE_STATUSES.includes(String(caseData.status).toUpperCase())).length;
  const urgentCases = cases.filter(isUrgentCase).length;
  const aiFirstCases = cases.filter(isAiFirstCase).length;
  const clearNonRashCases = cases.filter(isClearNonRashCase).length;
  const uncertainCases = cases.filter(isUncertainCase).length;
  const requestedReviewSet = buildDoctorReviewRequestedSet(doctorReviewRequestAudits);
  const reuploadedSet = buildReuploadedCaseSet(cases, imageReplaceAudits);

  const statusBreakdown = [
    { key: "SUBMITTED", label: statusLabel("SUBMITTED"), count: submittedCases },
    { key: "IN_REVIEW", label: statusLabel("IN_REVIEW"), count: inReviewCases },
    { key: "CLOSED", label: statusLabel("CLOSED"), count: closedCases },
  ].map((item) => ({
    ...item,
    percentage: totalCases ? Number(((item.count / totalCases) * 100).toFixed(1)) : 0,
  }));

  const doctorWorkload = doctors
    .map((doctor) => {
      const assignedCases = cases.filter((caseData) => caseData.assignedDoctorId === doctor.doctorId);
      const activeAssignedCases = assignedCases.filter((caseData) =>
        ACTIVE_CASE_STATUSES.includes(String(caseData.status).toUpperCase())
      );
      const urgentAssignedCases = assignedCases.filter(isUrgentCase);
      const reviewedCases = assignedCases.filter(
        (caseData) =>
          Boolean(caseData.doctorReviewedAt) ||
          Boolean(caseData.doctorRecommendation) ||
          Boolean(caseData.doctorSeverityOverride)
      );
      const closedAssignedCases = assignedCases.filter((caseData) => String(caseData.status).toUpperCase() === "CLOSED");

      return {
        doctorId: doctor.doctorId,
        doctorName: doctorDisplay(doctor),
        specialty: doctor.specialty || "General review",
        experience: doctor.experience ?? 0,
        assignedCases: assignedCases.length,
        activeAssignedCases: activeAssignedCases.length,
        urgentAssignedCases: urgentAssignedCases.length,
        reviewedCases: reviewedCases.length,
        closedCases: closedAssignedCases.length,
      };
    })
    .sort((a, b) => {
      if (b.activeAssignedCases !== a.activeAssignedCases) return b.activeAssignedCases - a.activeAssignedCases;
      if (b.urgentAssignedCases !== a.urgentAssignedCases) return b.urgentAssignedCases - a.urgentAssignedCases;
      return a.doctorName.localeCompare(b.doctorName);
    });

  const recentCaseItems = sortRecentCases(cases).map((caseData) => ({
    id: caseData.id,
    title: caseData.intake?.title || `Case #${caseData.id}`,
    patientName: patientDisplay(caseData.patient),
    status: caseData.status,
    statusLabel: statusLabel(caseData.status),
    urgent: isUrgentCase(caseData),
    assignedDoctorName: caseData.assignedDoctor ? doctorDisplay(caseData.assignedDoctor) : "Unassigned",
    submittedAt: caseData.submittedAt,
    careLevel: careLevel(caseData),
    aiFirst: isAiFirstCase(caseData),
  }));

  const recentCases = recentCaseItems.slice(0, 10);
  const queuePreview = recentCaseItems.filter((caseData) => caseData.aiFirst).slice(0, 5);

  return {
    summary: {
      totalPatients: patientCount,
      totalDoctors: doctorCount,
      totalCases,
      submittedCases,
      openCases,
      inReviewCases,
      closedCases,
      urgentCases,
      aiFirstCases,
    },
    statusBreakdown,
    workflow: {
      aiFirstUnassignedCases: aiFirstCases,
      doctorAssignedCases: inReviewCases,
      doctorReviewedCases: cases.filter(
        (caseData) =>
          Boolean(caseData.doctorReviewedAt) ||
          Boolean(caseData.doctorRecommendation) ||
          Boolean(caseData.doctorSeverityOverride)
      ).length,
      doctorReviewRequestedCases: requestedReviewSet.size,
      reuploadedImageCases: reuploadedSet.size,
    },
    triageInsights: {
      clearNonRashCases,
      uncertainCases,
      doctorReviewRequestedCases: requestedReviewSet.size,
      reuploadedImageCases: reuploadedSet.size,
      urgentCases,
      mlCompletedCases: cases.filter((caseData) => String(caseData.mlStatus || "").toUpperCase() === "COMPLETED").length,
    },
    doctorWorkload,
    recentCases,
    queuePreview,
  };
}

async function getInsightsOverview() {
  const dashboard = await getInsightsDashboard();

  const loads = dashboard.doctorWorkload.map((item) => item.activeAssignedCases);
  const totalLoad = loads.reduce((sum, value) => sum + value, 0);

  return {
    totals: {
      doctors: dashboard.summary.totalDoctors,
      patients: dashboard.summary.totalPatients,
      cases: dashboard.summary.totalCases,
      openCases: dashboard.summary.openCases,
      closedCases: dashboard.summary.closedCases,
      unassignedOpenCases: dashboard.summary.aiFirstCases,
    },
    doctorLoad: {
      min: loads.length ? Math.min(...loads) : 0,
      avg: loads.length ? Number((totalLoad / loads.length).toFixed(2)) : 0,
      max: loads.length ? Math.max(...loads) : 0,
    },
  };
}

async function getInsightsDoctors() {
  const dashboard = await getInsightsDashboard();
  const doctors = await prisma.doctorProfile.findMany({
    where: { user: { role: "DOCTOR" } },
    select: {
      doctorId: true,
      firstName: true,
      lastName: true,
      specialty: true,
      experience: true,
    },
  });

  const workloadMap = new Map(dashboard.doctorWorkload.map((row) => [row.doctorId, row]));
  return doctors.map((doctor) => {
    const workload = workloadMap.get(doctor.doctorId);
    return {
      doctorId: doctor.doctorId,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      specialty: doctor.specialty,
      experience: doctor.experience,
      activeCaseCount: workload?.activeAssignedCases || 0,
      totalCaseCount: workload?.assignedCases || 0,
    };
  });
}

async function getInsightsPatients() {
  const patients = await prisma.patientProfile.findMany({
    select: {
      patientId: true,
      firstName: true,
      lastName: true,
      cases: {
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          status: true,
          assignedDoctor: { select: { doctorId: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  return patients.map((patient) => {
    const latest = patient.cases[0] || null;
    return {
      patientId: patient.patientId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      totalCases: patient.cases.length,
      openCases: patient.cases.filter((caseData) => ACTIVE_CASE_STATUSES.includes(String(caseData.status).toUpperCase())).length,
      latestCaseId: latest?.id || null,
      latestCaseStatus: latest?.status || null,
      latestAssignedDoctor: latest?.assignedDoctor
        ? {
            doctorId: latest.assignedDoctor.doctorId,
            firstName: latest.assignedDoctor.firstName,
            lastName: latest.assignedDoctor.lastName,
          }
        : null,
    };
  });
}

module.exports = {
  getAdminCaseQueue,
  updateProfile,
  getInsightsDashboard,
  getInsightsOverview,
  getInsightsDoctors,
  getInsightsPatients,
};
