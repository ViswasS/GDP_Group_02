# EdgeCare-Triage
Graduate Direct Project - 1
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
EdgeCare Triage is a mobile and web application that uses Edge Artificial Intelligence (AI) to help patients check their symptoms before visiting a doctor. The app runs lightweight AI models directly on the patient’s device, ensuring that sensitive health data remains private.

## Benefits

Protects patient privacy by running AI on the device instead of the cloud.

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
