import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/resources/route.js";

test("serves the fallback index with shared caching and ETag revalidation", async () => {
  const first = await GET(
    new Request("https://resource-api.example/api/resources?source=fallback")
  );
  const etag = first.headers.get("etag");

  assert.equal(first.status, 200);
  assert.match(first.headers.get("cache-control"), /s-maxage=300/);
  assert.match(first.headers.get("cache-control"), /stale-while-revalidate=3600/);
  assert.ok(etag);

  const second = await GET(
    new Request("https://resource-api.example/api/resources?source=fallback", {
      headers: { "if-none-match": etag },
    })
  );

  assert.equal(second.status, 304);
  assert.equal(second.headers.get("etag"), etag);
  assert.equal(await second.text(), "");
});
