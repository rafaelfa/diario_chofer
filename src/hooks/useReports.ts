'use client';

/**
 * Hook useReports — extrai a lógica de relatórios e veículos de page.tsx.
 */

import { useState, useCallback } from 'react';
import type { Report, VehicleStats, VehicleHistory } from '@/lib/types';
import { getClientTimezone } from '@/lib/timezone';

export function useReports() {
  const [weeklyReport, setWeeklyReport] = useState<Report | null>(null);
  const [vehicleStats, setVehicleStats] = useState<VehicleStats[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [vehicleHistory, setVehicleHistory] = useState<VehicleHistory[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const loadWeeklyReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/reports?type=weekly&timezone=${encodeURIComponent(getClientTimezone())}`);
      if (!res.ok) return;
      const data: Report = await res.json();
      setWeeklyReport(data);
    } catch {
      // silenciar — não é crítico para o ecrã principal
    }
  }, []);

  const loadReport = useCallback(
    async (
      type: 'weekly' | 'monthly' | 'custom',
      customStart?: string,
      customEnd?: string
    ): Promise<Report | null> => {
      try {
        let url = `/api/reports?type=${type}&timezone=${encodeURIComponent(getClientTimezone())}`;
        if (type === 'custom' && customStart && customEnd) {
          url += `&startDate=${customStart}&endDate=${customEnd}`;
        }
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },
    []
  );

  const loadVehicleStats = useCallback(async () => {
    try {
      setLoadingVehicles(true);
      const res = await fetch('/api/veiculos/estatisticas');
      if (!res.ok) return;
      const data = await res.json();
      setVehicleStats(Array.isArray(data) ? data : data.veiculos ?? []);
    } catch {
      // silenciar
    } finally {
      setLoadingVehicles(false);
    }
  }, []);

  const loadVehicleHistory = useCallback(async (matricula: string) => {
    try {
      setSelectedVehicle(matricula);
      const res = await fetch(`/api/veiculos/historico?matricula=${encodeURIComponent(matricula)}`);
      if (!res.ok) return;
      const data: VehicleHistory[] = await res.json();
      setVehicleHistory(data);
    } catch {
      // silenciar
    }
  }, []);

  const downloadPdf = useCallback(
    async (
      type: 'weekly' | 'monthly' | 'custom',
      matricula?: string,
      customStart?: string,
      customEnd?: string
    ) => {
      try {
        setLoadingPdf(true);
        let url = `/api/reports/pdf?type=${type}&timezone=${encodeURIComponent(getClientTimezone())}`;
        if (matricula) url += `&matricula=${encodeURIComponent(matricula)}`;
        if (type === 'custom' && customStart && customEnd) {
          url += `&startDate=${customStart}&endDate=${customEnd}`;
        }

        window.open(url, '_blank');
      } catch {
        // Silently fail - the window.open approach doesn't throw typically
      } finally {
        setLoadingPdf(false);
      }
    },
    []
  );

  return {
    weeklyReport,
    vehicleStats,
    selectedVehicle,
    vehicleHistory,
    loadingVehicles,
    loadingPdf,
    loadWeeklyReport,
    loadReport,
    loadVehicleStats,
    loadVehicleHistory,
    downloadPdf,
  };
}
