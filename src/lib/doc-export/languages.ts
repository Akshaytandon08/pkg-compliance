// Primary official language per curated EU Member State, for offering DoC draft
// languages. English is always available and generated first; a non-English
// version carries a "translation to be verified by the manufacturer" notice, since
// the legal text is reproduced in English (the Annex language), not machine-translated.
const MS_LANGUAGE: Record<string, { code: string; label: string }> = {
  DE: { code: "de", label: "German" },
  FR: { code: "fr", label: "French" },
  IT: { code: "it", label: "Italian" },
  ES: { code: "es", label: "Spanish" },
  NL: { code: "nl", label: "Dutch" },
  BE: { code: "nl", label: "Dutch" },
  PL: { code: "pl", label: "Polish" },
  SE: { code: "sv", label: "Swedish" },
  AT: { code: "de", label: "German" },
  IE: { code: "en", label: "English" },
};

export interface LanguageOption {
  code: string;
  label: string;
}

/** Distinct non-English language options implied by the destination Member States. */
export function languageOptionsFor(memberStates: string[]): LanguageOption[] {
  const seen = new Map<string, LanguageOption>();
  for (const ms of memberStates) {
    const lang = MS_LANGUAGE[ms.toUpperCase()];
    if (lang && lang.code !== "en" && !seen.has(lang.code)) seen.set(lang.code, lang);
  }
  return [...seen.values()];
}
