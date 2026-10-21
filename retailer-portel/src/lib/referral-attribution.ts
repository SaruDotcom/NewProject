const REFERRAL_CODE_KEY = "nexora_retailer_referral_code";
const REFERRAL_TIME_KEY = "nexora_retailer_referral_time";
const ATTRIBUTION_KEY = "nexora_retailer_referral_attribution";
const SESSION_ATTRIBUTION_KEY = "nexora_retailer_referral_attribution";
const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface ReferralAttribution {
  code: string;
  firstLandingAt: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
}

function readAttribution(storage: Storage): ReferralAttribution | null {
  try {
    const stored = storage.getItem(ATTRIBUTION_KEY);
    if (stored) {
      const attribution = JSON.parse(stored) as Partial<ReferralAttribution>;
      if (
        typeof attribution.code === "string" &&
        typeof attribution.firstLandingAt === "string"
      ) {
        return {
          code: attribution.code.trim().toUpperCase(),
          firstLandingAt: attribution.firstLandingAt,
          utmSource:
            typeof attribution.utmSource === "string"
              ? attribution.utmSource
              : "",
          utmMedium:
            typeof attribution.utmMedium === "string"
              ? attribution.utmMedium
              : "",
          utmCampaign:
            typeof attribution.utmCampaign === "string"
              ? attribution.utmCampaign
              : "",
          utmTerm:
            typeof attribution.utmTerm === "string" ? attribution.utmTerm : "",
          utmContent:
            typeof attribution.utmContent === "string"
              ? attribution.utmContent
              : "",
        };
      }
    }

    const legacyCode = storage.getItem(REFERRAL_CODE_KEY);
    const legacyTime = storage.getItem(REFERRAL_TIME_KEY);
    if (!legacyCode || !legacyTime) return null;
    const timestamp = Number(legacyTime);
    if (!Number.isFinite(timestamp)) return null;
    const firstLandingAt = new Date(timestamp);
    if (Number.isNaN(firstLandingAt.getTime())) return null;
    return {
      code: legacyCode.trim().toUpperCase(),
      firstLandingAt: firstLandingAt.toISOString(),
      utmSource: "",
      utmMedium: "",
      utmCampaign: "",
      utmTerm: "",
      utmContent: "",
    };
  } catch (error) {
    console.warn("Could not read saved referral attribution", error);
    return null;
  }
}

function isUnexpired(attribution: ReferralAttribution): boolean {
  const timestamp = Date.parse(attribution.firstLandingAt);
  const now = Date.now();
  return (
    Number.isFinite(timestamp) &&
    timestamp <= now &&
    now - timestamp <= REFERRAL_TTL_MS
  );
}

export function getStoredReferralAttribution(): ReferralAttribution | null {
  if (typeof window === "undefined") return null;
  let attribution: ReferralAttribution | null = null;
  try {
    attribution = readAttribution(window.localStorage);
  } catch (error) {
    console.warn("Could not access local referral storage", error);
  }
  if (!attribution) {
    try {
      attribution = readAttribution(window.sessionStorage);
    } catch (error) {
      console.warn("Could not access session referral storage", error);
    }
  }
  if (!attribution) return null;
  if (!isUnexpired(attribution)) {
    clearStoredReferralAttribution();
    return null;
  }
  return attribution;
}

export function getReferralAttributionFromUrl(
  url: URL,
): ReferralAttribution | null {
  let rawCode = url.searchParams.get("ref");
  if (!rawCode) {
    const pathMatch = url.pathname.match(/^\/r\/([^/]+)\/?$/i);
    if (pathMatch) {
      try {
        rawCode = decodeURIComponent(pathMatch[1]);
      } catch {
        rawCode = pathMatch[1];
      }
    }
  }
  const code = rawCode?.trim().toUpperCase();
  if (!code) return null;

  const savedAttribution = getStoredReferralAttribution();
  if (savedAttribution?.code === code) return savedAttribution;

  return {
    code,
    firstLandingAt: new Date().toISOString(),
    utmSource: (url.searchParams.get("utm_source") || "").slice(0, 100),
    utmMedium: (url.searchParams.get("utm_medium") || "").slice(0, 100),
    utmCampaign: (url.searchParams.get("utm_campaign") || "").slice(0, 100),
    utmTerm: (url.searchParams.get("utm_term") || "").slice(0, 100),
    utmContent: (url.searchParams.get("utm_content") || "").slice(0, 100),
  };
}

export function createReferralAttribution(
  code: string,
  url: URL,
): ReferralAttribution {
  const cleanCode = code.trim().toUpperCase();
  const attribution = getReferralAttributionFromUrl(url);
  return {
    code: cleanCode,
    firstLandingAt: new Date().toISOString(),
    utmSource: attribution?.utmSource || "",
    utmMedium: attribution?.utmMedium || "",
    utmCampaign: attribution?.utmCampaign || "",
    utmTerm: attribution?.utmTerm || "",
    utmContent: attribution?.utmContent || "",
  };
}

export function saveReferralAttribution(
  attribution: ReferralAttribution,
): void {
  if (typeof window === "undefined") return;
  const cleanAttribution = {
    ...attribution,
    code: attribution.code.trim().toUpperCase(),
  };
  const serialized = JSON.stringify(cleanAttribution);
  try {
    window.localStorage.setItem(ATTRIBUTION_KEY, serialized);
    window.localStorage.setItem(REFERRAL_CODE_KEY, cleanAttribution.code);
    window.localStorage.setItem(
      REFERRAL_TIME_KEY,
      String(Date.parse(cleanAttribution.firstLandingAt)),
    );
  } catch (error) {
    console.warn("Could not save referral attribution to local storage", error);
  }
  try {
    window.sessionStorage.setItem(SESSION_ATTRIBUTION_KEY, serialized);
  } catch (error) {
    console.warn(
      "Could not save referral attribution to session storage",
      error,
    );
  }
}

export function clearStoredReferralAttribution(): void {
  if (typeof window === "undefined") return;
  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[storageName];
      storage.removeItem(ATTRIBUTION_KEY);
      storage.removeItem(REFERRAL_CODE_KEY);
      storage.removeItem(REFERRAL_TIME_KEY);
    } catch (error) {
      console.warn("Could not clear saved referral attribution", error);
    }
  }
}
