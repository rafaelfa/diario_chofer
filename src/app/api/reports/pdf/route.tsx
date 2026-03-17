import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { renderToStream } from '@react-pdf/renderer';

// Registrar fontes
Font.register({
  family: 'Helvetica',
  src: 'https://fonts.gstatic.com/s/opensans/v18/mem8YaGs126MiZpBA-U1Ug.ttf'
});

// Estilos do PDF
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica'
  },
  title: {
    fontSize: 18,
    color: '#1e3a5f',
    textAlign: 'center',
    marginBottom: 5
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 15
  },
  period: {
    fontSize: 9,
    marginBottom: 10,
    padding: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4
  },
  sectionTitle: {
    fontSize: 12,
    color: '#1e3a5f',
    marginTop: 15,
    marginBottom: 8,
    fontWeight: 'bold'
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15
  },
  statBox: {
    width: '18%',
    backgroundColor: '#1e3a5f',
    padding: 8,
    borderRadius: 4,
    alignItems: 'center'
  },
  statValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: 'bold'
  },
  statLabel: {
    fontSize: 7,
    color: '#94a3b8',
    marginTop: 2
  },
  alertBox: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    padding: 8,
    marginBottom: 15
  },
  alertTitle: {
    fontSize: 10,
    color: '#92400e',
    fontWeight: 'bold',
    marginBottom: 4
  },
  alertText: {
    fontSize: 8,
    color: '#78350f'
  },
  daySection: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden'
  },
  dayHeader: {
    backgroundColor: '#1e3a5f',
    padding: 6,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  dayHeaderText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold'
  },
  dayInfo: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    padding: 8
  },
  dayInfoItem: {
    flex: 1,
    alignItems: 'center'
  },
  dayInfoLabel: {
    fontSize: 7,
    color: '#64748b'
  },
  dayInfoValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1e3a5f'
  },
  turnosTable: {
    marginTop: 5,
    padding: 5
  },
  turnoRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 3
  },
  turnoHeader: {
    backgroundColor: '#334155',
    flexDirection: 'row',
    paddingVertical: 4
  },
  turnoCell: {
    flex: 1,
    fontSize: 7,
    textAlign: 'center',
    color: '#000000'
  },
  turnoHeaderCell: {
    flex: 1,
    fontSize: 7,
    textAlign: 'center',
    color: '#ffffff',
    fontWeight: 'bold'
  },
  footer: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 8,
    color: '#64748b'
  }
});

// Componente do PDF
function ReportDocument({ data }: { data: any }) {
  const { periodLabel, startDate, endDate, matricula, statistics, days, alerts } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Diário do Motorista</Text>
        <Text style={styles.subtitle}>Relatório de Jornada de Trabalho</Text>
        
        <View style={styles.period}>
          <Text>Período: {periodLabel}</Text>
          <Text>De: {startDate} até: {endDate}</Text>
          {matricula && <Text>Veículo: {matricula}</Text>}
        </View>

        <Text style={styles.sectionTitle}>Resumo do Período</Text>
        
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{statistics.daysWorked}</Text>
            <Text style={styles.statLabel}>Dias Trabalhados</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{statistics.totalKm.toLocaleString()}</Text>
            <Text style={styles.statLabel}>KM Total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{statistics.totalHours}h</Text>
            <Text style={styles.statLabel}>Horas Condução</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{statistics.avgHoursPerDay}h</Text>
            <Text style={styles.statLabel}>Média Horas/Dia</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{statistics.avgKmPerDay}</Text>
            <Text style={styles.statLabel}>Média KM/Dia</Text>
          </View>
        </View>

        {alerts && alerts.length > 0 && (
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>⚠️ Alertas de Conformidade (Reg. CE 561/2006)</Text>
            {alerts.map((alert: string, i: number) => (
              <Text key={i} style={styles.alertText}>• {alert}</Text>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Detalhamento Diário com Turnos</Text>

        {days.map((day: any, dayIndex: number) => (
          <View key={dayIndex} style={styles.daySection}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayHeaderText}>{day.dateFormatted}</Text>
              <Text style={styles.dayHeaderText}>
                {day.turnosCount} turno(s) | {day.kmTraveled} km | {day.hours}h
              </Text>
            </View>
            
            <View style={styles.dayInfo}>
              <View style={styles.dayInfoItem}>
                <Text style={styles.dayInfoLabel}>Início</Text>
                <Text style={styles.dayInfoValue}>{day.startTime}</Text>
                <Text style={styles.dayInfoLabel}>{day.startCountry}</Text>
              </View>
              <View style={styles.dayInfoItem}>
                <Text style={styles.dayInfoLabel}>Fim</Text>
                <Text style={styles.dayInfoValue}>{day.endTime}</Text>
                <Text style={styles.dayInfoLabel}>{day.endCountry}</Text>
              </View>
              <View style={styles.dayInfoItem}>
                <Text style={styles.dayInfoLabel}>KM Percorrido</Text>
                <Text style={styles.dayInfoValue}>{day.kmTraveled} km</Text>
              </View>
              <View style={styles.dayInfoItem}>
                <Text style={styles.dayInfoLabel}>Horas Condução</Text>
                <Text style={styles.dayInfoValue}>{day.hours}h</Text>
              </View>
            </View>

            {day.turnos && day.turnos.length > 0 && (
              <View style={styles.turnosTable}>
                <View style={styles.turnoHeader}>
                  <Text style={styles.turnoHeaderCell}>Turno</Text>
                  <Text style={styles.turnoHeaderCell}>Início</Text>
                  <Text style={styles.turnoHeaderCell}>Fim</Text>
                  <Text style={styles.turnoHeaderCell}>KM Início</Text>
                  <Text style={styles.turnoHeaderCell}>KM Fim</Text>
                  <Text style={styles.turnoHeaderCell}>KM Total</Text>
                  <Text style={styles.turnoHeaderCell}>Status</Text>
                </View>
                {day.turnos.map((turno: any, tIdx: number) => (
                  <View key={tIdx} style={styles.turnoRow}>
                    <Text style={styles.turnoCell}>{turno.numero}</Text>
                    <Text style={styles.turnoCell}>{turno.startTime}</Text>
                    <Text style={styles.turnoCell}>{turno.endTime}</Text>
                    <Text style={styles.turnoCell}>{turno.startKm}</Text>
                    <Text style={styles.turnoCell}>{turno.endKm}</Text>
                    <Text style={styles.turnoCell}>{turno.km} km</Text>
                    <Text style={styles.turnoCell}>
                      {turno.status === 'ended' ? 'Concluído' : turno.status === 'paused' ? 'Pausado' : 'Em curso'}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {(day.events > 0 || day.truckCheck === 'Sim') && (
              <View style={{ padding: 5 }}>
                <Text style={{ fontSize: 7, color: '#64748b' }}>
                  {day.events > 0 ? `${day.events} evento(s) registado(s)` : ''}
                  {day.events > 0 && day.truckCheck === 'Sim' ? ' | ' : ''}
                  {day.truckCheck === 'Sim' ? 'Check do caminhão realizado' : ''}
                </Text>
              </View>
            )}
          </View>
        ))}

        <Text style={styles.footer}>
          Relatório gerado em {new Date().toLocaleDateString('pt-PT')} às {new Date().toLocaleTimeString('pt-PT')}
          {'\n'}Diário do Motorista - Sistema de Controle de Jornada | Conformidade com Reg. CE 561/2006
        </Text>
      </Page>
    </Document>
  );
}

// GET - Dados para relatório PDF ou gerar PDF
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'weekly';
    const matricula = searchParams.get('matricula');
    const customStartDate = searchParams.get('startDate');
    const customEndDate = searchParams.get('endDate');
    const referenceDate = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date();
    const format = searchParams.get('format') || 'pdf';

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

      // Formatar turnos
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

    // Gerar PDF usando @react-pdf/renderer (funciona no Vercel!)
    const pdfStream = await renderToStream(<ReportDocument data={reportData} />);
    
    // Converter stream para buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of pdfStream) {
      chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);

    // Retornar PDF como resposta
    return new NextResponse(pdfBuffer, {
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

function generateReportHTML(data: any): string {
  const { periodLabel, startDate, endDate, matricula, statistics, days, alerts } = data;

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
