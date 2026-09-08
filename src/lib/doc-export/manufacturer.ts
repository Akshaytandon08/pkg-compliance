import type { LegalRoleFacts } from "../../db/schema.ts";

// Derive who the MANUFACTURER is under Regulation (EU) 2025/40, from the recorded
// legal-role facts, per the Commission PPWR FAQ interpretation (see eval/README.md):
//   - branded            → the trademark owner is the manufacturer;
//   - unbranded + standardised → the physical producer is the manufacturer;
//   - unbranded + custom → the party that defined the specification is the manufacturer.
//
// A non-EU party is STILL the manufacturer (Art 3(1)(13)) and still draws up the DoC
// (Art 15); EU establishment affects only importer verification (Art 18) and any
// authorised-representative requirement. It is therefore NOT part of this derivation.
//
// The DoC may be drawn up by the assessing user only when the derivation points to a
// single manufacturer that is the user's own organisation (or the user has declared
// they act for that manufacturer). Otherwise the result names the actual party and
// why — never a silent assignment (brief §2).

export type ManufacturerParty = "user" | "customer" | "supplier" | "physical_producer" | "unknown";

export interface ManufacturerDerivation {
  party: ManufacturerParty;
  // True when the manufacturer is unambiguously the assessing user's organisation.
  isAssessingUser: boolean;
  // Plain-language basis for the determination (shown on the draft / in reasons).
  basis: string;
  // Set when the manufacturer is NOT the user (or cannot be determined) — the exact
  // ambiguity, for the disabled-button reason.
  reason?: string;
}

export function deriveManufacturer(facts: LegalRoleFacts | undefined): ManufacturerDerivation {
  const f = facts ?? {};
  const branded = f.packaging_branded;
  const mode = f.custom_vs_standardised;
  const spec = f.spec_defined_by;

  // Branded → the trademark owner is the manufacturer. The trademark owner is read
  // from who owns/defines the product: the user's own brand (spec by the user) is
  // the user; a customer's or supplier's brand is that party.
  if (branded === true) {
    if (spec === "user" || spec === undefined) {
      return { party: "user", isAssessingUser: true, basis: "branded with your own trademark — you are the manufacturer (trademark owner)." };
    }
    if (spec === "customer") {
      return {
        party: "customer",
        isAssessingUser: false,
        basis: "branded with your customer's trademark.",
        reason: "branded with your customer's trademark; the trademark owner (your customer) is the manufacturer under the Commission's interpretation.",
      };
    }
    return {
      party: "supplier",
      isAssessingUser: false,
      basis: "branded with your supplier's trademark.",
      reason: "branded with your supplier's trademark; the trademark owner (your supplier) is the manufacturer under the Commission's interpretation.",
    };
  }

  if (branded === false) {
    // Unbranded + custom → the specification-definer is the manufacturer.
    if (mode === "custom") {
      if (spec === "user") {
        return { party: "user", isAssessingUser: true, basis: "unbranded, custom-made; you defined the specification — you are the manufacturer." };
      }
      if (spec === "customer") {
        return {
          party: "customer",
          isAssessingUser: false,
          basis: "unbranded, custom-made; specification defined by your customer.",
          reason: "unbranded, custom-made; specification defined by your customer, who is therefore the manufacturer under the Commission's interpretation.",
        };
      }
      if (spec === "supplier") {
        return {
          party: "supplier",
          isAssessingUser: false,
          basis: "unbranded, custom-made; specification defined by your supplier.",
          reason: "unbranded, custom-made; specification defined by your supplier, who is therefore the manufacturer under the Commission's interpretation.",
        };
      }
      return { party: "unknown", isAssessingUser: false, basis: "unbranded, custom-made; specification-definer not recorded.", reason: "unbranded, custom-made, but who defined the specification is not recorded — the manufacturer cannot be determined." };
    }
    // Unbranded + standardised → the physical producer is the manufacturer. The
    // physical producer's identity is not captured, so it cannot be assumed to be
    // the user; the user confirms (or declares they act for the producer).
    if (mode === "standardised") {
      return {
        party: "physical_producer",
        isAssessingUser: false,
        basis: "unbranded, standardised; the physical producer of the packaging is the manufacturer.",
        reason: "unbranded, standardised: the physical producer of the packaging is the manufacturer — confirm your organisation is the physical producer, or declare that you act for them.",
      };
    }
    return { party: "unknown", isAssessingUser: false, basis: "unbranded; custom-vs-standardised not recorded.", reason: "unbranded, but whether the packaging is custom or standardised is not recorded — the manufacturer cannot be determined." };
  }

  return { party: "unknown", isAssessingUser: false, basis: "whether the packaging is branded is not recorded.", reason: "whether the packaging carries a trademark is not recorded — the manufacturer cannot be determined." };
}

/** Whether the assessing user may draw up the DoC — the manufacturer is the user, OR
 *  the user has declared they act for the derived manufacturer. */
export function userMayDrawUp(facts: LegalRoleFacts | undefined): { ok: boolean; derivation: ManufacturerDerivation } {
  const derivation = deriveManufacturer(facts);
  const actsFor = facts?.acts_for_manufacturer === true;
  return { ok: derivation.isAssessingUser || (derivation.party !== "unknown" && actsFor), derivation };
}
