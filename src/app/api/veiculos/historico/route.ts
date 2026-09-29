import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { calcKmTraveled } from '@/lib/time';
import { logError } from '@/lib/logger';

interface VehicleMileageSummary {
  matricula: string;
  totalViagens: number;
  totalKm: number;
  firstDate: Date | null;
  lastDate: Date | null;
  lastKm: number;
}

// GET - Histórico de KM por caminhão DO USUÁRIO LOGADO
export async function GET(request: NextRequest) {
  try {
    // ✅ ISOLAMENTO: Verificar autenticação
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const matricula = searchParams.get('matricula');
    const requestedLimit = Number(searchParams.get('limit') || 50);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
      return NextResponse.json({ error: 'limit deve ser um inteiro positivo' }, { status: 400 });
    }
    const limit = Math.min(requestedLimit, 100);

    if (!matricula) {
      // Listar todos os veículos DO USUÁRIO com resumo
      const veiculos = await db.workDay.findMany({
        where: {
          userId,  // ← OBRIGATÓRIO: isolamento por usuário
          matricula: { not: null }
        },
        select: {
          matricula: true,
          startKm: true,
          endKm: true,
          date: true,
          drivingSessions: { select: { startKm: true, endKm: true } },
        },
        orderBy: { date: 'desc' }
      });

      const veiculosMap: Record<string, VehicleMileageSummary> = {};

      veiculos.forEach(v => {
        const key = v.matricula!;
        if (!veiculosMap[key]) {
          veiculosMap[key] = {
            matricula: key,
            totalViagens: 0,
            totalKm: 0,
            firstDate: v.date,
            lastDate: v.date,
            lastKm: v.endKm ?? 0
          };
        }

        veiculosMap[key].totalViagens++;
        veiculosMap[key].totalKm += calcKmTraveled(v.drivingSessions, v.startKm, v.endKm) ?? 0;
        // Verificar se date não é null antes de comparar
        if (v.date && veiculosMap[key].firstDate && v.date < veiculosMap[key].firstDate) {
          veiculosMap[key].firstDate = v.date;
        }
        if (v.date && veiculosMap[key].lastDate && v.date > veiculosMap[key].lastDate) {
          veiculosMap[key].lastDate = v.date;
          if (v.endKm != null) veiculosMap[key].lastKm = v.endKm;
        }
      });

      return NextResponse.json({
        veiculos: Object.values(veiculosMap).sort((a, b) =>
          (b.lastDate?.getTime() ?? 0) - (a.lastDate?.getTime() ?? 0)
        )
      });
    }

    // Histórico de um veículo específico DO USUÁRIO
    const historico = await db.workDay.findMany({
      where: {
        userId,  // ← OBRIGATÓRIO: isolamento por usuário
        matricula: matricula.toUpperCase()
      },
      include: {
        events: {
          select: {
            id: true,
            time: true,
            description: true
          }
        },
        drivingSessions: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { date: 'desc' },
    });

    const historicoFormatado = historico.map(day => {
      // Calcular KM pelas sessões de condução
      const kmTraveled = calcKmTraveled(day.drivingSessions || [], day.startKm, day.endKm) ?? 0;

      return {
        id: day.id,
        date: day.date,
        startTime: day.startTime,
        endTime: day.endTime,
        startKm: day.startKm,
        endKm: day.endKm,
        kmTraveled: kmTraveled,
        startCountry: day.startCountry,
        endCountry: day.endCountry,
        truckCheck: day.truckCheck,
        events: day.events.length,
        eventsList: day.events
      };
    });

    // Calcular estatísticas do veículo
    const stats = {
      totalViagens: historicoFormatado.length,
      totalKm: historicoFormatado.reduce((sum, d) => sum + (d.kmTraveled || 0), 0),
      totalEvents: historicoFormatado.reduce((sum, d) => sum + d.events, 0),
      firstKm: [...historicoFormatado].reverse().find(day => day.startKm != null)?.startKm ?? null,
      lastKm: historicoFormatado.find(day => day.endKm != null)?.endKm ?? null
    };

    return NextResponse.json({
      matricula: matricula.toUpperCase(),
      limit,
      estatisticas: stats,
      historico: historicoFormatado.slice(0, limit),
      hasMore: historicoFormatado.length > limit,
    });

  } catch (error) {
    // Tratar erro de autenticação
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    logError('Error fetching vehicle history:', error);
    return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 });
  }
}
