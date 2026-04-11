import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { calcHoursWorked, calcKmTraveled } from '@/lib/time';
import { logError } from '@/lib/logger';
import { formatDatePtServer } from '@/lib/timezone';

// ─── Properly typed interfaces ───────────────────────────────────────────────

interface VehicleStatsAccumulator {
  matricula: string;
  viagens: number;
  totalKm: number;
  totalHoras: number;
  totalEventos: number;
  diasTrabalhados: Set<string>;
  primeiroRegistro: Date | null;
  ultimoRegistro: Date | null;
  kmInicial: number | null;
  kmFinal: number | null;
  paises: Set<string>;
  manutencoes: number;
}

interface VehicleStatsRow {
  matricula: string;
  viagens: number;
  diasTrabalhados: number;
  totalKm: number;
  totalHoras: number;
  mediaKmPorDia: number;
  mediaHorasPorDia: number;
  totalEventos: number;
  kmInicial: number | null;
  kmFinal: number | null;
  primeiroRegistro: Date | null;
  ultimoRegistro: Date | null;
  paises: string[];
  checksRealizados: number;
}

// GET - Estatísticas por veículo DO USUÁRIO LOGADO
export async function GET(request: NextRequest) {
  try {
    // ✅ ISOLAMENTO: Verificar autenticação
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const matricula = searchParams.get('matricula');

    // ✅ ISOLAMENTO: Buscar apenas dias do usuário logado
    const workDays = await db.workDay.findMany({
      where: {
        userId,  // ← OBRIGATÓRIO: isolamento por usuário
        ...(matricula ? { matricula: matricula.toUpperCase() } : { matricula: { not: null } })
      },
      include: {
        events: true,
        drivingSessions: {
          orderBy: { startTime: 'asc' }
        }
      },
      orderBy: { date: 'desc' }
    });

    // Agrupar por matrícula
    const stats: Record<string, VehicleStatsAccumulator> = {};

    workDays.forEach(day => {
      const key = day.matricula!;
      if (!stats[key]) {
        stats[key] = {
          matricula: key,
          viagens: 0,
          totalKm: 0,
          totalHoras: 0,
          totalEventos: 0,
          diasTrabalhados: new Set(),
          primeiroRegistro: day.date,
          ultimoRegistro: day.date,
          kmInicial: day.startKm,
          kmFinal: day.endKm,
          paises: new Set(),
          manutencoes: 0
        };
      }

      stats[key].viagens++;
      if (day.date) {
        // Usar formatDatePtServer para consistência de fuso horário
        const dateKey = formatDatePtServer(day.date, null, { year: 'numeric', month: '2-digit', day: '2-digit' });
        stats[key].diasTrabalhados.add(dateKey);
      }

      // KM — centralizado em calcKmTraveled
      const dayKm = calcKmTraveled(day.drivingSessions || [], day.startKm, day.endKm);
      if (dayKm) stats[key].totalKm += dayKm;

      if (day.endKm) {
        stats[key].kmFinal = Math.max(stats[key].kmFinal || 0, day.endKm);
      }
      if (day.startKm && (!stats[key].kmInicial || day.startKm < stats[key].kmInicial)) {
        stats[key].kmInicial = day.startKm;
      }

      // Horas — centralizado em calcHoursWorked
      const dayHours = calcHoursWorked(day.drivingSessions || [], day.startTime, day.endTime);
      if (dayHours) stats[key].totalHoras += dayHours;

      // Eventos
      stats[key].totalEventos += day.events.length;

      // Datas
      if (day.date) {
        if (!stats[key].primeiroRegistro || day.date < stats[key].primeiroRegistro) {
          stats[key].primeiroRegistro = day.date;
        }
        if (!stats[key].ultimoRegistro || day.date > stats[key].ultimoRegistro) {
          stats[key].ultimoRegistro = day.date;
        }
      }

      // Países
      if (day.startCountry) stats[key].paises.add(day.startCountry);
      if (day.endCountry) stats[key].paises.add(day.endCountry);

      // Check do caminhão
      if (day.truckCheck) stats[key].manutencoes++;
    });

    // Formatar resultado
    const resultado: VehicleStatsRow[] = Object.values(stats).map((v) => ({
      matricula: v.matricula,
      viagens: v.viagens,
      diasTrabalhados: v.diasTrabalhados.size,
      totalKm: v.totalKm,
      totalHoras: parseFloat(v.totalHoras.toFixed(1)),
      mediaKmPorDia: v.diasTrabalhados.size > 0 ? Math.round(v.totalKm / v.diasTrabalhados.size) : 0,
      mediaHorasPorDia: v.diasTrabalhados.size > 0 ? parseFloat((v.totalHoras / v.diasTrabalhados.size).toFixed(1)) : 0,
      totalEventos: v.totalEventos,
      kmInicial: v.kmInicial,
      kmFinal: v.kmFinal,
      primeiroRegistro: v.primeiroRegistro,
      ultimoRegistro: v.ultimoRegistro,
      paises: Array.from(v.paises),
      checksRealizados: v.manutencoes
    }));

    // Ordenar por total de KM (mais rodados primeiro)
    resultado.sort((a, b) => b.totalKm - a.totalKm);

    // Estatísticas gerais
    const geral = {
      totalVeiculos: resultado.length,
      totalKmFrota: resultado.reduce((sum, v) => sum + v.totalKm, 0),
      totalHorasFrota: parseFloat(resultado.reduce((sum, v) => sum + v.totalHoras, 0).toFixed(1)),
      totalViagens: resultado.reduce((sum, v) => sum + v.viagens, 0),
      mediaKmPorVeiculo: resultado.length > 0 ? Math.round(resultado.reduce((sum, v) => sum + v.totalKm, 0) / resultado.length) : 0
    };

    return NextResponse.json({
      geral,
      veiculos: resultado
    });

  } catch (error) {
    // Tratar erro de autenticação
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    logError('Error fetching vehicle statistics:', error);
    return NextResponse.json({ error: 'Erro ao buscar estatísticas' }, { status: 500 });
  }
}
