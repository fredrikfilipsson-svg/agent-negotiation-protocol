"use client";

import { useMemo, useState } from "react";
import { formatErrors, validateOffer } from "./validation";

interface LineItemDraft {
  sku: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
}

function defaultExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + 21);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().replace(".000Z", "Z");
}

const inputClass =
  "w-full rounded-md border border-line bg-canvas px-2.5 py-1.5 font-mono text-xs focus:border-accent";
const labelClass = "block text-[11px] font-medium text-muted";

/** Build the offer payload from the drafts, dropping empty optional fields. */
function buildOffer(
  currency: string,
  termMonths: string,
  expiresAt: string,
  items: LineItemDraft[],
  conditions: string,
  notes: string,
): Record<string, unknown> {
  return {
    currency,
    term_months: termMonths === "" ? undefined : Number(termMonths),
    expires_at: expiresAt,
    line_items: items.map((item) => ({
      sku: item.sku || undefined,
      description: item.description,
      quantity: item.quantity === "" ? undefined : Number(item.quantity),
      unit: item.unit,
      unit_price: item.unit_price === "" ? undefined : Number(item.unit_price),
      currency,
    })),
    conditions:
      conditions.trim() === ""
        ? undefined
        : conditions
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
    notes: notes.trim() === "" ? undefined : notes.trim(),
  };
}

/**
 * Compose an offer (validated live against offer.schema.json) or a free
 * text message.
 */
export function OfferComposer({
  onSendOffer,
  onSendMessage,
  busy,
}: {
  onSendOffer: (payload: unknown) => void;
  onSendMessage: (body: string) => void;
  busy: boolean;
}) {
  const [tab, setTab] = useState<"offer" | "message">("offer");
  const [currency, setCurrency] = useState("USD");
  const [termMonths, setTermMonths] = useState("12");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [items, setItems] = useState<LineItemDraft[]>([
    {
      sku: "CRM-ENT",
      description: "CRM Enterprise seats",
      quantity: "500",
      unit: "seat/year",
      unit_price: "1200",
    },
  ]);
  const [conditions, setConditions] = useState("Net 30 payment");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState(
    "We can be flexible on term length if the seat price holds.",
  );

  const offer = useMemo(
    () => buildOffer(currency, termMonths, expiresAt, items, conditions, notes),
    [currency, termMonths, expiresAt, items, conditions, notes],
  );
  const offerValid = useMemo(() => validateOffer(offer), [offer]);
  const offerErrors = offerValid ? [] : formatErrors(validateOffer.errors);

  const setItem = (index: number, patch: Partial<LineItemDraft>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  return (
    <div>
      <div role="tablist" aria-label="Event kind" className="flex gap-1">
        {(["offer", "message"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-t-md border border-b-0 px-3 py-1.5 text-xs font-medium ${
              tab === t
                ? "border-line bg-inset text-fg"
                : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t === "offer" ? "Structured offer" : "Free text message"}
          </button>
        ))}
      </div>

      <div className="rounded-b-md rounded-tr-md border border-line bg-inset p-4">
        {tab === "offer" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="offer-currency" className={labelClass}>
                  currency
                </label>
                <input
                  id="offer-currency"
                  className={inputClass}
                  value={currency}
                  maxLength={3}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label htmlFor="offer-term" className={labelClass}>
                  term_months
                </label>
                <input
                  id="offer-term"
                  className={inputClass}
                  inputMode="numeric"
                  value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="offer-expires" className={labelClass}>
                  expires_at
                </label>
                <input
                  id="offer-expires"
                  className={inputClass}
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <fieldset>
              <legend className={labelClass}>line_items</legend>
              <div className="mt-1 space-y-2">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-2 gap-2 rounded-md border border-line p-2 sm:grid-cols-5"
                  >
                    <input
                      aria-label={`line item ${i + 1} sku`}
                      placeholder="sku"
                      className={inputClass}
                      value={item.sku}
                      onChange={(e) => setItem(i, { sku: e.target.value })}
                    />
                    <input
                      aria-label={`line item ${i + 1} description`}
                      placeholder="description"
                      className={inputClass}
                      value={item.description}
                      onChange={(e) =>
                        setItem(i, { description: e.target.value })
                      }
                    />
                    <input
                      aria-label={`line item ${i + 1} quantity`}
                      placeholder="quantity"
                      inputMode="decimal"
                      className={inputClass}
                      value={item.quantity}
                      onChange={(e) => setItem(i, { quantity: e.target.value })}
                    />
                    <input
                      aria-label={`line item ${i + 1} unit`}
                      placeholder="unit"
                      className={inputClass}
                      value={item.unit}
                      onChange={(e) => setItem(i, { unit: e.target.value })}
                    />
                    <div className="flex gap-1">
                      <input
                        aria-label={`line item ${i + 1} unit price`}
                        placeholder="unit_price"
                        inputMode="decimal"
                        className={inputClass}
                        value={item.unit_price}
                        onChange={(e) =>
                          setItem(i, { unit_price: e.target.value })
                        }
                      />
                      {items.length > 1 ? (
                        <button
                          type="button"
                          aria-label={`remove line item ${i + 1}`}
                          className="rounded-md border border-line px-2 text-xs text-muted hover:border-bad hover:text-bad"
                          onClick={() =>
                            setItems((prev) => prev.filter((_, j) => j !== i))
                          }
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="mt-2 rounded-md border border-line-strong px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    {
                      sku: "",
                      description: "",
                      quantity: "1",
                      unit: "unit",
                      unit_price: "0",
                    },
                  ])
                }
              >
                Add line item
              </button>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="offer-conditions" className={labelClass}>
                  conditions (one per line)
                </label>
                <textarea
                  id="offer-conditions"
                  rows={2}
                  className={inputClass}
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="offer-notes" className={labelClass}>
                  notes
                </label>
                <textarea
                  id="offer-notes"
                  rows={2}
                  className={inputClass}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {offerErrors.length > 0 ? (
              <ul
                className="space-y-1 rounded-md border border-bad/40 bg-bad-soft p-3 font-mono text-[11px] text-bad"
                aria-live="polite"
              >
                {offerErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            ) : (
              <p className="font-mono text-[11px] text-ok" aria-live="polite">
                valid against offer.schema.json
              </p>
            )}

            <button
              type="button"
              disabled={!offerValid || busy}
              onClick={() => onSendOffer(offer)}
              className="rounded-md bg-accent px-4 py-2 text-xs font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Sign and send offer"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label htmlFor="message-body" className={labelClass}>
              body
            </label>
            <textarea
              id="message-body"
              rows={4}
              className={inputClass}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button
              type="button"
              disabled={message.trim() === "" || busy}
              onClick={() => onSendMessage(message.trim())}
              className="rounded-md bg-accent px-4 py-2 text-xs font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Sign and send message"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
