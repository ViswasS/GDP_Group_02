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

Extremely minor conditions are usually brought to clinics by patients.

Severe symptoms, on the other hand, will not be detected until they worsen, which can lead to delayed hospitalization.

**Expand coverage to more diseases (beyond skin conditions).**

Integrate multi-modal data (images + patient history + text reports).

Add AI explainability dashboards for transparency.

Build EHR integration for hospital use.

Implement global multilingual support for broader adoption.
  

# Basic Doctor Portal

Description: Secure login page (basic auth) where doctors can view patient submissions.

Goal: Give doctors access to triage data for testing workflows.

Prototype Output: Displays dummy patient entries with symptom, image preview, and mock triage result.
