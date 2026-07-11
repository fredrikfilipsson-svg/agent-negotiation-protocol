import { describe, expect, it } from "vitest";
import { canonicalJson, canonicalJsonBytes } from "../canonicalJson";

describe("canonicalJson", () => {
  it("sorts object keys lexicographically at every depth", () => {
    const value = {
      zebra: 1,
      apple: { nested_z: true, nested_a: [{ b: 2, a: 1 }] },
      "1number": null,
    };
    expect(canonicalJson(value)).toBe(
      '{"1number":null,"apple":{"nested_a":[{"a":1,"b":2}],"nested_z":true},"zebra":1}',
    );
  });

  it("is byte-for-byte deterministic across insertion orders", () => {
    const a: Record<string, unknown> = {};
    a.currency = "USD";
    a.term_months = 12;
    a.line_items = [{ quantity: 500, description: "seats" }];

    const b: Record<string, unknown> = {};
    b.line_items = [{ description: "seats", quantity: 500 }];
    b.term_months = 12;
    b.currency = "USD";

    const bytesA = canonicalJsonBytes(a);
    const bytesB = canonicalJsonBytes(b);
    expect(bytesA).toEqual(bytesB);
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it("emits no insignificant whitespace", () => {
    const out = canonicalJson({ a: [1, 2, { b: "c d" }] });
    expect(out).toBe('{"a":[1,2,{"b":"c d"}]}');
  });

  it("drops object members whose value is undefined", () => {
    expect(canonicalJson({ a: 1, gone: undefined, b: 2 })).toBe(
      '{"a":1,"b":2}',
    );
  });

  it("preserves array order and does not sort arrays", () => {
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
  });

  it("handles unicode and escapes exactly like JSON.stringify", () => {
    const value = { "kéy": "väl\nue   😀" };
    expect(canonicalJson(value)).toBe(JSON.stringify(value));
  });

  it("encodes to UTF-8 bytes", () => {
    const bytes = canonicalJsonBytes({ a: "é" });
    // {"a":"é"} with é as 0xC3 0xA9
    expect(Array.from(bytes)).toEqual([
      0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xc3, 0xa9, 0x22, 0x7d,
    ]);
  });

  it("serializes numbers like JSON.stringify", () => {
    expect(canonicalJson({ a: 1e21, b: 0.1, c: -0, d: 1140 })).toBe(
      '{"a":1e+21,"b":0.1,"c":0,"d":1140}',
    );
  });

  it("rejects values with no canonical form", () => {
    expect(() => canonicalJson(undefined)).toThrow(TypeError);
    expect(() => canonicalJson({ a: 1n })).toThrow(TypeError);
    expect(() => canonicalJson({ a: NaN })).toThrow(TypeError);
    expect(() => canonicalJson({ a: Infinity })).toThrow(TypeError);
    expect(() => canonicalJson({ a: () => 1 })).toThrow(TypeError);
    expect(() => canonicalJson([undefined])).toThrow(TypeError);
  });

  it("rejects circular references instead of overflowing", () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(() => canonicalJson(a)).toThrow(/circular/);
  });

  it("allows repeated (non circular) references to the same object", () => {
    const shared = { x: 1 };
    expect(canonicalJson({ a: shared, b: shared })).toBe(
      '{"a":{"x":1},"b":{"x":1}}',
    );
  });
});
