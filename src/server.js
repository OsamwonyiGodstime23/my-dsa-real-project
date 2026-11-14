import { createApp } from "./http/app.js";
import { config } from "./config.js";

const server = createApp();
server.listen(config.port, () => {
  console.log(`Event ticketing server listening on port ${config.port}`);
});
