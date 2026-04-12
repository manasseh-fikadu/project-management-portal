import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

type ReverseGeocodeResult = {
  display_name?: string;
  name?: string;
  address?: Record<string, string | undefined>;
};

function parseCoordinate(value: string | null, min: number, max: number): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}

function joinUniqueParts(parts: Array<string | null | undefined>): string | null {
  const cleaned: string[] = [];

  for (const part of parts) {
    const trimmed = part?.trim();
    if (!trimmed) continue;
    if (cleaned.includes(trimmed)) continue;
    cleaned.push(trimmed);
  }

  return cleaned.length > 0 ? cleaned.join(", ") : null;
}

function buildLocationLabel(result: ReverseGeocodeResult): string | null {
  const address = result.address ?? {};

  const site = joinUniqueParts([
    address.amenity,
    address.building,
    address.shop,
    address.office,
    address.tourism,
    address.leisure,
    address.road,
  ]);

  const locality = joinUniqueParts([
    address.suburb,
    address.neighbourhood,
    address.borough,
    address.quarter,
    address.city_district,
    address.city,
    address.town,
    address.village,
    address.municipality,
  ]);

  const region = joinUniqueParts([
    address.state_district,
    address.county,
    address.state,
    address.region,
  ]);

  const country = address.country?.trim() || null;

  return (
    joinUniqueParts([site, locality, region, country]) ||
    joinUniqueParts([locality, region, country]) ||
    result.name?.trim() ||
    result.display_name?.trim() ||
    null
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const latitude = parseCoordinate(request.nextUrl.searchParams.get("lat"), -90, 90);
    const longitude = parseCoordinate(request.nextUrl.searchParams.get("lon"), -180, 180);

    if (latitude === null || longitude === null) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }

    const nominatimUrl = new URL("https://nominatim.openstreetmap.org/reverse");
    nominatimUrl.searchParams.set("format", "jsonv2");
    nominatimUrl.searchParams.set("lat", latitude.toString());
    nominatimUrl.searchParams.set("lon", longitude.toString());
    nominatimUrl.searchParams.set("zoom", "18");
    nominatimUrl.searchParams.set("addressdetails", "1");

    const response = await fetch(nominatimUrl.toString(), {
      headers: {
        "Accept-Language": request.headers.get("accept-language") || "en",
        "User-Agent": "MoTRI Project Management Portal/1.0",
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ label: null }, { status: 200 });
    }

    const result = (await response.json()) as ReverseGeocodeResult;
    return NextResponse.json({ label: buildLocationLabel(result) }, { status: 200 });
  } catch (error) {
    console.error("Error reverse geocoding location:", error);
    return NextResponse.json({ label: null }, { status: 200 });
  }
}
