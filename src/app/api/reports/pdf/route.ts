import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { calcHoursWorked, calcKmTraveled, MAX_DAY_HOURS } from '@/lib/time';
import { log, logError } from '@/lib/logger';
import { formatDatePtServer } from '@/lib/timezone';

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
    const referenceDate = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date();

    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let periodLabel: string;
    let workDays: any[] = [];

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
            orderBy: { startTime: 'asc' }
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
          startDate = new Date(validDates[0]);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(validDates[validDates.length - 1]);
          endDate.setHours(23, 59, 59, 999);
        } else {
          // Se não há datas válidas, usar createdAt
          const createdDates = allVehicleRecords.map(r => r.createdAt).sort();
          startDate = new Date(createdDates[0]);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(createdDates[createdDates.length - 1]);
          endDate.setHours(23, 59, 59, 999);
        }

        const startFormatted = formatDatePtServer(startDate, timezone, { day: '2-digit', month: '2-digit', year: 'numeric' });
        const endFormatted = formatDatePtServer(endDate, timezone, { day: '2-digit', month: '2-digit', year: 'numeric' });
        periodLabel = `Veículo: ${matricula.toUpperCase()} | ${startFormatted} a ${endFormatted}`;
      } else {
        // Veículo sem registros
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        periodLabel = `Veículo: ${matricula.toUpperCase()} - Sem registros`;
      }
    } else if (customStartDate && customEndDate) {
      // Período personalizado
      startDate = new Date(customStartDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);

      const startFormatted = formatDatePtServer(startDate, timezone, { day: '2-digit', month: '2-digit' });
      const endFormatted = formatDatePtServer(endDate, timezone, { day: '2-digit', month: '2-digit', year: 'numeric' });
      periodLabel = `Período: ${startFormatted} a ${endFormatted}`;
      if (matricula) {
        periodLabel += ` | Veículo: ${matricula.toUpperCase()}`;
      }

      // ✅ ISOLAMENTO: Buscar dias de trabalho do usuário
      const whereClause: any = {
        userId,  // ← OBRIGATÓRIO
        OR: [
          { date: { gte: startDate, lte: endDate } },
          { date: null }
        ]
      };

      if (matricula) {
        whereClause.matricula = matricula.toUpperCase();
      }

      workDays = await db.workDay.findMany({
        where: whereClause,
        include: {
          events: true,
          drivingSessions: {
            orderBy: { startTime: 'asc' }
          }
        },
        orderBy: { date: 'asc' }
      });
    } else if (type === 'weekly') {
      const dayOfWeek = referenceDate.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(referenceDate);
      startDate.setDate(referenceDate.getDate() - diff);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);

      const weekNum = Math.ceil((startDate.getDate() + new Date(startDate.getFullYear(), startDate.getMonth(), 1).getDay()) / 7);
      periodLabel = `Semana ${weekNum} de ${formatDatePtServer(startDate, timezone, { month: 'long', year: 'numeric' })}`;

      // ✅ ISOLAMENTO: Buscar dias de trabalho do usuário
      workDays = await db.workDay.findMany({
        where: {
          userId,  // ← OBRIGATÓRIO
          OR: [
            { date: { gte: startDate, lte: endDate } },
            { date: null }
          ]
        },
        include: {
          events: true,
          drivingSessions: {
            orderBy: { startTime: 'asc' }
          }
        },
        orderBy: { date: 'asc' }
      });
    } else {
      // Monthly
      startDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);

      periodLabel = formatDatePtServer(referenceDate, timezone, { month: 'long', year: 'numeric' });

      // ✅ ISOLAMENTO: Buscar dias de trabalho do usuário
      workDays = await db.workDay.findMany({
        where: {
          userId,  // ← OBRIGATÓRIO
          OR: [
            { date: { gte: startDate, lte: endDate } },
            { date: null }
          ]
        },
        include: {
          events: true,
          drivingSessions: {
            orderBy: { startTime: 'asc' }
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

      // Calcular horas — centralizado em calcHoursWorked
      // Proteção dupla: limitar a 15h por dia (ninguém conduz mais que 15h)
      const rawDayHours = calcHoursWorked(day.drivingSessions || [], day.startTime, day.endTime) || 0;
      const dayHours = Math.min(rawDayHours, MAX_DAY_HOURS);
      totalHours += dayHours;

      totalEvents += day.events.length;

      // Formatar turnos
      const turnos = (day.drivingSessions || []).map((session: any, index: number) => ({
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
        startKm: day.startKm || '-',
        endKm: day.endKm || '-',
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

    // Preparar dados para o relatório
    const reportData = {
      periodLabel,
      type,
      startDate: startDate ? formatDatePtServer(startDate, timezone) : '-',
      endDate: endDate ? formatDatePtServer(endDate, timezone) : '-',
      matricula,
      timezone,  // Passar timezone para formatação no HTML
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

function generateReportHTML(data: any): string {
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
    <strong>Período:</strong> ${periodLabel}<br>
    <strong>De:</strong> ${startDate} <strong>até</strong> ${endDate}
    ${matricula ? `<br><strong>Veículo:</strong> ${matricula}` : ''}
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
  
  ${days.length > 0 ? days.map((d: any) => `
  <div class="day-section">
    <div class="day-header">
      <h3>📅 ${d.dateFormatted}</h3>
      <div>
        ${d.matricula !== '-' ? `<span style="margin-right: 12px;">🚛 ${d.matricula}</span>` : ''}
        <span class="badge">${d.turnosCount} turno${d.turnosCount > 1 ? 's' : ''} | ${d.kmTraveled} km | ${d.hours}h</span>
      </div>
    </div>
    
    <div class="day-info">
      <div class="day-info-item">
        <div class="label">Início</div>
        <div class="value">${d.startTime}</div>
        <div class="label">${d.startCountry}</div>
      </div>
      <div class="day-info-item">
        <div class="label">Fim</div>
        <div class="value">${d.endTime}</div>
        <div class="label">${d.endCountry}</div>
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
          ${d.turnos.map((t: any) => `
          <tr>
            <td><strong>${t.numero}</strong></td>
            <td>${t.startTime}</td>
            <td>${t.endTime}</td>
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
