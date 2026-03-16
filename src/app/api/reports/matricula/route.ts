import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Relatórios por matrícula/veículo
export async function GET(request: NextRequest) {
  try {
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

    // Buscar todas as matrículas únicas
    const allMatriculas = await db.workDay.findMany({
      where: {
        matricula: { not: null }
      },
      select: { matricula: true },
      distinct: ['matricula']
    });

    const matriculasList = allMatriculas.map(m => m.matricula).filter(Boolean);

    // Se matrícula específica foi solicitada
    const whereClause: any = {
      date: {
        gte: startDate,
        lte: endDate
      }
    };

    if (matricula) {
      whereClause.matricula = matricula.toUpperCase();
    }

    const workDays = await db.workDay.findMany({
      where: whereClause,
      include: { events: true },
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

      let dayKm = 0;
      let dayHours = 0;

      if (day.endKm && day.startKm) {
        dayKm = day.endKm - day.startKm;
        byMatricula[key].totalKm += dayKm;
      }

      if (day.startTime && day.endTime) {
        const [startH, startM] = day.startTime.split(':').map(Number);
        const [endH, endM] = day.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        dayHours = (endMinutes - startMinutes) / 60;
        if (dayHours < 0) dayHours += 24;
        byMatricula[key].totalHours += dayHours;
      }

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
    console.error('Error generating matricula report:', error);
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 });
  }
}
