export type DocumentLocationSource = "browser_geolocation" | "manual";

export type DocumentLocationMetadata = {
  label: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  capturedAt: string;
  source: DocumentLocationSource;
};

export type DocumentMetadata = {
  location?: DocumentLocationMetadata | null;
};

export const DOCUMENT_LOCATION_TIMEOUT_MS = 20000;

type DocumentLocationDraft = Partial<DocumentLocationMetadata> | null | undefined;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidSource(value: unknown): value is DocumentLocationSource {
  return value === "browser_geolocation" || value === "manual";
}

export function buildDocumentLocationMetadata(draft: DocumentLocationDraft): DocumentLocationMetadata | null {
  if (!draft || typeof draft !== "object") return null;

  const label = normalizeLabel(draft.label);
  const latitude = isFiniteNumber(draft.latitude) ? draft.latitude : null;
  const longitude = isFiniteNumber(draft.longitude) ? draft.longitude : null;
  const accuracyMeters = isFiniteNumber(draft.accuracyMeters) ? draft.accuracyMeters : null;
  const hasCoordinates = latitude !== null && longitude !== null;

  if (!label && !hasCoordinates) {
    return null;
  }

  return {
    label,
    latitude,
    longitude,
    accuracyMeters,
    capturedAt:
      typeof draft.capturedAt === "string" && draft.capturedAt.trim().length > 0
        ? draft.capturedAt
        : new Date().toISOString(),
    source: isValidSource(draft.source) ? draft.source : hasCoordinates ? "browser_geolocation" : "manual",
  };
}

export function parseDocumentLocationMetadata(value: unknown): DocumentLocationMetadata | null {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      return buildDocumentLocationMetadata(JSON.parse(value) as DocumentLocationDraft);
    } catch {
      return null;
    }
  }

  return buildDocumentLocationMetadata(value as DocumentLocationDraft);
}

export function parseDocumentMetadata(value: unknown): DocumentMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const metadata = value as { location?: unknown };
  const location = parseDocumentLocationMetadata(metadata.location);

  if (!location) return null;

  return { location };
}

export function formatDocumentCoordinates(location: DocumentLocationMetadata, digits = 5): string | null {
  if (location.latitude === null || location.longitude === null) return null;
  return `${location.latitude.toFixed(digits)}, ${location.longitude.toFixed(digits)}`;
}

export function getDocumentLocationDisplayName(
  location:
    | Pick<DocumentLocationMetadata, "label" | "latitude" | "longitude">
    | null
    | undefined,
  digits = 5
): string | null {
  if (!location) return null;

  const label = normalizeLabel(location.label);
  if (label) return label;

  if (location.latitude === null || location.longitude === null) return null;
  return `${location.latitude.toFixed(digits)}, ${location.longitude.toFixed(digits)}`;
}

export function buildDocumentLocationMapUrl(location: DocumentLocationMetadata): string | null {
  if (location.latitude === null || location.longitude === null) return null;
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}

export async function resolveLocationLabelFromCoordinates(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
    });
    const response = await fetch(`/api/location/reverse-geocode?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as { label?: unknown };
    return normalizeLabel(payload.label);
  } catch {
    return null;
  }
}

export function getGeolocationErrorMessage(
  t: (key: string) => string,
  error?: GeolocationPositionError | null
): string {
  let messageKey = "site.location_capture_failed";
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isFirefoxOnMac = /Firefox/i.test(userAgent) && /Mac OS X/i.test(userAgent);

  if (typeof window !== "undefined" && !window.isSecureContext) {
    messageKey = "site.geolocation_requires_secure_context";
    return t(messageKey);
  }

  if (!error) {
    return t(messageKey);
  }

  switch (error.code) {
    case error.PERMISSION_DENIED:
      messageKey = "site.location_permission_denied";
      break;
    case error.POSITION_UNAVAILABLE:
      messageKey = isFirefoxOnMac
        ? "site.location_unavailable_firefox_mac"
        : "site.location_unavailable";
      break;
    case error.TIMEOUT:
      messageKey = "site.location_request_timed_out";
      break;
    default:
      messageKey = "site.location_capture_failed";
      break;
  }

  return t(messageKey);
}
