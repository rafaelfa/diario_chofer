import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { calcHoursWorked, calcKmTraveled } from '@/lib/time';
import { logError } from '@/lib/logger';

// GET - Relatórios por matrícula/veículo DO USUÁRIO LOGADO
export async function GET(request: NextRequest) {
  try {
    // ✅ ISOLAMENTO: Verificar autenticação
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const matricula = searchParams.get('matricula');
    const type = searchParams.get('type') || 'weekly';
    const referenceDate = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date();

    let startDate: Date;
    let endDate: Date;

    if (type === 'weekly') {
      const dayOfWeek = referenceDate.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(referenceDate);
      startDate.setDate(referenceDate.getDate() - diff);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
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
    const whereClause: any = {
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
          orderBy: { startTime: 'asc' }
        }
      },
      orderBy: { date: 'asc' }
    });

    // Agrupar por matrícula
    const byMatricula: Record<string, any> = {};

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
      const dayHours = calcHoursWorked(day.drivingSessions || [], day.startTime, day.endTime) ?? 0;

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
    const result = Object.values(byMatricula).map((v: any) => ({
      ...v,
      totalHours: parseFloat(v.totalHours.toFixed(1)),
      avgHoursPerDay: v.days.length > 0 ? parseFloat((v.totalHours / v.days.length).toFixed(1)) : 0,
      avgKmPerDay: v.days.length > 0 ? Math.round(v.totalKm / v.days.length) : 0
    }));

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
