import assert from "node:assert/strict";
import test from "node:test";
import { createRailwayContext } from "railway/iac";
import define from "./railway.ts";

test("Railway provisions the Docker app and both database services", async () => {
  const definition = await define(createRailwayContext({ environment: "production" }));
  assert.equal(definition.name, "quiz");
  assert.equal(definition.resources.length, 3);
  const database = definition.resources.find((resource) => resource.engine === "postgres");
  const cache = definition.resources.find((resource) => resource.engine === "redis");
  const app = definition.resources.find((resource) => resource.name === "quiz");
  assert.ok(database.defaultMountPath);
  assert.ok(cache.defaultMountPath);
  assert.deepEqual(app.source, { type: "github", repo: "theashgen/quiz", branch: "main" });
  assert.equal(app.build.builder, "DOCKERFILE");
  assert.equal(app.build.dockerfilePath, "Dockerfile");
  assert.equal(app.deploy.startCommand, "/app/quiz");
  assert.equal(app.deploy.healthcheckPath, "/api/health");
  assert.equal(app.deploy.numReplicas, 1);
  assert.equal(app.deploy.restartPolicyType, "ON_FAILURE");
  assert.equal(app.variables.BEHIND_PROXY.value, "true");
  assert.equal(app.variables.LOCAL_HTTP, undefined);
  assert.deepEqual(app.variables.DATABASE_URL, {
    type: "reference", resource: database.address, output: "DATABASE_URL",
  });
  assert.deepEqual(app.variables.REDIS_URL, {
    type: "reference", resource: cache.address, output: "REDIS_URL",
  });
});
