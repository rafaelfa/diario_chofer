import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { calcKmTraveled, calcWorkDayHours } from '@/lib/time';
import { log, logError } from '@/lib/logger';
import { formatDatePtServer } from '@/lib/timezone';
import { escapeHtml } from '@/lib/html';
import {
  aggregateDrivingByDate,
  computeDrivingLimits,
  evaluateDailyDrivingLimits,
  getIsoWeekNumberUtc,
  getMonday,
  MAX_BIWEEKLY_DRIVING_H,
  MAX_DAILY_DRIVING_EXCEPTION_H,
  MAX_WEEKLY_DRIVING_H,
} from '@/lib/regulation561';
import { endOfUtcDay, isValidTimezone, parseDateOnlyUtc, startOfUtcDay } from '@/lib/validators';

type ReportWorkDay = Prisma.WorkDayGetPayload<{
  include: { events: true; drivingSessions: true };
}>;

interface ReportHtmlData {
  periodLabel: string;
  startDate: string;
  endDate: string;
  matricula: string | null;
  timezone: string | null;
  statistics: {
    daysWorked: number;
    totalKm: number;
    totalHours: number;
    totalEvents: number;
    avgHoursPerDay: number;
    avgKmPerDay: number;
  };
  days: Array<{
    dateFormatted: string;
    matricula: string;
    startTime: string;
    endTime: string;
    startKm: number | string;
    endKm: number | string;
    kmTraveled: number;
    hours: number;
    startCountry: string;
    endCountry: string;
    events: number;
    truckCheck: string;
    turnosCount: number;
    turnos: Array<{
      numero: number;
      startTime: string;
      endTime: string;
      startKm: string;
      endKm: string;
      km: number;
      status: string;
    }>;
  }>;
  alerts: string[];
}

// GET - Gerar relatório HTML (pode ser impresso como PDF pelo navegador) DO USUÁRIO LOGADO
export async function GET(request: NextRequest) {
  try {
    // ✅ ISOLAMENTO: Verificar autenticação
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'weekly';
    const matricula = searchParams.get('matricula');
    const customStartDate = searchParams.get('startDate');
    const customEndDate = searchParams.get('endDate');
    const timezone = searchParams.get('timezone');
    const requestedDate = searchParams.get('date');
    const referenceDate = requestedDate ? parseDateOnlyUtc(requestedDate) : new Date();

    if (!['weekly', 'monthly', 'custom'].includes(type) || !referenceDate || !isValidTimezone(timezone)) {
      return NextResponse.json({ error: 'Tipo, data ou fuso horário inválido' }, { status: 400 });
    }
    if (Boolean(customStartDate) !== Boolean(customEndDate) || (type === 'custom' && !customStartDate)) {
      return NextResponse.json({ error: 'Informe as datas inicial e final do período' }, { status: 400 });
    }

    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let periodLabel: string;
    let workDays: ReportWorkDay[] = [];

    log('=== GERANDO RELATÓRIO PDF ===');
    log('Matrícula:', matricula);
    log('Tipo:', type);

    // Se matrícula foi especificada sem datas personalizadas, buscar TODOS os registros do veículo DO USUÁRIO
    if (matricula && !customStartDate && !customEndDate) {
      // ✅ ISOLAMENTO: Buscar apenas registros do usuário logado
      const allVehicleRecords = await db.workDay.findMany({
        where: {
          userId,  // ← OBRIGATÓRIO: isolamento por usuário
          matricula: matricula.toUpperCase()
        },
        include: {
          events: true,
          drivingSessions: {
            orderBy: { createdAt: 'asc' }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      log('Registros encontrados para matrícula:', allVehicleRecords.length);

      if (allVehicleRecords.length > 0) {
        workDays = allVehicleRecords;

        // Determinar período baseado nas datas disponíveis
        const validDates = allVehicleRecords
          .filter(r => r.date !== null)
          .map(r => r.date as Date)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

        if (validDates.length > 0) {
          startDate = startOfUtcDay(validDates[0]);
          endDate = endOfUtcDay(validDates[validDates.length - 1]);
        } else {
          // Se não há datas válidas, usar createdAt
          const createdDates = allVehicleRecords.map(r => r.createdAt).sort();
          startDate = startOfUtcDay(createdDates[0]);
          endDate = endOfUtcDay(createdDates[createdDates.length - 1]);
        }

        const startFormatted = formatDatePtServer(startDate, timezone, { day: '2-digit', month: '2-digit', year: 'numeric' });
        const endFormatted = formatDatePtServer(endDate, timezone, { day: '2-digit', month: '2-digit', year: 'numeric' });
        periodLabel = `Veículo: ${matricula.toUpperCase()} | ${startFormatted} a ${endFormatted}`;
      } else {
        // Veículo sem registros
        startDate = startOfUtcDay(new Date());
        endDate = endOfUtcDay(new Date());
        periodLabel = `Veículo: ${matricula.toUpperCase()} - Sem registros`;
      }
    } else if (customStartDate && customEndDate) {
      // Período personalizado
      startDate = parseDateOnlyUtc(customStartDate);
      const parsedEndDate = parseDateOnlyUtc(customEndDate);
      if (!startDate || !parsedEndDate || startDate > parsedEndDate) {
        return NextResponse.json({ error: 'Período personalizado inválido' }, { status: 400 });
      }
      endDate = new Date(parsedEndDate);
      endDate.setUTCHours(23, 59, 59, 999);

      const startFormatted = formatDatePtServer(startDate, timezone, { day: '2-digit', month: '2-digit' });
      const endFormatted = formatDatePtServer(endDate, timezone, { day: '2-digit', month: '2-digit', year: 'numeric' });
      periodLabel = `Período: ${startFormatted} a ${endFormatted}`;
      if (matricula) {
        periodLabel += ` | Veículo: ${matricula.toUpperCase()}`;
      }

      // ✅ ISOLAMENTO: Buscar dias de trabalho do usuário
      const whereClause: Prisma.WorkDayWhereInput = {
        userId,  // ← OBRIGATÓRIO
        date: { gte: startDate, lte: endDate }
      };

      if (matricula) {
        whereClause.matricula = matricula.toUpperCase();
      }

      workDays = await db.workDay.findMany({
        where: whereClause,
        include: {
          events: true,
          drivingSessions: {
            orderBy: { createdAt: 'asc' }
          }
        },
        orderBy: { date: 'asc' }
      });
    } else if (type === 'weekly') {
      startDate = getMonday(referenceDate);
      endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + 7);
      endDate.setUTCMilliseconds(endDate.getUTCMilliseconds() - 1);

      const weekNum = getIsoWeekNumberUtc(startDate);
      periodLabel = `Semana ${weekNum} de ${formatDatePtServer(startDate, timezone, { month: 'long', year: 'numeric' })}`;

      // ✅ ISOLAMENTO: Buscar dias de trabalho do usuário
      workDays = await db.workDay.findMany({
        where: {
          userId,  // ← OBRIGATÓRIO
          date: { gte: startDate, lte: endDate }
        },
        include: {
          events: true,
          drivingSessions: {
            orderBy: { createdAt: 'asc' }
          }
        },
        orderBy: { date: 'asc' }
      });
    } else {
      // Monthly
      startDate = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
      endDate = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 0, 23, 59, 59, 999));

      periodLabel = formatDatePtServer(referenceDate, timezone, { month: 'long', year: 'numeric' });

      // ✅ ISOLAMENTO: Buscar dias de trabalho do usuário
      workDays = await db.workDay.findMany({
        where: {
          userId,  // ← OBRIGATÓRIO
          date: { gte: startDate, lte: endDate }
        },
        include: {
          events: true,
          drivingSessions: {
            orderBy: { createdAt: 'asc' }
          }
        },
        orderBy: { date: 'asc' }
      });
    }

    log('WorkDays encontrados:', workDays.length);

    // Calcular estatísticas
    let totalKm = 0;
    let totalHours = 0;
    let totalEvents = 0;

    const daysFormatted = workDays.map(day => {
      // Calcular KM — centralizado em calcKmTraveled
      const dayKm = calcKmTraveled(day.drivingSessions || [], day.startKm, day.endKm) || 0;
      totalKm += dayKm;

      const dayHours = calcWorkDayHours(day) ?? 0;
      totalHours += dayHours;

      totalEvents += day.events.length;

      // Formatar turnos
      const turnos = day.drivingSessions.map((session, index) => ({
        numero: index + 1,
        startTime: session.startTime || '--:--',
        endTime: session.endTime || '--:--',
        startKm: session.startKm?.toLocaleString() || '--',
        endKm: session.endKm?.toLocaleString() || '--',
        km: session.startKm && session.endKm ? session.endKm - session.startKm : 0,
        status: session.status
      }));

      return {
        date: day.date,
        dateFormatted: day.date ? formatDatePtServer(day.date, timezone) : 'Sem data',
        matricula: day.matricula || '-',
        startTime: day.startTime || '-',
        endTime: day.endTime || '-',
        startKm: day.startKm ?? '-',
        endKm: day.endKm ?? '-',
        kmTraveled: dayKm,
        hours: parseFloat(dayHours.toFixed(1)),
        startCountry: day.startCountry || '-',
        endCountry: day.endCountry || '-',
        events: day.events.length,
        truckCheck: day.truckCheck ? 'Sim' : 'Não',
        turnosCount: turnos.length,
        turnos
      };
    });

    // Verificar alertas de legislação
    const alerts: string[] = [];
    if (!matricula) {
      const dailyTotals = aggregateDrivingByDate(workDays.flatMap(day =>
        day.date ? [{ date: day.date, hoursWorked: calcWorkDayHours(day) ?? 0 }] : []
      ));
      const dailyLimits = evaluateDailyDrivingLimits(dailyTotals);
      for (const excess of dailyLimits.overAbsoluteLimit) {
        alerts.push(`${formatDatePtServer(excess.date, timezone)}: ${excess.hours.toFixed(1)}h de condução (limite absoluto: ${MAX_DAILY_DRIVING_EXCEPTION_H}h)`);
      }
      for (const excess of dailyLimits.exceededWeeklyExceptions) {
        alerts.push(`${formatDatePtServer(excess.date, timezone)}: ${excess.hours.toFixed(1)}h; já foram usadas as duas exceções semanais de 10h`);
      }

      if (type === 'weekly' && startDate && endDate) {
        const previousWeekStart = new Date(startDate);
        previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);
        const complianceDays = await db.workDay.findMany({
          where: { userId, date: { gte: previousWeekStart, lte: endDate } },
          select: {
            date: true,
            startTime: true,
            endTime: true,
            primaryDriverNumber: true,
            utcOffset: true,
            breakMinutes: true,
            breakStart: true,
            drivingSessions: { orderBy: { createdAt: 'asc' } },
          },
        });
        const limits = computeDrivingLimits(
          complianceDays.filter(day => day.date).map(day => ({
            date: day.date as Date,
            hoursWorked: calcWorkDayHours(day) ?? 0,
          })),
          referenceDate
        );
        if (limits.weeklyHours > MAX_WEEKLY_DRIVING_H) {
          alerts.push(`Total semanal: ${limits.weeklyHours.toFixed(1)}h (limite: ${MAX_WEEKLY_DRIVING_H}h)`);
        }
        if (limits.biweeklyHours > MAX_BIWEEKLY_DRIVING_H) {
          alerts.push(`Total em duas semanas: ${limits.biweeklyHours.toFixed(1)}h (limite: ${MAX_BIWEEKLY_DRIVING_H}h)`);
        }
      }
    }

    // Preparar dados para o relatório
    const daysWorked = new Set(workDays.map(day => (day.date ?? day.createdAt).toISOString().slice(0, 10))).size;
    const reportData = {
      periodLabel,
      type,
      startDate: startDate ? formatDatePtServer(startDate, timezone) : '-',
      endDate: endDate ? formatDatePtServer(endDate, timezone) : '-',
      matricula,
      timezone,  // Passar timezone para formatação no HTML
      statistics: {
        daysWorked,
        totalKm,
        totalHours: parseFloat(totalHours.toFixed(1)),
        totalEvents,
        avgHoursPerDay: daysWorked > 0 ? parseFloat((totalHours / daysWorked).toFixed(1)) : 0,
        avgKmPerDay: daysWorked > 0 ? Math.round(totalKm / daysWorked) : 0,
      },
      days: daysFormatted,
      alerts
    };

    // Retornar HTML diretamente (não JSON) para abrir no navegador
    return new NextResponse(generateReportHTML(reportData), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    });

  } catch (error) {
    // Tratar erro de autenticação
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    logError('Error generating report:', error);
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 });
  }
}

function generateReportHTML(data: ReportHtmlData): string {
  const { periodLabel, startDate, endDate, matricula, statistics, days, alerts, timezone } = data;

  return `<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório - Diário do Motorista</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Arial, Helvetica, sans-serif; 
      padding: 20px; 
      max-width: 210mm; 
      margin: 0 auto; 
      font-size: 11px;
      background: #fff;
    }
    
    h1 { 
      color: #1e3a5f; 
      border-bottom: 3px solid #22c55e; 
      padding-bottom: 8px; 
      font-size: 18px;
      margin-bottom: 5px;
    }
    
    h2 { 
      color: #334155; 
      margin-top: 15px; 
      margin-bottom: 10px;
      font-size: 14px;
    }
    
    .period { 
      background: #f1f5f9; 
      padding: 10px 12px; 
      border-radius: 6px; 
      margin: 12px 0; 
      font-size: 10px;
    }
    
    .stats { 
      display: flex; 
      gap: 8px; 
      margin: 15px 0;
    }
    
    .stat-box { 
      flex: 1;
      background: #1e3a5f; 
      color: white; 
      padding: 10px 8px; 
      border-radius: 6px; 
      text-align: center; 
    }
    
    .stat-value { 
      font-size: 16px; 
      font-weight: bold; 
    }
    
    .stat-label { 
      font-size: 8px; 
      opacity: 0.8;
      margin-top: 2px;
    }
    
    .alerts { 
      background: #fef3c7; 
      border-left: 3px solid #f59e0b; 
      padding: 10px 12px; 
      margin: 15px 0; 
      border-radius: 0 6px 6px 0;
    }
    
    .alerts h3 { 
      color: #92400e; 
      margin-bottom: 6px;
      font-size: 11px;
    }
    
    .alerts ul { 
      margin-left: 18px;
      font-size: 10px;
    }
    
    .alerts li { 
      color: #78350f; 
      margin: 3px 0; 
    }
    
    .day-section { 
      margin-bottom: 12px; 
      border: 1px solid #e2e8f0; 
      border-radius: 6px; 
      overflow: hidden;
      page-break-inside: avoid;
    }
    
    .day-header { 
      background: #1e3a5f; 
      color: white; 
      padding: 8px 12px; 
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      font-size: 11px;
    }
    
    .day-header h3 { 
      font-size: 12px;
      font-weight: bold;
    }
    
    .badge { 
      background: #22c55e; 
      padding: 2px 8px; 
      border-radius: 4px; 
      font-size: 10px;
    }
    
    .day-info { 
      display: grid; 
      grid-template-columns: repeat(4, 1fr); 
      gap: 8px; 
      padding: 10px 12px; 
      background: #f8fafc; 
    }
    
    .day-info-item { 
      text-align: center; 
    }
    
    .day-info-item .label { 
      font-size: 9px; 
      color: #64748b; 
    }
    
    .day-info-item .value { 
      font-size: 13px; 
      font-weight: bold; 
      color: #1e3a5f; 
    }
    
    .turnos-section { 
      padding: 0 12px 10px 12px; 
    }
    
    .turnos-title { 
      font-size: 10px; 
      color: #64748b; 
      margin-bottom: 6px; 
      font-weight: bold; 
    }
    
    table.turnos-table { 
      width: 100%; 
      border-collapse: collapse; 
      font-size: 10px; 
    }
    
    table.turnos-table th { 
      background: #334155; 
      color: white; 
      padding: 5px; 
      text-align: center; 
    }
    
    table.turnos-table td { 
      padding: 5px; 
      text-align: center; 
      border-bottom: 1px solid #e2e8f0; 
    }
    
    table.turnos-table tr:nth-child(even) td { 
      background: #f8fafc; 
    }
    
    .extras {
      padding: 0 12px 8px 12px;
      font-size: 9px;
      color: #64748b;
      font-style: italic;
    }
    
    .footer { 
      margin-top: 20px; 
      text-align: center; 
      color: #64748b; 
      font-size: 9px; 
      border-top: 1px solid #e2e8f0; 
      padding-top: 12px; 
    }
    
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1e3a5f;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 1000;
    }
    
    .print-btn:hover {
      background: #22c55e;
    }
    
    @media print {
      body { padding: 0; max-width: none; }
      .print-btn { display: none !important; }
      .stat-box { break-inside: avoid; }
      .day-section { break-inside: avoid; page-break-inside: avoid; }
      .alerts { break-inside: avoid; }
    }
    
    @media screen and (max-width: 600px) {
      .stats { flex-direction: column; }
      .day-info { grid-template-columns: repeat(2, 1fr); }
      .print-btn { 
        position: fixed;
        bottom: 20px;
        top: auto;
        right: 20px;
      }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">📄 Imprimir / Salvar PDF</button>
  
  <h1>🚛 Diário do Motorista</h1>
  <p style="color: #64748b; text-align: center; margin-bottom: 15px;">Relatório de Jornada de Trabalho</p>
  
  <div class="period">
    <strong>Período:</strong> ${escapeHtml(periodLabel)}<br>
    <strong>De:</strong> ${escapeHtml(startDate)} <strong>até</strong> ${escapeHtml(endDate)}
    ${matricula ? `<br><strong>Veículo:</strong> ${escapeHtml(matricula)}` : ''}
  </div>

  <h2>📊 Resumo do Período</h2>
  
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
      <div class="stat-label">Horas Condução</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${statistics.avgHoursPerDay}h</div>
      <div class="stat-label">Média Horas/Dia</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${statistics.avgKmPerDay}</div>
      <div class="stat-label">Média KM/Dia</div>
    </div>
  </div>

  ${alerts.length > 0 ? `
  <div class="alerts">
    <h3>⚠️ Alertas de Conformidade (Reg. CE 561/2006)</h3>
    <ul>
      ${alerts.map((a: string) => `<li>${a}</li>`).join('')}
    </ul>
  </div>
  ` : ''}

  <h2>📋 Detalhamento Diário com Turnos</h2>
  
  ${days.length > 0 ? days.map((d) => `
  <div class="day-section">
    <div class="day-header">
      <h3>📅 ${d.dateFormatted}</h3>
      <div>
        ${d.matricula !== '-' ? `<span style="margin-right: 12px;">🚛 ${escapeHtml(d.matricula)}</span>` : ''}
        <span class="badge">${d.turnosCount} turno${d.turnosCount > 1 ? 's' : ''} | ${d.kmTraveled} km | ${d.hours}h</span>
      </div>
    </div>
    
    <div class="day-info">
      <div class="day-info-item">
        <div class="label">Início</div>
        <div class="value">${escapeHtml(d.startTime)}</div>
        <div class="label">${escapeHtml(d.startCountry)}</div>
      </div>
      <div class="day-info-item">
        <div class="label">Fim</div>
        <div class="value">${escapeHtml(d.endTime)}</div>
        <div class="label">${escapeHtml(d.endCountry)}</div>
      </div>
      <div class="day-info-item">
        <div class="label">KM Percorrido</div>
        <div class="value">${d.kmTraveled} km</div>
      </div>
      <div class="day-info-item">
        <div class="label">Horas Condução</div>
        <div class="value">${d.hours}h</div>
      </div>
    </div>
    
    ${d.turnos.length > 0 ? `
    <div class="turnos-section">
      <div class="turnos-title">📍 Detalhamento dos Turnos:</div>
      <table class="turnos-table">
        <thead>
          <tr>
            <th>Turno</th>
            <th>Hora Início</th>
            <th>Hora Fim</th>
            <th>KM Início</th>
            <th>KM Fim</th>
            <th>KM Perc.</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${d.turnos.map((t) => `
          <tr>
            <td><strong>${t.numero}</strong></td>
            <td>${escapeHtml(t.startTime)}</td>
            <td>${escapeHtml(t.endTime)}</td>
            <td>${t.startKm}</td>
            <td>${t.endKm}</td>
            <td><strong>${t.km} km</strong></td>
            <td>${t.status === 'ended' ? '✓ Concluído' : t.status === 'paused' ? '⏸ Pausado' : '▶ Em curso'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}
    
    ${d.events > 0 || d.truckCheck === 'Sim' ? `
    <div class="extras">
      ${d.events > 0 ? `📝 ${d.events} evento${d.events > 1 ? 's' : ''} registado${d.events > 1 ? 's' : ''} neste dia` : ''}
      ${d.events > 0 && d.truckCheck === 'Sim' ? ' | ' : ''}
      ${d.truckCheck === 'Sim' ? '✅ Check do caminhão realizado' : ''}
    </div>
    ` : ''}
  </div>
  `).join('') : '<p style="text-align: center; color: #64748b; padding: 20px;">Nenhum registro encontrado para o período.</p>'}

  <div class="footer">
    <p><strong>Relatório gerado em ${new Date().toLocaleDateString('pt-PT', { timeZone: timezone || undefined })} às ${new Date().toLocaleTimeString('pt-PT', { timeZone: timezone || undefined })}</strong></p>
    <p>Diário do Motorista - Sistema de Controle de Jornada | Conformidade com Reg. CE 561/2006</p>
  </div>
</body>
</html>`;
}
