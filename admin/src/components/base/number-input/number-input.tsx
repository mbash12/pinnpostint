'use client';

import React from 'react';
import { Input } from '../input/input';
import type { InputBaseProps } from '../input/input';

export interface NumberInputProps extends Omit<InputBaseProps, 'type' | 'value' | 'onChange'> {
  value: number | string;
  onChange: (value: number) => void;
  thousandSeparator?: boolean;
  decimalScale?: number;
  min?: number;
  max?: number;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  thousandSeparator = true,
  decimalScale = 0,
  min,
  max,
  ...props
}) => {
  const formatNumber = (num: number) => {
    if (thousandSeparator) {
      return num.toLocaleString('en-US', {
        minimumFractionDigits: decimalScale,
        maximumFractionDigits: decimalScale
      });
    }
    return num.toString();
  };

  const parseNumber = (str: string) => {
    const num = Number(str.replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const handleChange = (strValue: string) => {
    let numValue = parseNumber(strValue);

    // Check for Infinity or extremely large numbers
    if (!Number.isFinite(numValue)) {
      numValue = max || 0;
    }

    // Apply min/max constraints
    if (min !== undefined && numValue < min) {
      numValue = min;
    }
    if (max !== undefined && numValue > max) {
      numValue = max;
    }

    onChange(numValue);
  };

  const displayValue = typeof value === 'number' ? formatNumber(value) : value;

  return (
    <Input
      type="text"
      value={displayValue}
      onChange={handleChange}
      inputMode="decimal"
      {...props}
    />
  );
};