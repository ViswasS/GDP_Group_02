# Case Chat Events (Socket.IO)

## Connection & Auth
- Client connects to Socket.IO server with `auth: { token: "Bearer <access_jwt>" }` or `Authorization: Bearer <token>` header.
- Handshake verifies JWT with `JWT_ACCESS_SECRET`; connection is rejected with `UNAUTHORIZED` otherwise.
- `socket.data.user` contains `{ id, role, email }`.

## Rooms
- Event: `case:join`
  - Payload: `{ caseId: number }`
  - Server checks ACL (admin OR case.patientId OR case.assignedDoctorId).
  - On success: joins room `case:<caseId>` and emits `case:joined { caseId }`.
  - Errors: `case:error { code, message, caseId }`.

## Sending messages
- Event: `case:message:send`
  - Payload: `{ caseId:number, tempId?:string, content:string, type?: "TEXT"|"IMAGE"|"FILE" }`
  - ACL: same as join.
  - Server persists message then broadcasts:
    - `case:message:new` to room `case:<caseId>` with `{ id, caseId, conversationId, senderId, senderRole, content, type, createdAt, tempId? }`.
    - Ack to sender: `case:message:sent { tempId, id, caseId }`.
  - Errors: `case:error { code, message, tempId?, caseId? }`.

## Message fields
- `id` number (auto-increment)
- `caseId` number
- `conversationId` number
- `senderId` number
- `senderRole` string ("PATIENT" | "DOCTOR" | "ADMIN")
- `content` string
- `type` string ("TEXT" default; "IMAGE"/"FILE" allowed)
- `createdAt` ISO string
- `tempId` optional client-generated correlation id

## Error payload
```json
{ "code": 400 | 401 | 403 | 404 | "ERROR", "message": "detail", "tempId": "optional", "caseId": 5 }
```

## Client example
```js
import { io } from "socket.io-client";

const socket = io("https://edgecare.onrender.com", { auth: { token: "Bearer YOUR_JWT" } });

socket.on("connect", () => {
  socket.emit("case:join", { caseId: 5 });
});

socket.on("case:joined", ({ caseId }) => {
  socket.emit("case:message:send", { caseId, tempId: "tmp-123", content: "Hello doctor!" });
});

socket.on("case:message:new", console.log);
socket.on("case:error", console.error);
```
