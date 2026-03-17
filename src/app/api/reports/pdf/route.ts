import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Dados para relatório PDF
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'weekly';
    const matricula = searchParams.get('matricula');
    const referenceDate = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date();

    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    if (type === 'weekly') {
      const dayOfWeek = referenceDate.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(referenceDate);
      startDate.setDate(referenceDate.getDate() - diff);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      
      const weekNum = Math.ceil((startDate.getDate() + new Date(startDate.getFullYear(), startDate.getMonth(), 1).getDay()) / 7);
      periodLabel = `Semana ${weekNum} de ${startDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}`;
    } else {
      startDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      
      periodLabel = referenceDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
    }

    // Buscar dias de trabalho
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

    // Calcular estatísticas
    let totalKm = 0;
    let totalHours = 0;
    let totalEvents = 0;

    const daysFormatted = workDays.map(day => {
      let dayKm = 0;
      let dayHours = 0;

      if (day.endKm && day.startKm) {
        dayKm = day.endKm - day.startKm;
        totalKm += dayKm;
      }

      if (day.startTime && day.endTime) {
        const [startH, startM] = day.startTime.split(':').map(Number);
        const [endH, endM] = day.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        dayHours = (endMinutes - startMinutes) / 60;
        if (dayHours < 0) dayHours += 24;
        totalHours += dayHours;
      }

      totalEvents += day.events.length;

      return {
        date: day.date,
        dateFormatted: day.date.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        matricula: day.matricula || '-',
        startTime: day.startTime || '-',
        endTime: day.endTime || '-',
        startKm: day.startKm || '-',
        endKm: day.endKm || '-',
        kmTraveled: dayKm,
        hours: parseFloat(dayHours.toFixed(1)),
        startCountry: day.startCountry || '-',
        endCountry: day.endCountry || '-',
        events: day.events.length,
        truckCheck: day.truckCheck ? 'Sim' : 'Não'
      };
    });

    // Verificar alertas de legislação
    const alerts: string[] = [];
    const maxDailyHours = 9;
    const maxWeeklyHours = 56;

    daysFormatted.forEach(day => {
      if (day.hours > maxDailyHours) {
        alerts.push(`${day.dateFormatted}: ${day.hours}h de condução (limite: ${maxDailyHours}h)`);
      }
    });

    if (type === 'weekly' && totalHours > maxWeeklyHours) {
      alerts.push(`Total semanal: ${totalHours.toFixed(1)}h (limite: ${maxWeeklyHours}h)`);
    }

    // Gerar HTML para impressão/PDF
    const html = generateReportHTML({
      periodLabel,
      type,
      startDate,
      endDate,
      matricula,
      statistics: {
        daysWorked: workDays.length,
        totalKm,
        totalHours: parseFloat(totalHours.toFixed(1)),
        totalEvents,
        avgHoursPerDay: workDays.length > 0 ? parseFloat((totalHours / workDays.length).toFixed(1)) : 0,
        avgKmPerDay: workDays.length > 0 ? Math.round(totalKm / workDays.length) : 0
      },
      days: daysFormatted,
      alerts
    });

    return NextResponse.json({
      period: {
        start: startDate,
        end: endDate,
        label: periodLabel,
        type
      },
      matricula,
      statistics: {
        daysWorked: workDays.length,
        totalKm,
        totalHours: parseFloat(totalHours.toFixed(1)),
        totalEvents,
        avgHoursPerDay: workDays.length > 0 ? parseFloat((totalHours / workDays.length).toFixed(1)) : 0,
        avgKmPerDay: workDays.length > 0 ? Math.round(totalKm / workDays.length) : 0
      },
      days: daysFormatted,
      alerts,
      html
    });

  } catch (error) {
    console.error('Error generating PDF report:', error);
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 });
  }
}

function generateReportHTML(data: any): string {
  const { periodLabel, type, startDate, endDate, matricula, statistics, days, alerts } = data;

  return `
<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <title>Relatório - Diário do Motorista</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
    h1 { color: #1e3a5f; border-bottom: 3px solid #22c55e; padding-bottom: 10px; }
    h2 { color: #334155; margin-top: 20px; }
    .period { background: #f1f5f9; padding: 10px 15px; border-radius: 8px; margin: 15px 0; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
    .stat-box { background: #1e3a5f; color: white; padding: 15px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; }
    .stat-label { font-size: 12px; opacity: 0.8; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
    th { background: #1e3a5f; color: white; padding: 10px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .alerts { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
    .alerts h3 { color: #92400e; margin: 0 0 10px 0; }
    .alerts ul { margin: 0; padding-left: 20px; }
    .alerts li { color: #78350f; margin: 5px 0; }
    .footer { margin-top: 30px; text-align: center; color: #64748b; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
    @media print { body { padding: 0; } .stat-box { break-inside: avoid; } }
  </style>
</head>
<body>
  <h1>🚛 Diário do Motorista</h1>
  
  <div class="period">
    <strong>Período:</strong> ${periodLabel}<br>
    <strong>De:</strong> ${startDate.toLocaleDateString('pt-PT')} <strong>até</strong> ${endDate.toLocaleDateString('pt-PT')}
    ${matricula ? `<br><strong>Veículo:</strong> ${matricula}` : ''}
  </div>

  <h2>📊 Resumo</h2>
  <div class="stats">
    <div class="stat-box">
      <div class="stat-value">${statistics.daysWorked}</div>
      <div class="stat-label">Dias Trabalhados</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${statistics.totalKm.toLocaleString()}</div>
      <div class="stat-label">KM Total</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${statistics.totalHours}h</div>
      <div class="stat-label">Horas de Condução</div>
    </div>
  </div>

  ${alerts.length > 0 ? `
  <div class="alerts">
    <h3>⚠️ Alertas de Conformidade</h3>
    <ul>
      ${alerts.map((a: string) => `<li>${a}</li>`).join('')}
    </ul>
  </div>
  ` : ''}

  <h2>📋 Detalhamento Diário</h2>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Matrícula</th>
        <th>Início</th>
        <th>Fim</th>
        <th>KM</th>
        <th>Horas</th>
        <th>Origem</th>
        <th>Destino</th>
      </tr>
    </thead>
    <tbody>
      ${days.map((d: any) => `
        <tr>
          <td>${d.dateFormatted}</td>
          <td>${d.matricula}</td>
          <td>${d.startTime}</td>
          <td>${d.endTime}</td>
          <td>${d.kmTraveled} km</td>
          <td>${d.hours}h</td>
          <td>${d.startCountry}</td>
          <td>${d.endCountry}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>Relatório gerado em ${new Date().toLocaleDateString('pt-PT')} às ${new Date().toLocaleTimeString('pt-PT')}</p>
    <p>Diário do Motorista - Sistema de Controle de Jornada</p>
  </div>
</body>
</html>
  `;
}
