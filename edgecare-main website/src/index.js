const http = require("http");
const { createApp } = require("./app");
const { env } = require("./config/env");
const { initSocket } = require("./socket");

const app = createApp();
const server = http.createServer(app);
initSocket(server);

server.listen(env.PORT, () => {
  console.log(`EdgeCare running on http://localhost:${env.PORT}`);
});
