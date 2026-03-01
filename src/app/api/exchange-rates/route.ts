import { NextResponse } from "next/server";

type RatesCache = {
  rates: Record<string, number>;
  fetchedAt: number;
};

let cache: RatesCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const FALLBACK_RATES: Record<string, number> = {
  ETB: 1,
  USD: 0.017,
  EUR: 0.016,
};

export async function GET() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ rates: cache.rates, cached: true });
  }

  try {
    const res = await fetch(
      "https://api.exchangerate-api.com/v4/latest/ETB",
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) throw new Error(`Exchange rate API returned ${res.status}`);

    const data = await res.json();
    const rates: Record<string, number> = {
      ETB: 1,
      USD: data.rates?.USD ?? FALLBACK_RATES.USD,
      EUR: data.rates?.EUR ?? FALLBACK_RATES.EUR,
    };

    cache = { rates, fetchedAt: Date.now() };
    return NextResponse.json({ rates, cached: false });
  } catch (error) {
    console.error("Failed to fetch exchange rates, using fallback:", error);
    return NextResponse.json({ rates: FALLBACK_RATES, cached: false, fallback: true });
  }
}
