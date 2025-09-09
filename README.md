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

# **Overview**
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

We employ the following evaluation metrics to determine how well our picture categorization model performs:
 
**Accuracy:** The number of correctly classified pictures out of the total photos is called accuracy. It provides an overall idea of the performance of the model.

**Precision:** It represents the number of pictures correctly classified as a specific disease. This minimizes the number of false positives.

**Recall (Sensitivity):** Displays the proportion of actual occurrences of a disease in the real world that were accurately forecasted by the model. It is important in the medical industry because neglecting a condition may prove to be fatal.

**F1-score:** If there is class imbalance, the F1-score, which is the harmonic mean of recall and precision, yields an unbiased assessment.

**Confusion matrix:** A table that compares the predicted labels and actual labels is known as a confusion matrix, and it helps us know where the model is doing wrong.

# Future Enhancements for EdgeCare Triage

**Accuracy & Accessibility**:
The app will be enhanced to provide more accurate, accessible, and reliable support for skin and rash-related conditions. 
Multi-language support will allow patients from diverse backgrounds to use the app with ease.

**Improved AI Engine**:
The AI engine will be further trained to detect a wider range of skin problems, improving accuracy and offering more detailed triage results.

**Appointment Scheduling**:
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

Currently only addressing skin rashes and external symptoms. It can't detect internal conditions or complex skin diseases.

**Device Limitations**

On-device AI (TensorFlow Lite) could have worse performance on low-end devices, leading to slow analysis.

**Connectivity Issues**

Some features (e.g., access to doctor portal, report syncing) require internet, limiting offline usage.
