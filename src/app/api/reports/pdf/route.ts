import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import PDFDocument from 'pdfkit';

// GET - Dados para relatório PDF ou gerar PDF
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'weekly';
    const matricula = searchParams.get('matricula');
    const customStartDate = searchParams.get('startDate');
    const customEndDate = searchParams.get('endDate');
    const referenceDate = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date();
    const format = searchParams.get('format') || 'pdf'; // 'pdf' ou 'html'

    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    // Se datas personalizadas foram fornecidas
    if (customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);
      
      const startFormatted = startDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
      const endFormatted = endDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      periodLabel = `Período: ${startFormatted} a ${endFormatted}`;
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
      include: { 
        events: true,
        drivingSessions: {
          orderBy: { startTime: 'asc' }
        }
      },
      orderBy: { date: 'asc' }
    });

    // Calcular estatísticas
    let totalKm = 0;
    let totalHours = 0;
    let totalEvents = 0;

    const daysFormatted = workDays.map(day => {
      // Calcular KM total das sessões de condução
      let dayKm = 0;
      if (day.drivingSessions && day.drivingSessions.length > 0) {
        dayKm = day.drivingSessions.reduce((total, session) => {
          if (session.startKm && session.endKm) {
            return total + (session.endKm - session.startKm);
          }
          return total;
        }, 0);
      } else if (day.endKm && day.startKm) {
        dayKm = day.endKm - day.startKm;
      }
      totalKm += dayKm;

      // Calcular horas das sessões
      let dayHours = 0;
      if (day.drivingSessions && day.drivingSessions.length > 0) {
        for (const session of day.drivingSessions) {
          if (session.startTime && session.endTime) {
            const [startH, startM] = session.startTime.split(':').map(Number);
            const [endH, endM] = session.endTime.split(':').map(Number);
            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;
            let diff = endMinutes - startMinutes;
            if (diff < 0) diff += 24 * 60;
            dayHours += diff / 60;
          }
        }
      } else if (day.startTime && day.endTime) {
        const [startH, startM] = day.startTime.split(':').map(Number);
        const [endH, endM] = day.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        dayHours = (endMinutes - startMinutes) / 60;
        if (dayHours < 0) dayHours += 24;
      }
      totalHours += dayHours;

      totalEvents += day.events.length;

      // Formatar turnos para o relatório
      const turnos = (day.drivingSessions || []).map((session, index) => ({
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
        dateFormatted: day.date ? day.date.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' }) : '-',
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
      startDate: startDate.toLocaleDateString('pt-PT'),
      endDate: endDate.toLocaleDateString('pt-PT'),
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
    };

    // Se formato for HTML, retornar JSON com HTML
    if (format === 'html') {
      const html = generateReportHTML(reportData);
      return NextResponse.json({
        period: {
          start: startDate,
          end: endDate,
          label: periodLabel,
          type
        },
        matricula,
        statistics: reportData.statistics,
        days: daysFormatted,
        alerts,
        html
      });
    }

    // Gerar PDF usando pdfkit (funciona no Vercel)
    const pdfBuffer = await generatePDF(reportData);

    // Retornar PDF como resposta
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="relatorio_motorista_${new Date().toISOString().split('T')[0]}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    });

  } catch (error) {
    console.error('Error generating PDF report:', error);
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 });
  }
}

// Função para gerar PDF usando pdfkit
async function generatePDF(data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: 'Relatorio_Diario_Motorista',
          Author: 'Z.ai',
          Creator: 'Z.ai',
          Subject: 'Relatório de Jornada de Trabalho do Motorista'
        }
      });

      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Cores
      const primaryColor = '#1e3a5f';
      const accentColor = '#22c55e';
      const headerBg = '#1F4E79';
      const lightGray = '#f8fafc';

      // ====== CABEÇALHO ======
      doc.fontSize(20)
         .fillColor(primaryColor)
         .font('Helvetica-Bold')
         .text('Diário do Motorista', { align: 'center' });
      
      doc.fontSize(12)
         .fillColor('#64748b')
         .font('Helvetica')
         .text('Relatório de Jornada de Trabalho', { align: 'center' });
      
      doc.moveDown(0.5);

      // Informações do período
      doc.fontSize(10)
         .fillColor('#000000')
         .font('Helvetica-Bold')
         .text('Período: ', { continued: true })
         .font('Helvetica')
         .text(data.periodLabel);
      
      doc.font('Helvetica-Bold').text('De: ', { continued: true })
         .font('Helvetica').text(data.startDate + ' ', { continued: true })
         .font('Helvetica-Bold').text('até: ', { continued: true })
         .font('Helvetica').text(data.endDate);
      
      if (data.matricula) {
        doc.font('Helvetica-Bold').text('Veículo: ', { continued: true })
           .font('Helvetica').text(data.matricula);
      }

      doc.moveDown(1);

      // ====== ESTATÍSTICAS ======
      doc.fontSize(14)
         .fillColor(primaryColor)
         .font('Helvetica-Bold')
         .text('Resumo do Período');
      
      doc.moveDown(0.5);

      // Tabela de estatísticas
      const stats = data.statistics;
      const statWidth = 95;
      const statHeight = 50;
      const startX = 50;
      const startY = doc.y;

      // Desenhar caixas de estatísticas
      const statItems = [
        { value: stats.daysWorked.toString(), label: 'Dias Trabalhados' },
        { value: stats.totalKm.toLocaleString(), label: 'KM Total' },
        { value: stats.totalHours + 'h', label: 'Horas Condução' },
        { value: stats.avgHoursPerDay + 'h', label: 'Média Horas/Dia' },
        { value: stats.avgKmPerDay.toString(), label: 'Média KM/Dia' }
      ];

      statItems.forEach((item, i) => {
        const x = startX + (i * statWidth);
        
        // Caixa
        doc.rect(x, startY, statWidth - 5, statHeight)
           .fill(primaryColor);
        
        // Valor
        doc.fontSize(16)
           .fillColor('#ffffff')
           .font('Helvetica-Bold')
           .text(item.value, x, startY + 10, { width: statWidth - 5, align: 'center' });
        
        // Label
        doc.fontSize(8)
           .fillColor('#94a3b8')
           .font('Helvetica')
           .text(item.label, x, startY + 32, { width: statWidth - 5, align: 'center' });
      });

      doc.y = startY + statHeight + 20;

      // ====== ALERTAS ======
      if (data.alerts && data.alerts.length > 0) {
        doc.fontSize(14)
           .fillColor(primaryColor)
           .font('Helvetica-Bold')
           .text('Alertas de Conformidade (Reg. CE 561/2006)');
        
        doc.moveDown(0.3);

        // Caixa de alerta
        const alertY = doc.y;
        doc.rect(50, alertY, 500, 10 + data.alerts.length * 15)
           .fill('#fef3c7')
           .stroke('#f59e0b');

        doc.fontSize(9)
           .fillColor('#92400e')
           .font('Helvetica');
        
        data.alerts.forEach((alert: string, i: number) => {
          doc.text('• ' + alert, 60, alertY + 5 + (i * 15));
        });

        doc.y = alertY + 15 + data.alerts.length * 15 + 10;
      }

      // ====== DETALHAMENTO DIÁRIO ======
      doc.fontSize(14)
         .fillColor(primaryColor)
         .font('Helvetica-Bold')
         .text('Detalhamento Diário com Turnos');
      
      doc.moveDown(0.5);

      // Dias
      for (const day of data.days) {
        // Verificar se precisa de nova página
        if (doc.y > 700) {
          doc.addPage();
        }

        // Cabeçalho do dia
        doc.fontSize(11)
           .fillColor(primaryColor)
           .font('Helvetica-Bold')
           .text(day.dateFormatted + (day.matricula !== '-' ? ` | Veículo: ${day.matricula}` : '') + 
                 ` | ${day.turnosCount} turno(s) | ${day.kmTraveled} km | ${day.hours}h`);

        // Informações do dia
        const dayStartY = doc.y + 5;
        const colWidth = 125;

        // Desenhar tabela
        doc.rect(50, dayStartY, colWidth * 4, 40)
           .fill(lightGray)
           .stroke('#e2e8f0');

        // Cabeçalho da tabela
        doc.fontSize(9)
           .fillColor('#ffffff')
           .font('Helvetica-Bold');
        
        const headers = ['Início', 'Fim', 'KM Percorrido', 'Horas Condução'];
        headers.forEach((h, i) => {
          doc.rect(50 + (i * colWidth), dayStartY, colWidth, 15)
             .fill(headerBg);
          doc.text(h, 50 + (i * colWidth), dayStartY + 3, { width: colWidth, align: 'center' });
        });

        // Dados
        doc.fontSize(10)
           .fillColor('#000000')
           .font('Helvetica-Bold');
        
        doc.text(day.startTime, 50, dayStartY + 20, { width: colWidth, align: 'center' });
        doc.text(day.endTime, 50 + colWidth, dayStartY + 20, { width: colWidth, align: 'center' });
        doc.text(day.kmTraveled + ' km', 50 + colWidth * 2, dayStartY + 20, { width: colWidth, align: 'center' });
        doc.text(day.hours + 'h', 50 + colWidth * 3, dayStartY + 20, { width: colWidth, align: 'center' });

        doc.font('Helvetica')
           .fontSize(8)
           .fillColor('#64748b');
        doc.text(day.startCountry, 50, dayStartY + 33, { width: colWidth, align: 'center' });
        doc.text(day.endCountry, 50 + colWidth, dayStartY + 33, { width: colWidth, align: 'center' });

        doc.y = dayStartY + 50;

        // Turnos
        if (day.turnos && day.turnos.length > 0) {
          doc.fontSize(9)
             .fillColor('#64748b')
             .font('Helvetica-Bold')
             .text('Turnos:');
          
          doc.moveDown(0.3);

          // Cabeçalho dos turnos
          const turnoHeaderY = doc.y;
          const turnoColWidth = 75;
          const turnoHeaders = ['Turno', 'Início', 'Fim', 'KM Início', 'KM Fim', 'KM Total', 'Status'];
          
          doc.rect(50, turnoHeaderY, turnoColWidth * 7, 14)
             .fill('#334155');

          doc.fontSize(8)
             .fillColor('#ffffff')
             .font('Helvetica-Bold');
          
          turnoHeaders.forEach((h, i) => {
            doc.text(h, 50 + (i * turnoColWidth), turnoHeaderY + 3, { width: turnoColWidth, align: 'center' });
          });

          // Dados dos turnos
          doc.font('Helvetica')
             .fillColor('#000000');

          day.turnos.forEach((turno: any, idx: number) => {
            const rowY = turnoHeaderY + 14 + (idx * 12);
            
            // Cor alternada
            if (idx % 2 === 0) {
              doc.rect(50, rowY, turnoColWidth * 7, 12)
                 .fill(lightGray);
            }

            const statusText = turno.status === 'ended' ? 'Concluído' : 
                              turno.status === 'paused' ? 'Pausado' : 'Em curso';

            doc.fontSize(8)
               .fillColor('#000000')
               .text(turno.numero.toString(), 50, rowY + 2, { width: turnoColWidth, align: 'center' })
               .text(turno.startTime, 50 + turnoColWidth, rowY + 2, { width: turnoColWidth, align: 'center' })
               .text(turno.endTime, 50 + turnoColWidth * 2, rowY + 2, { width: turnoColWidth, align: 'center' })
               .text(turno.startKm, 50 + turnoColWidth * 3, rowY + 2, { width: turnoColWidth, align: 'center' })
               .text(turno.endKm, 50 + turnoColWidth * 4, rowY + 2, { width: turnoColWidth, align: 'center' })
               .text(turno.km + ' km', 50 + turnoColWidth * 5, rowY + 2, { width: turnoColWidth, align: 'center' })
               .text(statusText, 50 + turnoColWidth * 6, rowY + 2, { width: turnoColWidth, align: 'center' });
          });

          doc.y = turnoHeaderY + 14 + (day.turnos.length * 12) + 5;
        }

        // Eventos e check
        const extras: string[] = [];
        if (day.events > 0) extras.push(`${day.events} evento(s) registado(s) neste dia`);
        if (day.truckCheck === 'Sim') extras.push('Check do caminhão realizado');
        
        if (extras.length > 0) {
          doc.text(extras.join(' | '));
        }

        doc.moveDown(0.5);
      }

      // ====== RODAPÉ ======
      doc.moveDown(1);
      doc.fontSize(8)
         .fillColor('#64748b')
         .font('Helvetica')
         .text(`Relatório gerado em ${new Date().toLocaleDateString('pt-PT')} às ${new Date().toLocaleTimeString('pt-PT')}`, { align: 'center' })
         .text('Diário do Motorista - Sistema de Controle de Jornada | Conformidade com Reg. CE 561/2006', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
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
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 900px; margin: 0 auto; font-size: 12px; }
    h1 { color: #1e3a5f; border-bottom: 3px solid #22c55e; padding-bottom: 10px; font-size: 20px; }
    h2 { color: #334155; margin-top: 20px; font-size: 16px; }
    .period { background: #f1f5f9; padding: 10px 15px; border-radius: 8px; margin: 15px 0; }
    .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 20px 0; }
    .stat-box { background: #1e3a5f; color: white; padding: 12px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 20px; font-weight: bold; }
    .stat-label { font-size: 10px; opacity: 0.8; }
    
    .day-section { margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .day-header { background: #1e3a5f; color: white; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; }
    .day-header h3 { margin: 0; font-size: 14px; }
    .day-header .badge { background: #22c55e; padding: 3px 8px; border-radius: 4px; font-size: 11px; }
    
    .day-info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 15px; background: #f8fafc; }
    .day-info-item { text-align: center; }
    .day-info-item .label { font-size: 10px; color: #64748b; }
    .day-info-item .value { font-size: 14px; font-weight: bold; color: #1e3a5f; }
    
    .turnos-section { padding: 0 15px 15px 15px; }
    .turnos-title { font-size: 12px; color: #64748b; margin-bottom: 8px; font-weight: bold; }
    table.turnos-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    table.turnos-table th { background: #e2e8f0; color: #334155; padding: 6px; text-align: center; }
    table.turnos-table td { padding: 6px; text-align: center; border-bottom: 1px solid #e2e8f0; }
    table.turnos-table tr:nth-child(even) { background: #f8fafc; }
    
    .alerts { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
    .alerts h3 { color: #92400e; margin: 0 0 10px 0; font-size: 14px; }
    .alerts ul { margin: 0; padding-left: 20px; }
    .alerts li { color: #78350f; margin: 5px 0; }
    
    .footer { margin-top: 30px; text-align: center; color: #64748b; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
    
    @media print { 
      body { padding: 0; } 
      .stat-box { break-inside: avoid; } 
      .day-section { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Diário do Motorista - Relatório de Jornada</h1>
  
  <div class="period">
    <strong>Período:</strong> ${periodLabel}<br>
    <strong>De:</strong> ${startDate} <strong>até</strong> ${endDate}
    ${matricula ? `<br><strong>Veículo:</strong> ${matricula}` : ''}
  </div>

  <h2>Resumo do Período</h2>
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
    <h3>Alertas de Conformidade (Reg. CE 561/2006)</h3>
    <ul>
      ${alerts.map((a: string) => `<li>${a}</li>`).join('')}
    </ul>
  </div>
  ` : ''}

  <h2>Detalhamento Diário com Turnos</h2>
  
  ${days.map((d: any) => `
  <div class="day-section">
    <div class="day-header">
      <h3>${d.dateFormatted}</h3>
      <div>
        ${d.matricula !== '-' ? `<span style="margin-right: 15px;">${d.matricula}</span>` : ''}
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
      <div class="turnos-title">Detalhamento dos Turnos:</div>
      <table class="turnos-table">
        <thead>
          <tr>
            <th>Turno</th>
            <th>Hora Início</th>
            <th>Hora Fim</th>
            <th>KM Início</th>
            <th>KM Fim</th>
            <th>KM Percorrido</th>
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
            <td>${t.status === 'ended' ? 'Concluído' : t.status === 'paused' ? 'Pausado' : 'Em curso'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}
    
    ${d.events > 0 ? `
    <div style="padding: 0 15px 10px 15px; font-size: 11px; color: #64748b;">
      ${d.events} evento${d.events > 1 ? 's' : ''} registado${d.events > 1 ? 's' : ''} neste dia
    </div>
    ` : ''}
    
    ${d.truckCheck === 'Sim' ? `
    <div style="padding: 0 15px 10px 15px; font-size: 11px; color: #22c55e;">
      Check do caminhão realizado
    </div>
    ` : ''}
  </div>
  `).join('')}

  <div class="footer">
    <p><strong>Relatório gerado em ${new Date().toLocaleDateString('pt-PT')} às ${new Date().toLocaleTimeString('pt-PT')}</strong></p>
    <p>Diário do Motorista - Sistema de Controle de Jornada | Conformidade com Reg. CE 561/2006</p>
  </div>
</body>
</html>
  `;
}
