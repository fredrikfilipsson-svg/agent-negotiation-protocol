/**
 * Client-side JSON Schema validation for the playground, against the same
 * schema files served at /schemas/*. The schemas are imported directly from
 * protocol/schemas/ so they stay single source.
 */

import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import envelopeSchema from "../../../protocol/schemas/envelope.schema.json";
import offerSchema from "../../../protocol/schemas/offer.schema.json";

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

export const validateEnvelope: ValidateFunction = ajv.compile(envelopeSchema);
export const validateOffer: ValidateFunction = ajv.compile(offerSchema);

/** Flatten Ajv errors into short human-readable lines. */
export function formatErrors(
  errors: ErrorObject[] | null | undefined,
): string[] {
  if (!errors) return [];
  return errors.map((err) => {
    const where = err.instancePath === "" ? "(root)" : err.instancePath;
    if (err.keyword === "additionalProperties") {
      const extra = (err.params as { additionalProperty?: string })
        .additionalProperty;
      return `${where}: unknown key "${extra}" (unknown keys are rejected, not ignored)`;
    }
    return `${where} ${err.message ?? "is invalid"}`;
  });
}
