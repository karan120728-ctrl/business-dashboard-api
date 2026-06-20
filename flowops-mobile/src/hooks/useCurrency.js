import { useContext } from 'react';
import { CurrencyContext, USD_TO_INR as CONTEXT_USD_TO_INR } from '../context/CurrencyContext';

export const USD_TO_INR = CONTEXT_USD_TO_INR;

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
