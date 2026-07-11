import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalRequestString, generateIdentity } from "../signing";
import { verifySignature } from "../signing";
import { EMPTY_BODY_SHA256, sha256Hex } from "../encoding";
import {
  AnpClientError,
  fetchLog,
  register,
  sendEvent,
  signedHeaders,
} from "../client";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("signedHeaders", () => {
  it("produces the four headers and a signature that verifies over the canonical request string", async () => {
    const identity = await generateIdentity();
    identity.agentId = "2b9d0c4a-7e35-4f61-9a02-c1d8e6b47a90";

    const body = '{"target":{"sandbox":true}}';
    const headers = await signedHeaders(
      identity,
      "POST",
      "/api/agent/v1/sessions",
      body,
    );

    expect(headers["x-anp-agent"]).toBe(identity.agentId);
    expect(headers["x-anp-nonce"].length).toBeLessThanOrEqual(120);
    expect(new Date(headers["x-anp-timestamp"]).toString()).not.toBe(
      "Invalid Date",
    );

    const expectedString = canonicalRequestString(
      "POST",
      "/api/agent/v1/sessions",
      headers["x-anp-timestamp"],
      headers["x-anp-nonce"],
      await sha256Hex(body),
    );
    expect(
      await verifySignature(
        identity.publicKey,
        headers["x-anp-signature"],
        expectedString,
      ),
    ).toBe(true);
  });

  it("hashes the empty string for bodyless requests", async () => {
    const identity = await generateIdentity();
    identity.agentId = "agent-id";
    const headers = await signedHeaders(identity, "GET", "/api/agent/v1/x");
    const expectedString = canonicalRequestString(
      "GET",
      "/api/agent/v1/x",
      headers["x-anp-timestamp"],
      headers["x-anp-nonce"],
      EMPTY_BODY_SHA256,
    );
    expect(
      await verifySignature(
        identity.publicKey,
        headers["x-anp-signature"],
        expectedString,
      ),
    ).toBe(true);
  });

  it("refuses to sign before registration assigns an agent id", async () => {
    const identity = await generateIdentity();
    await expect(signedHeaders(identity, "GET", "/x")).rejects.toThrow(
      /register/,
    );
  });
});

describe("register", () => {
  it("POSTs the public key with a possession proof and stores the agent id", async () => {
    const identity = await generateIdentity();
    const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, string>;
      expect(String(input)).toBe("https://buyer.example/api/agent/v1/register");
      expect(body.public_key).toBe(identity.publicKey);
      expect(body.agent_name).toBe("Test Agent");
      // The proof must verify over the section 2 registration string.
      expect(
        await verifySignature(
          identity.publicKey,
          body.proof,
          `ANP/0.1\nregister\n${identity.publicKey}`,
        ),
      ).toBe(true);
      return jsonResponse({
        agent_id: "aaaa-bbbb",
        fingerprint: identity.fingerprint,
        status: "sandbox",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await register("https://buyer.example", identity, {
      agent_name: "Test Agent",
      vendor_name: "Test Vendor",
      contact_email: "dev@example.com",
    });
    expect(result.agentId).toBe("aaaa-bbbb");
    expect(result.status).toBe("sandbox");
    expect(identity.agentId).toBe("aaaa-bbbb");
  });

  it("surfaces the host's uniform error shape", async () => {
    const identity = await generateIdentity();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: { code: "rate_limited", message: "try again later" },
            protocol: "ANP/0.1",
          },
          429,
        ),
      ),
    );
    await expect(
      register("https://buyer.example", identity, {
        agent_name: "a",
        vendor_name: "v",
        contact_email: "e@example.com",
      }),
    ).rejects.toMatchObject({
      name: "AnpClientError",
      code: "rate_limited",
      status: 429,
    } satisfies Partial<AnpClientError>);
  });
});

describe("sendEvent and fetchLog", () => {
  it("signs the authorship string over the canonical payload hash", async () => {
    const identity = await generateIdentity();
    identity.agentId = "aaaa-bbbb";
    const payload = { b: 2, a: 1 };
    const canonicalHash = await sha256Hex('{"a":1,"b":2}');

    const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/api/agent/v1/sessions/sess-1/events");
      const body = JSON.parse(String(init?.body)) as {
        kind: string;
        payload: unknown;
        signature: string;
      };
      expect(body.kind).toBe("message");
      expect(
        await verifySignature(
          identity.publicKey,
          body.signature,
          `ANP/0.1\nmessage\n${canonicalHash}`,
        ),
      ).toBe(true);
      const headers = init?.headers as Record<string, string>;
      expect(headers["x-anp-agent"]).toBe("aaaa-bbbb");
      return jsonResponse({ log: { protocol: "ANP/0.1", session: { id: "sess-1" }, events: [] } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const log = await sendEvent(
      "https://buyer.example",
      identity,
      "sess-1",
      "message",
      payload,
    );
    expect(log.session.id).toBe("sess-1");
  });

  it("fetches the log with a signed bodyless GET", async () => {
    const identity = await generateIdentity();
    identity.agentId = "aaaa-bbbb";
    const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/api/agent/v1/sessions/sess-1/log");
      expect(init?.method).toBe("GET");
      expect(init?.body).toBeUndefined();
      return jsonResponse({ protocol: "ANP/0.1", session: { id: "sess-1" }, events: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const log = await fetchLog("https://buyer.example", identity, "sess-1");
    expect(log.session.id).toBe("sess-1");
  });
});
