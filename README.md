# EdgeCare-Triage
Graduate Direct Project - 1, Group_02

# Team Members
Himaja,
Tharun,
Viswas,
Vamshi Krishna.

# Key Features:

Patients can answer symptom-related questions through an easy-to-use questionnaire.

Patients can take/upload a photo of a rash or visible symptom for AI-based analysis.

The app provides a clear triage result within 10 seconds, guiding patients on whether they need medical care.

Doctors have access to a secure web portal where they can view patient reports, confirm or override AI decisions, and update patient history.

# Overview
EdgeCare Triage is a mobile and web app designed to give patients peace of mind before visiting a doctor. Using smart AI that runs directly on the phone, the app keeps personal health data private while providing quick and reliable results. Patients can simply answer a few health questions or snap a photo of a rash to find out if they need medical care within seconds. Doctors can then view these reports through a secure portal, confirm the results, or make adjustments as needed. By helping patients get instant guidance and supporting doctors with clear reports, EdgeCare Triage makes healthcare faster, safer, and more accessible for everyone.

## Benefits

Protects patient privacy by running AI on the device, rather than in the cloud.

Reduces unnecessary clinic visits by offering quick pre-screening.

Supports doctors with decision-ready reports to save time and improve accuracy.

# Technologies Used
**Front-end:**
Mobile App (Patient side): React Native (with Expo for quick setup), React Native Paper for UI components
Web App (Doctor portal): ReactJS + Material-UI (for professional dashboards)

**Backend:**
Firebase (Firestore for data, Firebase Auth for login, Firebase Storage for image uploads)
(Alternative: Supabase or a simple Node.js + Express backend if you want more control)

**Database:**
Firebase Firestore (NoSQL, real-time sync between patient and doctor views)

**AI Model:**
Image Classification: MobileNetV2 or EfficientNet-Lite (TensorFlow/Keras → TensorFlow Lite for on-device inference)
Symptom Classification: Logistic Regression or Decision Tree (scikit-learn, lightweight and easy to embed)
Fusion: Weighted decision rule combining image and symptom results

**Tools:**
Python (TensorFlow/Keras, scikit-learn, OpenCV for preprocessing)
GitHub (version control, daily commits)
Figma (wireframes/designs if needed)

# EdgeCare Triage Workflow

1. Patient Symptom Capture
   
  Patients enter health information through a guided questionnaire and/or snap a photo of visible symptoms (e.g., rashes).

2. On-Device AI Analysis
   
  The app processes the inputs using AI models to identify potential conditions and assign a severity rating (Normal, Mild, Moderate, Severe).

3. Personalized Guidance

* Medications.

* Dietary and lifestyle recommendations.

* Clear advice on whether or not an appointment with a doctor is necessary.

4. Triage Report Generation
   
  A formatted report is generated summarizing patient feedback, AI results, severity score, and suggested action.

5. Physician Portal Access
   
  Physicians access reports securely, verify or override the AI determination, and include notes or treatment plans.

6. Feedback & Follow-Up
   
  Patients are provided with updated guidance and notifications for conditions that are long-term or severe, allowing for timely intervention and ongoing care.

# Application of Machine Learning Models in EdgeCare Triage

Machine learning models are applied in EdgeCare Triage to provide computerized evaluation and decision-making for rashes on the skin. Transfer learning models or CNNs are used to evaluate images shared by patients and identify features to classify the type of rash and predict severity. These visually based features and structured patient metadata are then input into machine learning classification algorithms such as decision trees, random forests, gradient boosting, or neural networks to calculate the levels of risk and recommend cautionary or recuperation steps. The procedure is done using software libraries like TensorFlow or PyTorch for model training and inference, but in real-time, enabled by on-device deployment to enable patients to be provided with first opinions quickly and to allow for structured triage reports to enable doctor consultations.

# Evaluation Metrics
To ensure that EdgeCare Triage provides accurate, reliable, and safe pre-screening results, we will evaluate our AI model and system performance using a combination of model performance metrics and system-level performance metrics:

### MODEL PERFORMANCE METRICS:
These metrics evaluate how well the AI model classifies images of rashes/skin conditions
 
**Accuracy:** The number of correctly classified pictures out of the total photos is called accuracy. It provides an overall idea of the performance of the model.

**Precision:** It represents the number of pictures correctly classified as a specific disease. This minimizes the number of false positives.

**Recall (Sensitivity):** Displays the proportion of actual occurrences of a disease in the real world that the model accurately forecasted. It is important in the medical industry because neglecting a condition may prove to be fatal.

**F1-score:** If there is class imbalance, the F1-score, which is the harmonic mean of recall and precision, yields an unbiased assessment.

**Confusion matrix:** A table that compares the predicted labels and actual labels is known as a confusion matrix, and it helps us know where the model is doing wrong.

**ROC-AUC (Receiver Operating Characteristic – Area Under Curve)** – Measures the model’s ability to distinguish between classes at various thresholds.
A high AUC (close to 1) indicates good separability.

### System Performance Metrics:
Even if the model is accurate, it must work quickly and securely for patients and doctors.

**Availability / Uptime** – System reliability, ideally 99%+ availability for web portal access.

**Throughput** – Number of images the system can handle per minute under normal load. Important for scaling when multiple users are active.

**Latency / Response Time** – Time taken to provide triage result after an image is submitted.
Goal: ≤ 10 seconds as per user story acceptance criteria.

# Future Enhancements for EdgeCare Triage

**Accuracy & Accessibility:**
The app will be enhanced to provide more accurate, accessible, and reliable support for skin and rash-related conditions. 
Multi-language support will allow patients from diverse backgrounds to use the app with ease.

**Improved AI Engine:**
The AI engine will be further trained to detect a wider range of skin problems, improving accuracy and offering more detailed triage results.

**Appointment Scheduling:**
Patients will be able to directly connect with doctors when serious skin issues are detected, ensuring timely care.

**Challenges & Risk Management**

Data availability and quality.

Model interpretability in medical context.

Ethical and privacy concerns.

Limitations of AI recommendations.

# Limitations of EdgeCare Triage

**Limited Dataset for Training AI**

The validity of rash detection depends on the utilized dataset. In the event that the dataset lacks infrequent conditions or different skin tones, predictions may be less accurate.

**Not a Replacement for Professional Diagnosis**

The app provides only triage advice and can't replace the diagnosis of an experienced dermatologist.

**Dependency on Image Quality**

Poor light, unfocused images, or incomplete photos of the rash can lower the validity of AI-based predictions.

**Condition Scope**

Currently only addresses skin rashes and external symptoms. It can't detect internal conditions or complex skin diseases.

**Device Limitations**

On-device AI (TensorFlow Lite) could have worse performance on low-end devices, leading to slow analysis.

**Connectivity Issues**

Some features (e.g., access to the doctor portal, report syncing) require internet, limiting offline usage.

**Data Privacy & Ethics**

The app needs to follow healthcare data regulations like HIPAA and GDPR, which means it has to ensure strong encryption and secure storage for patient information.
The AI engine should be trained on a variety of datasets to help minimize bias and promote fairness for all users.
It's also important that patients have control over their data, with clear disclaimers stating that the app is meant for pre-screening purposes and not as a substitute for a proper diagnosis.

**Transparency**

* Provide explainable AI outputs so doctors and patients understand why a decision was made.

* Build fairness checks to minimize bias across gender, ethnicity, and skin tone.

* Create a patient-facing transparency report explaining AI limitations.

# Impact on Healthcare

* Avoids redundant clinic visits with instant pre-screening at home, offloading the hospital burden.

* Facilitates patients with fast consultation, reducing anxiety and guaranteeing on-time medical interventions.

* Improves healthcare access for rural and underprivileged communities via smartphone-based artificial intelligence.

* Helps doctors with structured, decision-ready reports that save time and improve diagnosis accuracy.

* Improves patient privacy by running AI models on-device, maintaining sensitive information secure.

* Supports public health through facilitation of early detection of skin conditions and possible outbreak trends.
  100% of your text is likely AI-generated

**Scalability Considerations**

Patient Growth: Firestore and Storage are designed to scale automatically, effortlessly accommodating thousands of users. Additionally, with React Native, you can achieve cross-platform scalability without any issues.

Doctor Portal: This system allows multiple users to log in at the same time while ensuring secure access. The Role-Based Access Control (RBAC) feature also sets the stage for future multi-clinic operations.

Data Scaling: Firebase Storage is great for handling large uploads, thanks to its compression and lifecycle rules. You can even archive older reports to keep costs down.

Performance: With on-device AI, you can expect responses in under ten seconds without putting a strain on the server. Caching and offline mode further enhance reliability, especially in areas with low bandwidth.

# Advanced Features for Patients

Symptom Timeline: Let patients track how symptoms evolve over days/weeks.

Medication Tracking: Let patients log medication, have AI track interactions.

Offline Mode: Questionnaire and AI processing can be offline, synching when internet is restored.

Wearable Integration: Integration with smartwatches/fitness trackers for vitals (heart rate, temperature) is optional.

# Tools & Frameworks:

TensorFlow/Keras or PyTorch: Model building and training.

OpenCV: Image preprocessing.

scikit-learn: Traditional ML for classification.

Streamlit/Flutter: Prototype front-end for patient interface.

FastAPI/Flask: Backend API for model serving.

ONNX/TFLite: For model deployment on edge devices (mobile).

# Methodology

**Phase 1 – Research & Data Gathering (Weeks 1–3)**

Identify scope diseases.

Collect datasets.

Define preprocessing pipeline.

**Phase 2 – Model Development (Weeks 4–7)**

Train CNN for image recognition.

Test transfer learning models.

Train classification models with image + metadata.

**Phase 3 – Prototype Development (Weeks 8–10)**

Build simple patient app (image upload + feedback).

Integrate triage report generation.

**Phase 4 – Testing & Validation (Weeks 11–13)**

Evaluate accuracy, precision, recall, F1-score.

Test usability with mock patients/doctors.

**Phase 5 – Deployment & Feedback (Weeks 14–15)**

Deploy model on-device or cloud.

Collect real user feedback for refinement.

# Example User Journey

Patient: Takes a photo of rash + answers questionnaire → AI gives “Moderate” rating.

Report Generated: “Possible dermatitis. Recommendation: Consult doctor.”

Doctor Portal: Doctor sees rash photo, patient history, AI suggestion. Confirms “Dermatitis, prescribe topical cream.”

Patient Update: Patient gets push notification with treatment notes & follow-up reminder.

# Client/Stakeholder Benefits

* Reduced unnecessary clinic visits.

* Structured triage reports for doctors.

* Improved patient confidence and awareness.

# Functional Requirements

**The system SHALL:**

The system SHALL allow patients to answer symptom questions through a web or mobile interface.

The system SHALL allow patients to upload or photograph their rash or affected area.

The system SHALL conduct an AI model to classify the image and generate a triage result within 10 seconds.

The system SHALL display the triage result clearly to the patient (e.g., "Seek care", "Monitor at home").

**The system MAY**

The system MAY recommend future actions such as scheduling a doctor's visit, OTC medication use, or lifestyle changes.

The system MAY provide export of records by generating and exporting triage history in PDF/CSV format for hospitals or patients.

The system MAY incorporate wearable devices to sync vital signs, including heart rate, temperature, and activity data from smartwatches or fitness trackers.

The system MAY enhance condition coverage to include other medical conditions beyond rashes (e.g., respiratory illness, fever, cough) in future versions.

**Robustness, evaluation and validation**

Metrics: sensitivity (recall), specificity, precision, F1, per-class ROC-AUC; calibration (reliability diagrams).

Clinical validation: reader study comparing AI vs dermatologist on held-out/histopathology-labeled cases. Use inter-rater agreement (kappa) and actionable thresholds for triage.

Adversarial / distributional checks: evaluate on images from multiple devices, skin tones, and lighting conditions.

# Patient Awareness & Trust Issues

* Patients are hesitant to use pre-screening tools due to privacy and data protection concerns.

* Fear of misuse of sensitive images of health (e.g., skin rashes) keeps early action at bay.

* Many patients ignore early warning signals or delay seeking treatment, potentially worsening ailments.

**Delayed or Inappropriate Consultations**

* Extremely minor conditions are usually brought to clinics by patients.

* Severe symptoms, on the other hand, will not be detected until they worsen, which can lead to delayed hospitalization.

**Expand coverage to more diseases (beyond skin conditions).**

* Integrate multi-modal data (images + patient history + text reports).

* Add AI explainability dashboards for transparency.

* Build EHR integration for hospital use.

* Implement global multilingual support for broader adoption.

# Basic Doctor Portal

Description: Secure login page (basic auth) where doctors can view patient submissions.

Goal: Give doctors access to triage data for testing workflows.

Prototype Output: Displays dummy patient entries with symptom, image preview, and mock triage result.

**Prototype Development Progress**

I’ve worked on the planned prototypes, including the questionnaire interface, image upload, mock AI triage, result display,
doctor portal, database handling, workflow integration, and documentation. The basic functional flow is ready with placeholder outputs for this phase.

# Usability Enhancements

Multi-language support: Auto-translate questions/reports (start with English + 1–2 local languages).

Accessibility Features: Voice-activated questionnaire for elderly or visually impaired patients.

Chatbot-style Symptom Entry: Instead of bare forms, patients can "chat" with a bot that guides them through.

Emergency Detection: If a critical condition is detected, the app can trigger an alert like "Seek emergency care immediately" or even auto-dial 911 (configurable).

**participated in creating use cases for the EdgeCare Triage project, including**

Patient workflow (send skin complaint, severe condition handling).

Doctor workflow (review and manage complaints).

Recorded system actions, inputs, and outputs for each scenario.

**Core Features**

Upload skin images for instant AI analysis.

Symptom questionnaire for better condition matching.

Preliminary diagnosis with severity levels.

Precautionary measures & next-step recommendations.

## Project Architecture

The overall flow of EdgeCare Triage is as follows:

**Dataset**

Collect medical image datasets (skin conditions).

Include patient metadata (age, symptoms, duration, etc.).

**Preprocessing**

Clean and normalize images.

Perform augmentation (rotation, scaling, flipping).

Handle metadata (encoding, scaling).

**Training**

Train deep learning models (CNN, ResNet, EfficientNet) on image data.

Use classification models (Logistic Regression, XGBoost, Random Forest) for severity and decision support.

Evaluate performance (accuracy, precision, recall, F1-score).

**Model**

Save trained models in a modular format (TensorFlow .h5 / PyTorch .pt).

Add explainability tools (Grad-CAM heatmaps, SHAP feature importance).

**Frontend**

Patient interface (upload images, view results, get reports).

Doctor/Admin dashboard (review reports, case analytics).

Web/Mobile support with secure login.

# Scalability / Future Vision

**Expand Beyond Skin**

Add modules for cough detection (via audio).

Eye infection detection.

Fever detection via facial thermal imaging.

**Offline Mode (Edge AI)**

Full AI inference without an internet connection → ideal for rural/low-connectivity regions.

Syncs results when the internet is available.

**Public Health Impact**

Detect outbreak clusters (such as measles and monkeypox) by analyzing case density.

Anonymous data sharing with health authorities.

**Observability**

Metrics catalog (dimensions, business KPIs)

Instrumentation for React Native, web portal, and backend 

Correlation model (traceId/requestId/caseId/modelVersion)

Alerting thresholds and a runbook checklist

Dashboards to build (Patient, Latency, Reliability, Portal Perf, Model Monitor, Backlog)

Privacy/Retention/Access policies and sampling strategy

Testing observability (synthetics, chaos, load validation)

**Constraints for the Data**

Limited access to high-quality medical datasets.

Requirement for refined and well-labeled images.

**Engineering & Deployment**

CI/CD Pipeline: Automated testing + deployment with GitHub Actions or GitLab CI.

Containerization: Deploy backend services with Docker/Kubernetes for scalability.

Edge Optimization: Quantization/Pruning for smaller AI model size → faster on-device performance.

Load Testing: Simulate thousands of concurrent patients uploading images.

**Stakeholder Goals:**
Patient: They want a quick assessment of their condition, guidance on self-care, and clarity on when to consult a professional.
Physicians: They need organized triage reports that include severity ratings to help cut down on consultation time.
Healthcare Systems: Their goal is to minimize unnecessary visits and make the most of their resources.

# Doctor-Side Add-Ons

**E-Prescription & Notes**

Enable doctors to generate electronic prescriptions (PDF) within the portal.

Can be downloaded by patients.

**Follow-up Scheduling**

Follow-up appointments/reminders can be scheduled by doctors within the system.

**Doctor-to-Doctor Communication**

Secure referral process → one doctor can refer the triage case to a specialist.

# Limitations

**Dataset Size and Diversity**

The model’s accuracy will depend heavily on the quality and diversity of the dataset used. If the dataset does not include a wide range of skin tones, lighting conditions, or rare skin conditions, the predictions may be biased or inaccurate.

**Image Quality Sensitivity**

Blurry, poorly lit, or partially cropped images may lead to incorrect triage results. The system will need to warn users but cannot fully guarantee accuracy in such cases.

**Scope of Diagnosis**

This tool is for preliminary triage and cannot replace a medical professional’s diagnosis. It may miss complex or non-visual symptoms and should be treated as a first step, not a final medical opinion.

**Privacy and Security Concerns**

Even though the model is designed for on-device inference, storing patient images and results securely is critical. Any misconfiguration could pose data privacy risks.

**Doctor Portal Usability**

The doctor portal is a prototype and may have limited filtering, search, and reporting features in the first iteration.

# Success Criteria

Early prototype successfully classifies at least 3 common skin conditions.

Provides actionable precautionary measures and clear next steps.

Generates structured reports that doctors can validate and trust.

Achieves explainability through Grad-CAM/SHAP visualizations.

**Requirements Engineering Work**
The main activities such as elicitation, analysis, documentation, validation, and management.
I also understood the roles of different participants, such as stakeholders, developers, product owners, project managers, and testers, in this context.
Furthermore, I learned functional vs. non-functional requirements, key project artifacts such as SRS, user stories, and use case diagrams, and the sequencing of steps in requirement elicitation.

**Technical Constraints**

Deployment on edge or mobile devices requires lightweight and optimized models to handle limited compute power.

Cloud integration may be necessary for heavy processing, but this raises latency and connectivity concerns.

## Additional Assessment Metrics

* Fairness metrics → Balanced accuracy for diverse skin tones, genders, age ranges.

* Resource usage → Monitor AI models' RAM/CPU usage on-device to illustrate scalability to low-end phones.

* User satisfaction surveys → Incorporate usability testing with SUS (System Usability Score) for patient and physician portals.

## Patient App: questionnaire + image upload + result screen (mocked AI)

AI Service: fixed rules/model stub returning realistic results

Doctor Portal: case list + detail page + override action

If you want, I can turn this into a one-pager for your GitHub wiki or sketch minimal API endpoints next.

## Ethical Considerations

AI must be explainable and transparent in decision-making.

Bias mitigation to ensure fairness across demographics.

## Testing and Validation

To ensure the reliability and accuracy of the EdgeCare Triage system, different levels of testing will be conducted throughout development. Unit testing will verify the functionality of individual components such as the symptom form, image upload module, and triage result display. Integration testing will ensure that data flows correctly between the patient interface, the AI analysis module, and the doctor’s portal. Performance testing will focus on response times, making sure that triage results are generated within the expected time frame of 10 seconds. Finally, user testing with sample patients and medical professionals will help validate usability, clarity of results, and overall effectiveness of the system in real-world scenarios.Testing and Validation
To ensure the reliability and accuracy of the EdgeCare Triage system, different levels of testing will be conducted throughout development. Unit testing will verify the functionality of individual components such as the symptom form, image upload module, and triage result display. Integration testing will ensure that data flows correctly between the patient interface, the AI analysis module, and the doctor’s portal. Performance testing will focus on response times, making sure that triage results are generated within the expected time frame of 10 seconds. Finally, user testing with sample patients and medical professionals will help validate usability, clarity of results, and overall effectiveness of the system in real-world scenarios.

**Usability**
The interface should be straightforward, intuitive, and user-friendly for patients who may not be tech-savvy.

Results, alerts, and guidance must be presented in clear, actionable language (like “apply topical care” or “schedule a doctor visit”), steering clear of any technical jargon or errors.

# References & Useful Links
1. - [PH2 Dataset](https://www.kaggle.com/code/herilchangwal/u-net-with-resnet-50-on-ph2-dataset/input)

  
### Primary Users
The EdgeCare Triage system manages two main categories of data:

Patient-side data — symptom responses, images, AI triage results, which is grouped by age.

Doctor-side data — feedback, overrides, and historical records.

**Patients (18–60 years):** Mild to moderate skin symptomatic individuals who want instant consultation prior to a doctor's visit.

**Older Patients (60+):** May employ voice-guided or easy UI for symptom input.

**Rural/Remote Users:** People who have poor dermatologist access and can take advantage of offline triage capability.

### Secondary Users

**Doctors/Dermatologists:** Use the secure web portal to validate AI responses, approve treatment, and update patient history.

**Healthcare Administrators:** Use aggregated and anonymized data to identify patterns in outbreaks and resource allocation.

## Maintainability

AI models on the Edge device should be updateable independently, without requiring a full system reinstall.

The system code should be modular to allow easy addition of new features, such as new exercise types or monitoring metrics.

##  Stability & Reliability

The application should gracefully handle crashes, network hiccups, or unexpected shutdowns without losing any data.

Generated triage reports and notifications need to stay consistent and accurate, even when the workload varies.

# Public Health & Ethical Additions

a. Anonymous Trend Dashboard

Batch case data (anonymous) to show outbreak trends.

May be useful for public health surveillance (e.g., measles rash cluster).

b. Privacy Settings Panel

Let patients control what data is stored, disclosed to physicians, or deleted.

Add a HIPAA/GDPR compliance note and easy consent UI.

c. Bias & Fairness Evaluation

Log evaluation across skin tones/age/gender to show fairness metrics (balanced accuracy, per-group ROC-AUC).

## Interoperability
The AI-generated outputs should be easily understandable by all types of users: doctors, patients, and caregivers.

Each triage result must include step-by-step instructions and clear precautionary measures, ensuring users can confidently follow the suggested next steps without medical or technical expertise.

## Maintainability

AI models and classification algorithms should be updatable independently, so there’s no need for a complete system reinstall.

The codebase must remain modular, allowing for easy addition of new disease categories, reporting features, or analytics tools.

## Security

Patient information in the form of images, symptom entries, and reports produced must be securely stored using Advanced Encryption Standard-256 encryption and securely transmitted using Transport Layer Security 1.3.

Patient and physician user accounts need to be secured with top-of-the-line authentication mechanisms such as two-factor authentication (2FA) and at least a 12-character password to prevent unauthorized access.

End-to-end triage processing, from upload to display of results, must be achieved in under 10 seconds with 99% reliability.

## Triage Case Details
Case ID: Unique per case (TRIAGE_CASE.case_id). Patient ID: Patient owning the case (TRIAGE_CASE.patient_id).
Questionnaire ID: Associated questionnaire used (TRIAGE_CASE.questionnaire_id).
Emergency Flag: Whether or not the case is flagged as an emergency (TRIAGE_CASE.is_emergency). 
Assigned Doctor: Optional doctor assigned (TRIAGE_CASE.doctor_id).

## Images (Clinical Photos)
Image ID: Unique ID for every image uploaded (IMAGE.image_id). 
Case ID: Case that this image belongs to (IMAGE.case_id).
Question Flags: Tags/notes linking image to specific questions or findings (IMAGE.question_flags).

## Access Controls

Role-Based Access Control (RBAC): User access is determined by the Role attribute in the USER table and admin_level in ADMIN_PROFILE.

Admin: Full access to user administration, system logs, triage cases, and AI models.

Doctor: Access to assigned or escalated triage cases, possible to review, confirm, or override AI results.

Patient: Limited to their own triage history, images, and results.

Authentication: Strong password policy with optional Multi-Factor Authentication (MFA) through mfa_enabled in the USER table.

Session Control: Sessions are controlled through the Session table in order to keep each login time-limited and traceable through created_time and expired_time.

## Availability
Users should be able to access the application to view initial diagnoses and view precautionary measures even if the central server is down for a brief period. The system must support at least 99.5% uptime for all mission-critical services to ensure round-the-clock availability.

It must support up to 1,000 concurrent users without degradation in response time, with responses occurring less than 5 seconds per request.

##  Submission of Triage Cases

Related Tables: TRIAGE_CASE, QUESTIONNAIRE, IMAGE

Description: Patients submit triage cases by responding to questionnaires and uploading images. 

Each case points to a specific patient, questionnaire, and doctor association.

## Regular Security Audits
Conduct periodic vulnerability scans, code audits, and penetration testing.

All administrator and doctor activities are written to the AUDIT_LOG table through fields such as user_id, action.

Logs are immutable and retained for compliance and audit purposes.

## Update Demographic Information

Goal: Allow patients to update or correct their own individual details.

Actor: Patient

Inputs:

Updated demographic data (e.g., gender, age, allergies, known conditions).

System Actions:

Confirm the input data.

Update the patient's record within the database.

Securely store the updated data.

Outputs:

Success message for demographic data update.

## Patient Profile
Patient_ID: ID for each patient.

Language: Preferred language of communication for the patient.

Consent_Status: Whether or not the patient has consented previously.
