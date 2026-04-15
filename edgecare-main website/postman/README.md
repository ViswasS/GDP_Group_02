# EdgeCare Postman Collection

## Files
- `EdgeCare-Auth-RBAC.postman_collection.json`
- `EdgeCare-Local.postman_environment.json`

## Import & Setup
1. Open Postman -> Import both JSON files.
2. Select the `EdgeCare-Local` environment.
3. Edit environment values for `patientEmail`, `patientPassword`, `doctorEmail`, `doctorPassword`, and (optionally) admin credentials to match your local users. Default `baseUrl` is `http://localhost:3000` (change if `PORT` differs).
4. Start the API server: `npm start` (or `npm run dev`) and ensure DB is migrated/seeded.

## Running the Flow (Runner recommended)
Recommended order in Postman Runner:
1. **Auth - Register**: Run "Register Patient" and "Register Doctor" (and Admin if desired). Skips are fine if users already exist.
2. **Auth - Login**: Run Patient, Doctor (and Admin). Tests store access/refresh tokens in environment variables.
3. **JWT Access Token Tests**: "Me (auth check)" uses `patientToken`.
4. **Refresh Token Flow**: Runs refresh + rotation, negative old-token check, logout, and post-logout failure check.
5. **RBAC - Positive**: Patient/Doctor profile endpoints should return 200 for correct roles.
6. **RBAC - Negative**: Cross-role calls should return 403.

## Cases (Happy Path)
- Run the **Auth - Login** folder first; make sure **Login Doctor** runs so it stores `doctorUserId` from the login response.
- Execute the **Cases** folder in order. It will create a case as a patient, assign the logged-in doctor using `doctorUserId`, update status as the doctor, delete as admin, and finally confirm the case returns 404.
- No doctor picker request is needed—the doctor id comes directly from the Doctor Login response.
