import React from 'react';

interface ThokStoreBrandProps {
  className?: string;
  compact?: boolean;
  hideNameOnMobile?: boolean;
  markClassName?: string;
}

export default function ThokStoreBrand({
  className = '',
  compact = false,
  hideNameOnMobile = false,
  markClassName = '',
}: ThokStoreBrandProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {!compact && (
        <img
          src="/brand-logo.png"
          alt="ThokStore"
          className={`h-auto w-36 rounded-md bg-white p-1 shadow-sm sm:w-40 ${hideNameOnMobile ? 'hidden sm:block' : ''}`}
        />
      )}
      {(compact || hideNameOnMobile) && (
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tradeflow-green text-lg font-black text-tradeflow-navy shadow-sm ${markClassName} ${hideNameOnMobile && !compact ? 'sm:hidden' : ''}`}>
          T
        </span>
      )}
    </span>
  );
}
