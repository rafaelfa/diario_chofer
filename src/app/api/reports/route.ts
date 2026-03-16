import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Gerar relatórios
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'weekly'; // weekly ou monthly
    const referenceDate = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date();

    let startDate: Date;
    let endDate: Date;

    if (type === 'weekly') {
      // Início da semana (segunda-feira)
      const dayOfWeek = referenceDate.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(referenceDate);
      startDate.setDate(referenceDate.getDate() - diff);
      startDate.setHours(0, 0, 0, 0);

      // Fim da semana (domingo)
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Início do mês
      startDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);

      // Fim do mês
      endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    // Buscar dias de trabalho no período
    const workDays = await db.workDay.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        events: true
      },
      orderBy: { date: 'asc' }
    });

    // Calcular estatísticas
    let totalKm = 0;
    let totalHours = 0;
    let totalEvents = 0;
    const daysWorked = workDays.length;

    workDays.forEach(day => {
      // KM
      if (day.endKm && day.startKm) {
        totalKm += day.endKm - day.startKm;
      }

      // Horas
      if (day.startTime && day.endTime) {
        const [startH, startM] = day.startTime.split(':').map(Number);
        const [endH, endM] = day.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        let hours = (endMinutes - startMinutes) / 60;
        if (hours < 0) hours += 24;
        totalHours += hours;
      }

      totalEvents += day.events.length;
    });

    // Verificar conformidade com legislação
    const alerts: string[] = [];
    const maxDailyHours = 9;
    const maxWeeklyHours = 56;

    // Verificar se algum dia excedeu o limite diário
    workDays.forEach(day => {
      if (day.startTime && day.endTime) {
        const [startH, startM] = day.startTime.split(':').map(Number);
        const [endH, endM] = day.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        let hours = (endMinutes - startMinutes) / 60;
        if (hours < 0) hours += 24;

        if (hours > maxDailyHours) {
          alerts.push(`Dia ${day.date.toLocaleDateString('pt-PT')}: ${hours.toFixed(1)}h (limite: ${maxDailyHours}h)`);
        }
      }
    });

    // Verificar se excedeu limite semanal
    if (totalHours > maxWeeklyHours) {
      alerts.push(`Total semanal: ${totalHours.toFixed(1)}h (limite: ${maxWeeklyHours}h)`);
    }

    return NextResponse.json({
      period: {
        start: startDate,
        end: endDate,
        type
      },
      statistics: {
        daysWorked,
        totalKm,
        totalHours: parseFloat(totalHours.toFixed(1)),
        totalEvents,
        avgHoursPerDay: daysWorked > 0 ? parseFloat((totalHours / daysWorked).toFixed(1)) : 0,
        avgKmPerDay: daysWorked > 0 ? Math.round(totalKm / daysWorked) : 0
      },
      alerts,
      workDays: workDays.map(day => ({
        id: day.id,
        date: day.date,
        startTime: day.startTime,
        endTime: day.endTime,
        startCountry: day.startCountry,
        endCountry: day.endCountry,
        kmTraveled: day.endKm && day.startKm ? day.endKm - day.startKm : null,
        events: day.events.length
      }))
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 });
  }
}
