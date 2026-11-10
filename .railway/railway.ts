import { defineRailway, github, postgres, project, redis, service } from "railway/iac";

export default defineRailway(() => {
  const database = postgres("postgres");
  const cache = redis("redis");
  const app = service("quiz", {
    source: github("theashgen/quiz", { branch: "main" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    start: "/app/quiz",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    replicas: 1,
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 10 },
    env: {
      DATABASE_URL: database.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      BEHIND_PROXY: "true",
      STATIC_DIR: "/app/web/dist",
      MIGRATIONS_DIR: "/app/migrations",
    },
  });

  return project("quiz", { resources: [database, cache, app] });
});
