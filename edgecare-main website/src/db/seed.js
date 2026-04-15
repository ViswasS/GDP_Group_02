const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding EdgeCare demo data (patients + cases)...");

  const DEFAULT_PASSWORD = "Patient@123";
  const SALT_ROUNDS = 10;

  const patients = [
    { email: "patient11@gmail.com", language: "en", consentStatus: true },
    { email: "patient22@gmail.com", language: "en", consentStatus: true },
    { email: "patient3@gmail.com", language: "en", consentStatus: true },
    { email: "patient4@gmail.com", language: "en", consentStatus: true },
    { email: "patient5@gmail.com", language: "en", consentStatus: true },
    { email: "patient6@gmail.com", language: "en", consentStatus: true },
    { email: "patient7@gmail.com", language: "en", consentStatus: true },
    { email: "patient8@gmail.com", language: "en", consentStatus: true },
  ];

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  const createdPatients = [];
  for (const p of patients) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: {
        email: p.email,
        passwordHash,
        role: "PATIENT",
        patientProfile: {
          create: {
            language: p.language,
            consentStatus: p.consentStatus,
          },
        },
      },
      include: { patientProfile: true },
    });

    createdPatients.push(user);
    console.log(`✅ Patient ready: ${user.email}`);
  }

  const scenarios = [
    {
      title: "Skin rash with itching",
      duration: "3 days",
      medications: "None",
      isEmergency: false,
    },
    {
      title: "Red patches on forearm",
      duration: "1 week",
      medications: "Antihistamine",
      isEmergency: false,
    },
    {
      title: "Sudden facial swelling",
      duration: "2 hours",
      medications: "None",
      isEmergency: true,
    },
    {
      title: "Persistent acne flare-up",
      duration: "2 months",
      medications: "Topical retinoid",
      isEmergency: false,
    },
    {
      title: "Painful blistering rash",
      duration: "24 hours",
      medications: "Pain reliever",
      isEmergency: true,
    },
    {
      title: "Dry, cracked skin on hands",
      duration: "3 weeks",
      medications: "Moisturizer",
      isEmergency: false,
    },
    {
      title: "Rapidly spreading redness with fever",
      duration: "6 hours",
      medications: "Paracetamol",
      isEmergency: true,
    },
    {
      title: "Mild eczema on elbow",
      duration: "10 days",
      medications: "Topical steroid",
      isEmergency: false,
    },
  ];

  for (let i = 0; i < createdPatients.length; i++) {
    const patient = createdPatients[i];
    const s = scenarios[i % scenarios.length];

    const intake = await prisma.caseIntake.create({
      data: {
        title: s.title,
        duration: s.duration,
        medications: s.medications,
        isActive: true,
      },
    });

    await prisma.triageCase.create({
      data: {
        patientId: patient.patientProfile.patientId,
        intakeId: intake.id,
        isEmergency: s.isEmergency,
        status: "SUBMITTED",
      },
    });

    console.log(
      `📝 Case created → ${patient.email} | "${s.title}" | Emergency: ${s.isEmergency}`
    );
  }

  console.log("🎉 Seed completed: 8 patients, mixed cases ready.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
