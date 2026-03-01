"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import {
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
  type ExchangeRates,
  convertCurrency,
} from "@/lib/currency";

let ratesCache: { rates: ExchangeRates; ts: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

async function fetchRates(): Promise<ExchangeRates> {
  if (ratesCache && Date.now() - ratesCache.ts < CACHE_TTL) {
    return ratesCache.rates;
  }
  try {
    const res = await fetch("/api/exchange-rates");
    const data = await res.json();
    ratesCache = { rates: data.rates, ts: Date.now() };
    return data.rates;
  } catch {
    return { ETB: 1, USD: 0.017, EUR: 0.016 };
  }
}

interface CurrencyInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  currency?: CurrencyCode;
  /** When provided, switching currencies also calls this with the new currency.
   *  The value is still converted. The parent should update its stored currency. */
  onCurrencyChange?: (currency: CurrencyCode) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  min?: number;
}

export function CurrencyInput({
  id,
  value,
  onChange,
  currency = "ETB",
  onCurrencyChange,
  required,
  disabled,
  placeholder = "0",
  min,
}: CurrencyInputProps) {
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>(currency);
  const [displayValue, setDisplayValue] = useState(value);
  const skipNextSync = useRef(false);

  useEffect(() => {
    fetchRates().then(setRates);
  }, []);

  // Sync displayValue when the parent value changes externally (form reset, data load)
  useEffect(() => {
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    if (!rates || displayCurrency === currency) {
      setDisplayValue(value);
    } else if (value) {
      const converted = convertCurrency(parseFloat(value), currency, displayCurrency, rates);
      setDisplayValue(converted !== null ? Math.round(converted).toString() : value);
    } else {
      setDisplayValue("");
    }
  }, [value, currency, displayCurrency, rates]);

  const handleCurrencySwitch = useCallback(
    (newCurrency: CurrencyCode) => {
      if (newCurrency === displayCurrency || !rates) return;

      const numVal = displayValue ? parseFloat(displayValue) : 0;

      if (numVal > 0) {
        const converted = convertCurrency(numVal, displayCurrency, newCurrency, rates);
        if (converted !== null) {
          const newVal = Math.round(converted).toString();
          skipNextSync.current = true;
          setDisplayValue(newVal);

          if (onCurrencyChange) {
            onChange(newVal);
            onCurrencyChange(newCurrency);
          }
        }
      }
      setDisplayCurrency(newCurrency);
    },
    [displayCurrency, displayValue, rates, onCurrencyChange, onChange]
  );

  const handleInputChange = useCallback(
    (inputVal: string) => {
      setDisplayValue(inputVal);
      skipNextSync.current = true;

      if (!inputVal || parseFloat(inputVal) === 0) {
        onChange("");
        return;
      }

      if (onCurrencyChange || displayCurrency === currency || !rates) {
        onChange(inputVal);
      } else {
        const baseValue = convertCurrency(
          parseFloat(inputVal),
          displayCurrency,
          currency,
          rates
        );
        onChange(baseValue !== null ? Math.round(baseValue).toString() : inputVal);
      }
    },
    [displayCurrency, currency, rates, onChange, onCurrencyChange]
  );

  return (
    <div className="flex items-start gap-0">
      <div className="relative flex-1">
        <Input
          id={id}
          type="number"
          value={displayValue}
          onChange={(e) => handleInputChange(e.target.value)}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          min={min}
          className="rounded-r-none border-r-0 pr-2"
        />
      </div>
      <div className="flex h-9 rounded-r-md border border-input overflow-hidden shrink-0">
        {SUPPORTED_CURRENCIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => handleCurrencySwitch(c)}
            disabled={disabled || !rates}
            className={`px-2 text-xs font-medium transition-colors ${
              displayCurrency === c
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            } ${c !== "ETB" ? "border-l border-input" : ""}`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
