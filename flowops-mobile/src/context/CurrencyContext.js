import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

export const USD_TO_INR = 83.5;
const CURRENCY_KEY = 'flowops_currency';

export const CurrencyContext = createContext(null);

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    const loadCurrency = async () => {
      try {
        const stored = await SecureStore.getItemAsync(CURRENCY_KEY);
        if (stored === 'INR' || stored === 'USD') {
          setCurrency(stored);
        }
      } catch (e) {
        console.warn('Failed to load currency setting:', e.message);
      }
    };
    loadCurrency();
  }, []);

  const toggleCurrency = useCallback(async () => {
    const nextCurrency = currency === 'INR' ? 'USD' : 'INR';
    setCurrency(nextCurrency);
    try {
      await SecureStore.setItemAsync(CURRENCY_KEY, nextCurrency);
    } catch (e) {
      console.warn('Failed to save currency setting:', e.message);
    }
  }, [currency]);

  const formatPrice = useCallback(
    (amountUSD) => {
      const num = parseFloat(amountUSD || 0);
      if (currency === 'INR') {
        const inrAmount = num * USD_TO_INR;
        return `₹${Math.round(inrAmount).toLocaleString('en-IN')}`;
      }
      return `$${num.toFixed(2)}`;
    },
    [currency],
  );

  const value = {
    currency,
    toggleCurrency,
    formatPrice,
  };

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
};
