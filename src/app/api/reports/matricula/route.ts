import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { calcKmTraveled, calcWorkDayHours } from '@/lib/time';
import { logError } from '@/lib/logger';
import { getMonday } from '@/lib/regulation561';
import { parseDateOnlyUtc } from '@/lib/validators';

interface VehicleReportEntry {
  matricula: string;
  days: Array<{
    date: Date | null;
    startTime: string | null;
    endTime: string | null;
    kmTraveled: number;
    hours: number;
    startCountry: string | null;
    endCountry: string | null;
  }>;
  totalKm: number;
  totalHours: number;
  totalEvents: number;
}

// GET - Relatórios por matrícula/veículo DO USUÁRIO LOGADO
export async function GET(request: NextRequest) {
  try {
    // ✅ ISOLAMENTO: Verificar autenticação
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const matricula = searchParams.get('matricula');
    const type = searchParams.get('type') || 'weekly';
    const requestedDate = searchParams.get('date');
    const referenceDate = requestedDate ? parseDateOnlyUtc(requestedDate) : new Date();

    if (!['weekly', 'monthly'].includes(type) || !referenceDate) {
      return NextResponse.json({ error: 'Tipo ou data inválidos' }, { status: 400 });
    }

    let startDate: Date;
    let endDate: Date;

    if (type === 'weekly') {
      startDate = getMonday(referenceDate);
      endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + 7);
      endDate.setUTCMilliseconds(endDate.getUTCMilliseconds() - 1);
    } else {
      startDate = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
      endDate = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    }

    // ✅ ISOLAMENTO: Buscar matrículas apenas do usuário logado
    const allMatriculas = await db.workDay.findMany({
      where: {
        userId,  // ← OBRIGATÓRIO: isolamento por usuário
        matricula: { not: null }
      },
      select: { matricula: true },
      distinct: ['matricula']
    });

    const matriculasList = allMatriculas.map(m => m.matricula).filter(Boolean);

    // Se matrícula específica foi solicitada
    const whereClause: Prisma.WorkDayWhereInput = {
      userId,  // ← OBRIGATÓRIO: isolamento por usuário
      date: {
        gte: startDate,
        lte: endDate
      }
    };

    if (matricula) {
      whereClause.matricula = matricula.toUpperCase();
    }

    // INCLUIR drivingSessions
    const workDays = await db.workDay.findMany({
      where: whereClause,
      include: {
        events: true,
        drivingSessions: {
          orderBy: { createdAt: 'asc' }
        },
        breakPeriods: { orderBy: { startedAt: 'asc' } },
      },
      orderBy: { date: 'asc' }
    });

    // Agrupar por matrícula
    const byMatricula: Record<string, VehicleReportEntry> = {};

    workDays.forEach(day => {
      const key = day.matricula || 'Sem matrícula';
      if (!byMatricula[key]) {
        byMatricula[key] = {
          matricula: key,
          days: [],
          totalKm: 0,
          totalHours: 0,
          totalEvents: 0
        };
      }

      // KM - Calcular pelas sessões de condução (correto para dupla de motoristas)
      const dayKm = calcKmTraveled(day.drivingSessions || [], day.startKm, day.endKm) ?? 0;

      byMatricula[key].totalKm += dayKm;

      // Horas - Calcular pelas sessões de condução
      const dayHours = calcWorkDayHours(day, new Date(), null) ?? 0;

      byMatricula[key].totalHours += dayHours;

      byMatricula[key].totalEvents += day.events.length;

      byMatricula[key].days.push({
        date: day.date,
        startTime: day.startTime,
        endTime: day.endTime,
        kmTraveled: dayKm,
        hours: parseFloat(dayHours.toFixed(1)),
        startCountry: day.startCountry,
        endCountry: day.endCountry
      });
    });

    // Formatar resultado
    const result = Object.values(byMatricula).map(v => {
      const daysWorked = new Set(v.days.flatMap(day => day.date ? [day.date.toISOString().slice(0, 10)] : [])).size;
      return {
        ...v,
        totalHours: parseFloat(v.totalHours.toFixed(1)),
        daysWorked,
        avgHoursPerDay: daysWorked > 0 ? parseFloat((v.totalHours / daysWorked).toFixed(1)) : 0,
        avgKmPerDay: daysWorked > 0 ? Math.round(v.totalKm / daysWorked) : 0,
      };
    });

    return NextResponse.json({
      period: { start: startDate, end: endDate, type },
      matriculas: matriculasList,
      report: result
    });

  } catch (error) {
    // Tratar erro de autenticação
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    logError('Error generating matricula report:', error);
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 });
  }
}
