import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { calcKmTraveled, calcWorkDayHours, calcWorkActivityMinutes, formatDecimalHours } from '@/lib/time';
import { log, logError } from '@/lib/logger';
import { requireAuth } from '@/lib/auth';
import { formatDatePtServer } from '@/lib/timezone';
import { escapeHtml } from '@/lib/html';
import { endOfUtcDay, isValidTimezone, parseDateOnlyUtc, startOfUtcDay, validateMatricula } from '@/lib/validators';

type VehicleReportWorkDay = Prisma.WorkDayGetPayload<{
  include: { events: true; drivingSessions: true; workActivities: true; breakPeriods: true };
}>;

interface VehicleReportHtmlData {
  matricula: string;
  periodLabel: string;
  startDate: Date | null;
  endDate: Date | null;
  timezone: string | null;
  statistics: {
    diasTrabalhados: number;
    totalKm: number;
    totalHours: number;
    totalEvents: number;
    avgHoursPerDay: number;
    avgKmPerDay: number;
    kmInicial: number | null;
    kmFinal: number | null;
    paises: string[];
  };
  days: Array<{
    dateFormatted: string;
    startTime: string;
    endTime: string;
    startKm: number | string;
    endKm: number | string;
    kmTraveled: number;
    hours: number;
    /** Minutos em atividades sem condução (carregamento, abastecimento, ...) */
    activityMinutes: number;
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
}

// GET - PDF/HTML para relatório de veículo
// Quando matrícula é fornecida, busca TODOS os registros do veículo (sem filtro de data)
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const { searchParams } = new URL(request.url);
    const matricula = searchParams.get('matricula');
    const customStartDate = searchParams.get('startDate');
    const customEndDate = searchParams.get('endDate');
    const timezone = searchParams.get('timezone');

    log('=== RELATÓRIO DE VEÍCULO ===');
    log('Matrícula:', matricula);
    log('Datas personalizadas:', customStartDate, customEndDate);

    if (!matricula) {
      return NextResponse.json({ error: 'Matrícula é obrigatória' }, { status: 400 });
    }
    const normalizedMatricula = validateMatricula(matricula);
    if (!normalizedMatricula.valid || !isValidTimezone(timezone)) {
      return NextResponse.json({ error: 'Matrícula ou fuso horário inválido' }, { status: 400 });
    }
    if (Boolean(customStartDate) !== Boolean(customEndDate)) {
      return NextResponse.json({ error: 'Informe as datas inicial e final do período' }, { status: 400 });
    }

    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let periodLabel: string;
    let historico: VehicleReportWorkDay[] = [];

    // Se tem datas personalizadas, usar período específico
    if (customStartDate && customEndDate) {
      startDate = parseDateOnlyUtc(customStartDate);
      const parsedEndDate = parseDateOnlyUtc(customEndDate);
      if (!startDate || !parsedEndDate || startDate > parsedEndDate) {
        return NextResponse.json({ error: 'Período personalizado inválido' }, { status: 400 });
      }
      endDate = new Date(parsedEndDate);
      endDate.setUTCHours(23, 59, 59, 999);
      
      periodLabel = `Período: ${formatDatePtServer(startDate, timezone)} a ${formatDatePtServer(endDate, timezone)}`;
      
      // Buscar com filtro de data
      historico = await db.workDay.findMany({
        where: {
          userId,
          matricula: normalizedMatricula.normalized,
          date: { gte: startDate, lte: endDate },
        },
        include: {
          events: true,
          drivingSessions: {
            orderBy: { createdAt: 'asc' }
          },
          workActivities: {
            orderBy: { startedAt: 'asc' }
          },
          breakPeriods: { orderBy: { startedAt: 'asc' } },
        },
        orderBy: { createdAt: 'asc' }
      });
    } else {
      // SEM filtro de data - buscar TODOS os registros do veículo
      historico = await db.workDay.findMany({
        where: {
          userId,
          matricula: normalizedMatricula.normalized
        },
        include: {
          events: true,
          drivingSessions: {
            orderBy: { createdAt: 'asc' }
          },
          workActivities: {
            orderBy: { startedAt: 'asc' }
          },
          breakPeriods: { orderBy: { startedAt: 'asc' } },
        },
        orderBy: { createdAt: 'asc' }
      });

      log('Registros encontrados:', historico.length);

      // Determinar período baseado nos dados encontrados
      if (historico.length > 0) {
        const validDates = historico
          .filter(r => r.date !== null)
          .map(r => r.date as Date)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

        if (validDates.length > 0) {
          startDate = startOfUtcDay(validDates[0]);
          endDate = endOfUtcDay(validDates[validDates.length - 1]);
        } else {
          // Usar createdAt se não há datas válidas
          const createdDates = historico.map(r => r.createdAt).sort();
          startDate = startOfUtcDay(createdDates[0]);
          endDate = endOfUtcDay(createdDates[createdDates.length - 1]);
        }
        
        periodLabel = `Todos os registros de ${formatDatePtServer(startDate, timezone)} a ${formatDatePtServer(endDate, timezone)}`;
      } else {
        // Veículo sem registros
        startDate = startOfUtcDay(new Date());
        endDate = endOfUtcDay(new Date());
        periodLabel = 'Veículo sem registros';
      }
    }

    // Calcular estatísticas do veículo
    let totalKm = 0;
    let totalHours = 0;
    let totalEvents = 0;
    let kmInicial: number | null = null;
    let kmFinal: number | null = null;
    const paises = new Set<string>();

    const diasFormatados = historico.map(day => {
      // KM — centralizado em calcKmTraveled
      const dayKm = calcKmTraveled(day.drivingSessions || [], day.startKm, day.endKm) || 0;
      totalKm += dayKm;

      // Registrar KM inicial e final do período
      if (kmInicial === null && day.startKm != null) {
        kmInicial = day.startKm;
      }
      if (day.endKm != null) {
        kmFinal = day.endKm;
      }

      const dayHours = calcWorkDayHours(day, new Date(), null) ?? 0;
      totalHours += dayHours;

      totalEvents += day.events.length;

      // Coletar países
      if (day.startCountry) paises.add(day.startCountry);
      if (day.endCountry) paises.add(day.endCountry);

      // Formatar turnos
      const turnos = day.drivingSessions.map((session, index) => ({
        numero: index + 1,
        startTime: session.startTime || '--:--',
        endTime: session.endTime || '--:--',
        startKm: session.startKm?.toLocaleString() || '--',
        endKm: session.endKm?.toLocaleString() || '--',
        km: session.startKm != null && session.endKm != null ? session.endKm - session.startKm : 0,
        status: session.status
      }));

      return {
        date: day.date,
        dateFormatted: day.date ? formatDatePtServer(day.date, timezone) : 'Sem data',
        startTime: day.startTime || '-',
        endTime: day.endTime || '-',
        startKm: day.startKm ?? '-',
        endKm: day.endKm ?? '-',
        kmTraveled: dayKm,
        hours: parseFloat(dayHours.toFixed(1)),
        activityMinutes: calcWorkActivityMinutes(day.workActivities),
        startCountry: day.startCountry || '-',
        endCountry: day.endCountry || '-',
        events: day.events.length,
        truckCheck: day.truckCheck ? 'Sim' : 'Não',
        turnosCount: turnos.length,
        turnos
      };
    });

    // Retornar HTML diretamente para abrir no navegador
    const daysWorked = new Set(historico.map(day => (day.date ?? day.createdAt).toISOString().slice(0, 10))).size;
    const html = generateVehicleReportHTML({
      matricula: normalizedMatricula.normalized,
      periodLabel,
      startDate,
      endDate,
      timezone,  // Passar timezone para formatação no HTML
      statistics: {
        diasTrabalhados: daysWorked,
        totalKm,
        totalHours: parseFloat(totalHours.toFixed(1)),
        totalEvents,
        avgHoursPerDay: daysWorked > 0 ? parseFloat((totalHours / daysWorked).toFixed(1)) : 0,
        avgKmPerDay: daysWorked > 0 ? Math.round(totalKm / daysWorked) : 0,
        kmInicial,
        kmFinal,
        paises: Array.from(paises)
      },
      days: diasFormatados
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    });

  } catch (error) {
    logError('Error generating vehicle PDF report:', error);
    return NextResponse.json({ error: 'Erro ao gerar relatório do veículo' }, { status: 500 });
  }
}

function generateVehicleReportHTML(data: VehicleReportHtmlData): string {
  const { matricula, periodLabel, startDate, endDate, statistics, days, timezone } = data;

  return `<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório do Veículo - ${escapeHtml(matricula)}</title>
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
      border-bottom: 3px solid #3b82f6; 
      padding-bottom: 8px; 
      font-size: 18px;
    }
    
    h2 { 
      color: #334155; 
      margin-top: 15px; 
      margin-bottom: 10px;
      font-size: 14px;
    }
    
    .vehicle-header { 
      background: linear-gradient(135deg, #3b82f6, #1e40af); 
      color: white; 
      padding: 15px; 
      border-radius: 8px; 
      margin: 12px 0; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
    }
    
    .vehicle-plate { 
      font-size: 28px; 
      font-weight: bold; 
      letter-spacing: 4px; 
      background: rgba(255,255,255,0.2); 
      padding: 8px 16px; 
      border-radius: 6px; 
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
    
    .km-info { 
      display: flex; 
      gap: 10px; 
      margin: 15px 0; 
    }
    
    .km-box { 
      flex: 1;
      background: #e0f2fe; 
      border: 2px solid #3b82f6; 
      padding: 12px; 
      border-radius: 6px; 
      text-align: center; 
    }
    
    .km-box .label { 
      font-size: 10px; 
      color: #0369a1; 
      font-weight: bold; 
    }
    
    .km-box .value { 
      font-size: 20px; 
      font-weight: bold; 
      color: #1e40af; 
    }
    
    .paises-section { 
      margin: 12px 0; 
      padding: 10px; 
      background: #f0fdf4; 
      border-radius: 6px; 
      border: 1px solid #86efac; 
    }
    
    .paises-title { 
      font-size: 10px; 
      color: #166534; 
      font-weight: bold; 
      margin-bottom: 5px; 
    }
    
    .paises-list { 
      display: flex; 
      flex-wrap: wrap; 
      gap: 5px; 
    }
    
    .pais-badge { 
      background: #22c55e; 
      color: white; 
      padding: 3px 8px; 
      border-radius: 4px; 
      font-size: 10px; 
    }
    
    .day-section { 
      margin-bottom: 10px; 
      border: 1px solid #e2e8f0; 
      border-radius: 6px; 
      overflow: hidden;
      page-break-inside: avoid;
    }
    
    .day-header { 
      background: #3b82f6; 
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
      grid-template-columns: repeat(5, 1fr); 
      gap: 6px; 
      padding: 10px 12px; 
      background: #f8fafc; 
    }
    
    .day-info-item { 
      text-align: center; 
    }
    
    .day-info-item .label { 
      font-size: 8px; 
      color: #64748b; 
    }
    
    .day-info-item .value { 
      font-size: 12px; 
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
      font-size: 9px; 
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
      background: #3b82f6;
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
    }
    
    @media screen and (max-width: 600px) {
      .stats { flex-direction: column; }
      .km-info { flex-direction: column; }
      .day-info { grid-template-columns: repeat(3, 1fr); }
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
  
  <h1>🚛 Relatório do Veículo</h1>
  
  <div class="vehicle-header">
    <div>
      <p style="margin: 0; opacity: 0.8; font-size: 11px;">Matrícula</p>
      <div class="vehicle-plate">${escapeHtml(matricula)}</div>
    </div>
    <div style="text-align: right;">
      <p style="margin: 0; opacity: 0.8; font-size: 11px;">Período</p>
      <p style="margin: 0; font-size: 14px; font-weight: bold;">${escapeHtml(periodLabel)}</p>
      ${startDate && endDate ? `<p style="margin: 0; font-size: 10px; opacity: 0.8;">${formatDatePtServer(startDate, timezone)} a ${formatDatePtServer(endDate, timezone)}</p>` : ''}
    </div>
  </div>

  <h2>📊 Resumo do Período</h2>
  
  <div class="stats">
    <div class="stat-box">
      <div class="stat-value">${statistics.diasTrabalhados}</div>
      <div class="stat-label">Dias em Serviço</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${statistics.totalKm.toLocaleString()}</div>
      <div class="stat-label">KM Total</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${statistics.totalHours}h</div>
      <div class="stat-label">Horas de Uso</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${statistics.avgKmPerDay}</div>
      <div class="stat-label">Média KM/Dia</div>
    </div>
  </div>
  
  <div class="km-info">
    <div class="km-box">
      <div class="label">KM Inicial do Período</div>
      <div class="value">${statistics.kmInicial?.toLocaleString() || '--'}</div>
    </div>
    <div class="km-box">
      <div class="label">KM Final do Período</div>
      <div class="value">${statistics.kmFinal?.toLocaleString() || '--'}</div>
    </div>
  </div>
  
  ${statistics.paises.length > 0 ? `
  <div class="paises-section">
    <div class="paises-title">🌍 Países Percorridos</div>
    <div class="paises-list">
      ${statistics.paises.map((p: string) => `<span class="pais-badge">${escapeHtml(p)}</span>`).join('')}
    </div>
  </div>
  ` : ''}

  <h2>📋 Histórico de Utilização</h2>
  
  ${days.length === 0 ? `
  <p style="text-align: center; color: #64748b; padding: 20px;">
    Nenhum registro encontrado para este veículo.
  </p>
  ` : days.map((d) => `
  <div class="day-section">
    <div class="day-header">
      <h3>📅 ${d.dateFormatted}</h3>
      <span class="badge">${d.turnosCount} turno${d.turnosCount > 1 ? 's' : ''} | ${d.kmTraveled} km | ${d.hours}h</span>
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
        <div class="label">KM Início</div>
        <div class="value">${typeof d.startKm === 'number' ? d.startKm.toLocaleString() : d.startKm}</div>
      </div>
      <div class="day-info-item">
        <div class="label">KM Fim</div>
        <div class="value">${typeof d.endKm === 'number' ? d.endKm.toLocaleString() : d.endKm}</div>
      </div>
      <div class="day-info-item">
        <div class="label">KM Dia</div>
        <div class="value">${d.kmTraveled} km</div>
      </div>
      <div class="day-info-item">
        <div class="label">Serviço sem Condução</div>
        <div class="value">${formatDecimalHours(d.activityMinutes / 60)}</div>
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
      ${d.events > 0 ? `📝 ${d.events} evento${d.events > 1 ? 's' : ''} registado${d.events > 1 ? 's' : ''}` : ''}
      ${d.events > 0 && d.truckCheck === 'Sim' ? ' | ' : ''}
      ${d.truckCheck === 'Sim' ? '✅ Check realizado' : ''}
    </div>
    ` : ''}
  </div>
  `).join('')}

  <div class="footer">
    <p><strong>Relatório gerado em ${new Date().toLocaleDateString('pt-PT', { timeZone: timezone || undefined })} às ${new Date().toLocaleTimeString('pt-PT', { timeZone: timezone || undefined })}</strong></p>
    <p>Diário do Motorista - Sistema de Controle de Veículos</p>
  </div>
</body>
</html>`;
}
