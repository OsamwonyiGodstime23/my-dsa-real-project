function compilePath(path) {
  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new TypeError("Route path must be an absolute path");
  }

  const parameterNames = [];
  const segments = path.split("/").map((segment) => {
    if (segment.startsWith(":")) {
      const name = segment.slice(1);
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new TypeError(`Invalid route parameter: ${segment}`);
      }
      parameterNames.push(name);
      return "([^/]+)";
    }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });

  return {
    parameterNames,
    pattern: new RegExp(`^${segments.join("/")}/?$`)
  };
}

export function createRouter() {
  const routes = [];

  function register(method, path, handler) {
    if (typeof method !== "string" || method.trim() === "") {
      throw new TypeError("Route method must be a non-empty string");
    }
    if (typeof handler !== "function") {
      throw new TypeError("Route handler must be a function");
    }
    routes.push({
      method: method.toUpperCase(),
      ...compilePath(path),
      handler
    });
    return router;
  }

  const router = {
    register,
    get(path, handler) {
      return register("GET", path, handler);
    },
    post(path, handler) {
      return register("POST", path, handler);
    },
    match(method, path) {
      const requestedMethod = typeof method === "string" ? method.toUpperCase() : "";
      for (const route of routes) {
        if (route.method !== requestedMethod) {
          continue;
        }

        const match = route.pattern.exec(path);
        if (match) {
          const params = {};
          route.parameterNames.forEach((name, index) => {
            params[name] = decodeURIComponent(match[index + 1]);
          });
          return { handler: route.handler, params };
        }
      }
      return null;
    }
  };

  return router;
}
