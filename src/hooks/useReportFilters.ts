'use client';

/**
 * Hook useReportFilters — manages report type and custom date range state.
 */

import { useState } from 'react';

export function useReportFilters() {
  const [reportType, setReportType] = useState<'weekly' | 'monthly' | 'custom'>('weekly');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');

  return {
    reportType,
    setReportType,
    customDateStart,
    setCustomDateStart,
    customDateEnd,
    setCustomDateEnd,
  };
}
