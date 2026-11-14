import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DomainError } from "../domain/errors.js";
import { createRouter } from "./router.js";

const DEFAULT_PUBLIC_DIR = fileURLToPath(new URL("../../public/", import.meta.url));
const MAX_JSON_BODY_BYTES = 1024 * 1024;
const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"]
]);

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  response.end(body);
}

function sendError(response, status, code, message) {
  sendJson(response, status, { error: { code, message } });
}

function sendCaughtError(response, error) {
  if (error instanceof DomainError) {
    const status = error.code === "NOT_FOUND" ? 404
      : error.code === "INVALID_TRANSITION" || error.code === "CONFLICT" || error.code === "SOLD_OUT" ? 409
        : 400;
    sendError(response, status, error.code, error.message);
    return;
  }

  if (error instanceof URIError) {
    sendError(response, 400, "BAD_REQUEST", "The request path is invalid");
    return;
  }

  sendError(response, 500, "INTERNAL_ERROR", "Internal server error");
}

async function readJsonBody(request) {
  const contentType = request.headers["content-type"] ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return undefined;
  }

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw new DomainError("JSON request body is too large", "PAYLOAD_TOO_LARGE");
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new DomainError("Request body must contain valid JSON", "BAD_JSON");
  }
}

function isWithinDirectory(directory, candidate) {
  const pathFromRoot = relative(directory, candidate);
  return pathFromRoot === "" ||
    (pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot));
}

async function serveStaticFile(request, response, pathname, publicDir) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    throw new URIError("Invalid URL encoding");
  }

  if (decodedPath.includes("\\") || decodedPath.includes("\0")) {
    return false;
  }

  const publicRoot = await realpath(publicDir);
  const relativePath = decodedPath === "/" ? "/index.html" : decodedPath;
  const requestedPath = resolve(publicRoot, `.${relativePath}`);
  if (!isWithinDirectory(publicRoot, requestedPath)) {
    return false;
  }

  let resolvedPath;
  try {
    resolvedPath = await realpath(requestedPath);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      return false;
    }
    throw error;
  }
  if (!isWithinDirectory(publicRoot, resolvedPath)) {
    return false;
  }

  const fileInfo = await stat(resolvedPath);
  if (!fileInfo.isFile()) {
    return false;
  }

  const body = await readFile(resolvedPath);
  response.writeHead(200, {
    "content-type": CONTENT_TYPES.get(extname(resolvedPath).toLowerCase()) ?? "application/octet-stream",
    "content-length": body.length
  });
  response.end(request.method === "HEAD" ? undefined : body);
  return true;
}

function createApplicationRouter(router) {
  router.get("/health", () => ({
    status: 200,
    body: { status: "ok" }
  }));
}

export function createApp({ router = createRouter(), publicDir = DEFAULT_PUBLIC_DIR } = {}) {
  createApplicationRouter(router);
  const staticRoot = resolve(publicDir);

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      const body = await readJsonBody(request);
      const route = router.match(request.method, url.pathname);

      if (route) {
        const result = await route.handler({
          request,
          params: route.params,
          body,
          url
        });
        const status = result?.status ?? 200;
        sendJson(response, status, result?.body ?? null);
        return;
      }

      if ((request.method === "GET" || request.method === "HEAD") &&
        !url.pathname.startsWith("/api/") && url.pathname !== "/api") {
        if (await serveStaticFile(request, response, url.pathname, staticRoot)) {
          return;
        }
      }

      sendError(response, 404, "NOT_FOUND", "Route or file not found");
    } catch (error) {
      if (error instanceof DomainError && error.code === "BAD_JSON") {
        sendError(response, 400, error.code, error.message);
        return;
      }
      if (error instanceof DomainError && error.code === "PAYLOAD_TOO_LARGE") {
        sendError(response, 413, error.code, error.message);
        return;
      }
      sendCaughtError(response, error);
    }
  });
}
