export function loadConfig(environment = process.env) {
  const configuredPort = environment.PORT ?? "3000";
  const port = Number(configuredPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TypeError("PORT must be a whole number between 1 and 65535");
  }
  return Object.freeze({ port });
}

export const config = loadConfig();
