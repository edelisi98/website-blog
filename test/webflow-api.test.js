import test from "node:test";
import assert from "node:assert/strict";
import { RequestBudgetError } from "../lib/request-budget.js";
import { webflowRequest } from "../lib/webflow-api.js";

test("bounds stalled Webflow API requests", async () => {
  const started = Date.now();

  await assert.rejects(
    webflowRequest("/sites/site/collections", {
      token: "test-token",
      fetchImpl: async () => new Promise(() => {}),
      requestTimeoutMs: 20,
      maxRetries: 0,
    }),
    RequestBudgetError
  );

  assert.ok(Date.now() - started < 250);
});

test("does not wait past the rebuild deadline for rate-limit retries", async () => {
  const response = new Response(
    JSON.stringify({ message: "Too Many Requests" }),
    {
      status: 429,
      headers: { "retry-after": "60" },
    }
  );

  await assert.rejects(
    webflowRequest("/sites/site/collections", {
      token: "test-token",
      fetchImpl: async () => response,
      deadline: Date.now() + 100,
      maxRetries: 1,
    }),
    RequestBudgetError
  );
});
