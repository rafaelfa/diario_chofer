module.exports=[51558,e=>{"use strict";var t=e.i(89171),a=e.i(43793),r=e.i(79832),o=e.i(18331),i=e.i(50377),s=e.i(62890),n=e.i(47906),d=e.i(25685),l=e.i(6090);async function c(e){try{let c,{userId:p}=await (0,r.requireAuth)(),{searchParams:u}=new URL(e.url),m=u.get("type")||"weekly",g=u.get("matricula"),h=u.get("startDate"),v=u.get("endDate"),x=u.get("timezone"),f=u.get("date"),b=f?(0,l.parseDateOnlyUtc)(f):new Date;if(!["weekly","monthly","custom"].includes(m)||!b||!(0,l.isValidTimezone)(x))return t.NextResponse.json({error:"Tipo, data ou fuso horário inválido"},{status:400});if(!!h!=!!v||"custom"===m&&!h)return t.NextResponse.json({error:"Informe as datas inicial e final do período"},{status:400});let y=null,w=null,D=[];if((0,i.log)("=== GERANDO RELATÓRIO PDF ==="),(0,i.log)("Matrícula:",g),(0,i.log)("Tipo:",m),!g||h||v)if(h&&v){y=(0,l.parseDateOnlyUtc)(h);let e=(0,l.parseDateOnlyUtc)(v);if(!y||!e||y>e)return t.NextResponse.json({error:"Período personalizado inválido"},{status:400});(w=new Date(e)).setUTCHours(23,59,59,999);let r=(0,s.formatDatePtServer)(y,x,{day:"2-digit",month:"2-digit"}),o=(0,s.formatDatePtServer)(w,x,{day:"2-digit",month:"2-digit",year:"numeric"});c=`Per\xedodo: ${r} a ${o}`,g&&(c+=` | Ve\xedculo: ${g.toUpperCase()}`);let i={userId:p,date:{gte:y,lte:w}};g&&(i.matricula=g.toUpperCase()),D=await a.db.workDay.findMany({where:i,include:{events:!0,drivingSessions:{orderBy:{createdAt:"asc"}}},orderBy:{date:"asc"}})}else if("weekly"===m){y=(0,d.getMonday)(b),(w=new Date(y)).setUTCDate(w.getUTCDate()+7),w.setUTCMilliseconds(w.getUTCMilliseconds()-1);let e=(0,d.getIsoWeekNumberUtc)(y);c=`Semana ${e} de ${(0,s.formatDatePtServer)(y,x,{month:"long",year:"numeric"})}`,D=await a.db.workDay.findMany({where:{userId:p,date:{gte:y,lte:w}},include:{events:!0,drivingSessions:{orderBy:{createdAt:"asc"}}},orderBy:{date:"asc"}})}else y=new Date(Date.UTC(b.getUTCFullYear(),b.getUTCMonth(),1)),w=new Date(Date.UTC(b.getUTCFullYear(),b.getUTCMonth()+1,0,23,59,59,999)),c=(0,s.formatDatePtServer)(b,x,{month:"long",year:"numeric"}),D=await a.db.workDay.findMany({where:{userId:p,date:{gte:y,lte:w}},include:{events:!0,drivingSessions:{orderBy:{createdAt:"asc"}}},orderBy:{date:"asc"}});else{let e=await a.db.workDay.findMany({where:{userId:p,matricula:g.toUpperCase()},include:{events:!0,drivingSessions:{orderBy:{createdAt:"asc"}}},orderBy:{createdAt:"asc"}});if((0,i.log)("Registros encontrados para matrícula:",e.length),e.length>0){D=e;let t=e.filter(e=>null!==e.date).map(e=>e.date).sort((e,t)=>new Date(e).getTime()-new Date(t).getTime());if(t.length>0)y=(0,l.startOfUtcDay)(t[0]),w=(0,l.endOfUtcDay)(t[t.length-1]);else{let t=e.map(e=>e.createdAt).sort();y=(0,l.startOfUtcDay)(t[0]),w=(0,l.endOfUtcDay)(t[t.length-1])}let a=(0,s.formatDatePtServer)(y,x,{day:"2-digit",month:"2-digit",year:"numeric"}),r=(0,s.formatDatePtServer)(w,x,{day:"2-digit",month:"2-digit",year:"numeric"});c=`Ve\xedculo: ${g.toUpperCase()} | ${a} a ${r}`}else y=(0,l.startOfUtcDay)(new Date),w=(0,l.endOfUtcDay)(new Date),c=`Ve\xedculo: ${g.toUpperCase()} - Sem registros`}(0,i.log)("WorkDays encontrados:",D.length);let R=0,T=0,C=0,k=D.map(e=>{let t=(0,o.calcKmTraveled)(e.drivingSessions||[],e.startKm,e.endKm)||0;R+=t;let a=(0,o.calcWorkDayHours)(e)??0;T+=a,C+=e.events.length;let r=e.drivingSessions.map((e,t)=>({numero:t+1,startTime:e.startTime||"--:--",endTime:e.endTime||"--:--",startKm:e.startKm?.toLocaleString()||"--",endKm:e.endKm?.toLocaleString()||"--",km:e.startKm&&e.endKm?e.endKm-e.startKm:0,status:e.status}));return{date:e.date,dateFormatted:e.date?(0,s.formatDatePtServer)(e.date,x):"Sem data",matricula:e.matricula||"-",startTime:e.startTime||"-",endTime:e.endTime||"-",startKm:e.startKm??"-",endKm:e.endKm??"-",kmTraveled:t,hours:parseFloat(a.toFixed(1)),startCountry:e.startCountry||"-",endCountry:e.endCountry||"-",events:e.events.length,truckCheck:e.truckCheck?"Sim":"Não",turnosCount:r.length,turnos:r}}),$=[];if(!g){let e=(0,d.aggregateDrivingByDate)(D.flatMap(e=>e.date?[{date:e.date,hoursWorked:(0,o.calcWorkDayHours)(e)??0}]:[])),t=(0,d.evaluateDailyDrivingLimits)(e);for(let e of t.overAbsoluteLimit)$.push(`${(0,s.formatDatePtServer)(e.date,x)}: ${e.hours.toFixed(1)}h de condu\xe7\xe3o (limite absoluto: ${d.MAX_DAILY_DRIVING_EXCEPTION_H}h)`);for(let e of t.exceededWeeklyExceptions)$.push(`${(0,s.formatDatePtServer)(e.date,x)}: ${e.hours.toFixed(1)}h; j\xe1 foram usadas as duas exce\xe7\xf5es semanais de 10h`);if("weekly"===m&&y&&w){let e=new Date(y);e.setUTCDate(e.getUTCDate()-7);let t=await a.db.workDay.findMany({where:{userId:p,date:{gte:e,lte:w}},select:{date:!0,startTime:!0,endTime:!0,primaryDriverNumber:!0,utcOffset:!0,breakMinutes:!0,breakStart:!0,drivingSessions:{orderBy:{createdAt:"asc"}}}}),r=(0,d.computeDrivingLimits)(t.filter(e=>e.date).map(e=>({date:e.date,hoursWorked:(0,o.calcWorkDayHours)(e)??0})),b);r.weeklyHours>d.MAX_WEEKLY_DRIVING_H&&$.push(`Total semanal: ${r.weeklyHours.toFixed(1)}h (limite: ${d.MAX_WEEKLY_DRIVING_H}h)`),r.biweeklyHours>d.MAX_BIWEEKLY_DRIVING_H&&$.push(`Total em duas semanas: ${r.biweeklyHours.toFixed(1)}h (limite: ${d.MAX_BIWEEKLY_DRIVING_H}h)`)}}let E=new Set(D.map(e=>(e.date??e.createdAt).toISOString().slice(0,10))).size,S={periodLabel:c,type:m,startDate:y?(0,s.formatDatePtServer)(y,x):"-",endDate:w?(0,s.formatDatePtServer)(w,x):"-",matricula:g,timezone:x,statistics:{daysWorked:E,totalKm:R,totalHours:parseFloat(T.toFixed(1)),totalEvents:C,avgHoursPerDay:E>0?parseFloat((T/E).toFixed(1)):0,avgKmPerDay:E>0?Math.round(R/E):0},days:k,alerts:$};return new t.NextResponse(function(e){let{periodLabel:t,startDate:a,endDate:r,matricula:o,statistics:i,days:s,alerts:d,timezone:l}=e;return`<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relat\xf3rio - Di\xe1rio do Motorista</title>
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
  
  <h1>🚛 Di\xe1rio do Motorista</h1>
  <p style="color: #64748b; text-align: center; margin-bottom: 15px;">Relat\xf3rio de Jornada de Trabalho</p>
  
  <div class="period">
    <strong>Per\xedodo:</strong> ${(0,n.escapeHtml)(t)}<br>
    <strong>De:</strong> ${(0,n.escapeHtml)(a)} <strong>at\xe9</strong> ${(0,n.escapeHtml)(r)}
    ${o?`<br><strong>Ve\xedculo:</strong> ${(0,n.escapeHtml)(o)}`:""}
  </div>

  <h2>📊 Resumo do Per\xedodo</h2>
  
  <div class="stats">
    <div class="stat-box">
      <div class="stat-value">${i.daysWorked}</div>
      <div class="stat-label">Dias Trabalhados</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${i.totalKm.toLocaleString()}</div>
      <div class="stat-label">KM Total</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${i.totalHours}h</div>
      <div class="stat-label">Horas Condu\xe7\xe3o</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${i.avgHoursPerDay}h</div>
      <div class="stat-label">M\xe9dia Horas/Dia</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${i.avgKmPerDay}</div>
      <div class="stat-label">M\xe9dia KM/Dia</div>
    </div>
  </div>

  ${d.length>0?`
  <div class="alerts">
    <h3>⚠️ Alertas de Conformidade (Reg. CE 561/2006)</h3>
    <ul>
      ${d.map(e=>`<li>${e}</li>`).join("")}
    </ul>
  </div>
  `:""}

  <h2>📋 Detalhamento Di\xe1rio com Turnos</h2>
  
  ${s.length>0?s.map(e=>`
  <div class="day-section">
    <div class="day-header">
      <h3>📅 ${e.dateFormatted}</h3>
      <div>
        ${"-"!==e.matricula?`<span style="margin-right: 12px;">🚛 ${(0,n.escapeHtml)(e.matricula)}</span>`:""}
        <span class="badge">${e.turnosCount} turno${e.turnosCount>1?"s":""} | ${e.kmTraveled} km | ${e.hours}h</span>
      </div>
    </div>
    
    <div class="day-info">
      <div class="day-info-item">
        <div class="label">In\xedcio</div>
        <div class="value">${(0,n.escapeHtml)(e.startTime)}</div>
        <div class="label">${(0,n.escapeHtml)(e.startCountry)}</div>
      </div>
      <div class="day-info-item">
        <div class="label">Fim</div>
        <div class="value">${(0,n.escapeHtml)(e.endTime)}</div>
        <div class="label">${(0,n.escapeHtml)(e.endCountry)}</div>
      </div>
      <div class="day-info-item">
        <div class="label">KM Percorrido</div>
        <div class="value">${e.kmTraveled} km</div>
      </div>
      <div class="day-info-item">
        <div class="label">Horas Condu\xe7\xe3o</div>
        <div class="value">${e.hours}h</div>
      </div>
    </div>
    
    ${e.turnos.length>0?`
    <div class="turnos-section">
      <div class="turnos-title">📍 Detalhamento dos Turnos:</div>
      <table class="turnos-table">
        <thead>
          <tr>
            <th>Turno</th>
            <th>Hora In\xedcio</th>
            <th>Hora Fim</th>
            <th>KM In\xedcio</th>
            <th>KM Fim</th>
            <th>KM Perc.</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${e.turnos.map(e=>`
          <tr>
            <td><strong>${e.numero}</strong></td>
            <td>${(0,n.escapeHtml)(e.startTime)}</td>
            <td>${(0,n.escapeHtml)(e.endTime)}</td>
            <td>${e.startKm}</td>
            <td>${e.endKm}</td>
            <td><strong>${e.km} km</strong></td>
            <td>${"ended"===e.status?"✓ Concluído":"paused"===e.status?"⏸ Pausado":"▶ Em curso"}</td>
          </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    `:""}
    
    ${e.events>0||"Sim"===e.truckCheck?`
    <div class="extras">
      ${e.events>0?`📝 ${e.events} evento${e.events>1?"s":""} registado${e.events>1?"s":""} neste dia`:""}
      ${e.events>0&&"Sim"===e.truckCheck?" | ":""}
      ${"Sim"===e.truckCheck?"✅ Check do caminhão realizado":""}
    </div>
    `:""}
  </div>
  `).join(""):'<p style="text-align: center; color: #64748b; padding: 20px;">Nenhum registro encontrado para o período.</p>'}

  <div class="footer">
    <p><strong>Relat\xf3rio gerado em ${new Date().toLocaleDateString("pt-PT",{timeZone:l||void 0})} \xe0s ${new Date().toLocaleTimeString("pt-PT",{timeZone:l||void 0})}</strong></p>
    <p>Di\xe1rio do Motorista - Sistema de Controle de Jornada | Conformidade com Reg. CE 561/2006</p>
  </div>
</body>
</html>`}(S),{status:200,headers:{"Content-Type":"text/html; charset=utf-8"}})}catch(e){if(e instanceof Error&&e.message.startsWith("UNAUTHORIZED"))return t.NextResponse.json({error:"Não autorizado"},{status:401});return(0,i.logError)("Error generating report:",e),t.NextResponse.json({error:"Erro ao gerar relatório"},{status:500})}}e.s(["GET",0,c])},88226,e=>{"use strict";var t=e.i(47909),a=e.i(74017),r=e.i(96250),o=e.i(59756),i=e.i(61916),s=e.i(74677),n=e.i(69741),d=e.i(16795),l=e.i(87718),c=e.i(95169),p=e.i(47587),u=e.i(66012),m=e.i(70101),g=e.i(26937),h=e.i(10372),v=e.i(93695);e.i(52474);var x=e.i(220);let f=new t.AppRouteRouteModule({definition:{kind:a.RouteKind.APP_ROUTE,page:"/api/reports/pdf/route",pathname:"/api/reports/pdf",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/reports/pdf/route.ts",nextConfigOutput:"standalone",userland:()=>e.r(51558),...{}}),{workAsyncStorage:b,workUnitAsyncStorage:y,serverHooks:w}=f;async function D(e,t,r){r.requestMeta&&(0,o.setRequestMeta)(e,r.requestMeta),f.isDev&&(0,o.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let b="/api/reports/pdf/route";b=b.replace(/\/index$/,"")||"/";let y=await f.prepare(e,t,{srcPage:b,multiZoneDraftMode:!1});if(!y)return t.statusCode=400,t.end("Bad Request"),null==r.waitUntil||r.waitUntil.call(r,Promise.resolve()),null;let{buildId:w,deploymentId:D,params:R,nextConfig:T,parsedUrl:C,isDraftMode:k,prerenderManifest:$,routerServerContext:E,isOnDemandRevalidate:S,revalidateOnlyGenerated:P,resolvedPathname:H,clientReferenceManifest:A,serverActionsManifest:U}=y,M=(0,n.normalizeAppPath)(b),N=!!($.dynamicRoutes[M]||$.routes[H]),I=async()=>((null==E?void 0:E.render404)?await E.render404(e,t,C,!1):t.end("This page could not be found"),null);if(N&&!k){let e=!!$.routes[H],t=$.dynamicRoutes[M];if(t&&!1===t.fallback&&!e){if(T.adapterPath)return await I();throw new v.NoFallbackError}}let K=null;!N||f.isDev||k||(K="/index"===(K=H)?"/":K);let _=!0===f.isDev||!N,O=N&&!_;U&&A&&(0,s.setManifestsSingleton)({page:b,clientReferenceManifest:A,serverActionsManifest:U});let F=e.method||"GET",z=(0,i.getTracer)(),L=z.getActiveScopeSpan(),q=!!(null==E?void 0:E.isWrappedByNextServer),B=!!(0,o.getRequestMeta)(e,"minimalMode"),j=(0,o.getRequestMeta)(e,"incrementalCache")||await f.getIncrementalCache(e,T,$,B);null==j||j.resetRequestCache(),globalThis.__incrementalCache=j;let W={params:R,previewProps:$.preview,renderOpts:{experimental:{authInterrupts:!!T.experimental.authInterrupts,useCacheTimeout:T.experimental.useCacheTimeout},cacheComponents:!!T.cacheComponents,validationLevel:T.experimental.instantInsights.validationLevel,supportsDynamicResponse:_,incrementalCache:j,hmrRefreshHash:(0,o.getRequestMeta)(e,"hmrRefreshHash"),cacheLifeProfiles:T.cacheLife,staticPageGenerationTimeout:T.staticPageGenerationTimeout,waitUntil:r.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,r,o)=>f.onRequestError(e,t,r,o,E)},sharedContext:{buildId:w,deploymentId:D}},V=new d.NodeNextRequest(e),G=new d.NodeNextResponse(t),X=l.NextRequestAdapter.fromNodeNextRequest(V,(0,l.signalFromNodeResponse)(t)),Y=async({previousCacheEntry:a})=>{try{if(!B&&S&&P&&!a)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let o=await f.handle(X,W);e.fetchMetrics=W.renderOpts.fetchMetrics;let i=W.renderOpts.pendingWaitUntil;i&&r.waitUntil&&(r.waitUntil(i),i=void 0);let s=W.renderOpts.collectedTags;if(!N)return await (0,u.sendResponse)(V,G,o,i),null;{let e=await o.blob(),t=(0,m.toNodeOutgoingHttpHeaders)(o.headers);s&&(t[h.NEXT_CACHE_TAGS_HEADER]=s),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==W.renderOpts.collectedRevalidate&&!(W.renderOpts.collectedRevalidate>=h.INFINITE_CACHE)&&W.renderOpts.collectedRevalidate,r=void 0===W.renderOpts.collectedExpire||W.renderOpts.collectedExpire>=h.INFINITE_CACHE?!1!==a&&a>0?T.expireTime:void 0:W.renderOpts.collectedExpire;return{value:{kind:x.CachedRouteKind.APP_ROUTE,status:o.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:r}}}}catch(t){throw(null==a?void 0:a.isStale)&&await f.onRequestError(e,t,{routerKind:"App Router",routePath:b,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:O,isOnDemandRevalidate:S})},!1,E),t}},Z=async(o,s)=>{try{var n,d;let o=await f.handleResponse({req:e,nextConfig:T,cacheKey:K,routeKind:a.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:$,isRoutePPREnabled:!1,isOnDemandRevalidate:S,revalidateOnlyGenerated:P,responseGenerator:Y,waitUntil:r.waitUntil,isMinimalMode:B});if(!N)return;if((null==o||null==(n=o.value)?void 0:n.kind)!==x.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==o||null==(d=o.value)?void 0:d.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});B||t.setHeader("x-nextjs-cache",S?"REVALIDATED":o.isMiss?"MISS":o.isStale?"STALE":"HIT"),k&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let i=(0,m.fromNodeOutgoingHttpHeaders)(o.value.headers);B&&N||i.delete(h.NEXT_CACHE_TAGS_HEADER),!o.cacheControl||t.getHeader("Cache-Control")||i.get("Cache-Control")||i.set("Cache-Control",(0,g.getCacheControlHeader)(o.cacheControl)),await (0,u.sendResponse)(V,G,new Response(o.value.body,{headers:i,status:o.value.status||200}));return}catch(t){if(t instanceof v.NoFallbackError||await f.onRequestError(e,t,{routerKind:"App Router",routePath:M,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:O,isOnDemandRevalidate:S})},!1,E),N)throw t;await (0,u.sendResponse)(V,G,new Response(null,{status:500}));return}finally{(()=>{if(!o)return;let e=t.statusCode;o.setAttributes({"http.status_code":e,"next.rsc":!1}),e&&e>=500&&(o.setStatus({code:i.SpanStatusCode.ERROR}),o.setAttribute("error.type",e.toString()));let a=z.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==c.BaseServerSpan.handleRequest)return console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let r=a.get("next.route")||M,n=`${F} ${r}`;o.setAttributes({"next.route":r,"http.route":r,"next.span_name":n}),o.updateName(n),s&&s!==o&&(s.setAttribute("http.route",r),s.updateName(n))})()}};if(q&&L)await Z(L,void 0);else{let t=z.getActiveScopeSpan();await z.withPropagatedContext(e.headers,()=>z.trace(c.BaseServerSpan.handleRequest,{spanName:`${F} ${b}`,kind:i.SpanKind.SERVER,attributes:{"http.method":F,"http.target":e.url}},e=>Z(e,t)),void 0,!q)}}e.s(["handler",0,D,"patchFetch",0,function(){return(0,r.patchFetch)({workAsyncStorage:b,workUnitAsyncStorage:y})},"routeModule",0,f,"serverHooks",0,w,"workAsyncStorage",0,b,"workUnitAsyncStorage",0,y])}];

//# sourceMappingURL=_1-fdzbo._.js.map