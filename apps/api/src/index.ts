import { buildServer } from "./server";
import { env } from "./env";

const app = buildServer();
app
  .listen({ port: env.API_PORT, host: "0.0.0.0" })
  .then(() => app.log.info(`harbor api on :${env.API_PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
