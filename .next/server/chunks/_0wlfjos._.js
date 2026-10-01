module.exports=[90049,e=>{"use strict";var t=e.i(89171),a=e.i(43793),i=e.i(18331),r=e.i(50377),o=e.i(79832),s=e.i(62890),n=e.i(47906),d=e.i(6090);async function l(e){try{let l,{userId:p}=await (0,o.requireAuth)(),{searchParams:c}=new URL(e.url),u=c.get("matricula"),v=c.get("startDate"),m=c.get("endDate"),x=c.get("timezone");if((0,r.log)("=== RELATÓRIO DE VEÍCULO ==="),(0,r.log)("Matrícula:",u),(0,r.log)("Datas personalizadas:",v,m),!u)return t.NextResponse.json({error:"Matrícula é obrigatória"},{status:400});let g=(0,d.validateMatricula)(u);if(!g.valid||!(0,d.isValidTimezone)(x))return t.NextResponse.json({error:"Matrícula ou fuso horário inválido"},{status:400});if(!!v!=!!m)return t.NextResponse.json({error:"Informe as datas inicial e final do período"},{status:400});let f=null,h=null,b=[];if(v&&m){f=(0,d.parseDateOnlyUtc)(v);let e=(0,d.parseDateOnlyUtc)(m);if(!f||!e||f>e)return t.NextResponse.json({error:"Período personalizado inválido"},{status:400});(h=new Date(e)).setUTCHours(23,59,59,999),l=`Per\xedodo: ${(0,s.formatDatePtServer)(f,x)} a ${(0,s.formatDatePtServer)(h,x)}`,b=await a.db.workDay.findMany({where:{userId:p,matricula:g.normalized,date:{gte:f,lte:h}},include:{events:!0,drivingSessions:{orderBy:{createdAt:"asc"}}},orderBy:{createdAt:"asc"}})}else if(b=await a.db.workDay.findMany({where:{userId:p,matricula:g.normalized},include:{events:!0,drivingSessions:{orderBy:{createdAt:"asc"}}},orderBy:{createdAt:"asc"}}),(0,r.log)("Registros encontrados:",b.length),b.length>0){let e=b.filter(e=>null!==e.date).map(e=>e.date).sort((e,t)=>new Date(e).getTime()-new Date(t).getTime());if(e.length>0)f=(0,d.startOfUtcDay)(e[0]),h=(0,d.endOfUtcDay)(e[e.length-1]);else{let e=b.map(e=>e.createdAt).sort();f=(0,d.startOfUtcDay)(e[0]),h=(0,d.endOfUtcDay)(e[e.length-1])}l=`Todos os registros de ${(0,s.formatDatePtServer)(f,x)} a ${(0,s.formatDatePtServer)(h,x)}`}else f=(0,d.startOfUtcDay)(new Date),h=(0,d.endOfUtcDay)(new Date),l="Veículo sem registros";let y=0,w=0,R=0,k=null,C=null,T=new Set,S=b.map(e=>{let t=(0,i.calcKmTraveled)(e.drivingSessions||[],e.startKm,e.endKm)||0;y+=t,null===k&&null!=e.startKm&&(k=e.startKm),null!=e.endKm&&(C=e.endKm);let a=(0,i.calcWorkDayHours)(e,new Date,null)??0;w+=a,R+=e.events.length,e.startCountry&&T.add(e.startCountry),e.endCountry&&T.add(e.endCountry);let r=e.drivingSessions.map((e,t)=>({numero:t+1,startTime:e.startTime||"--:--",endTime:e.endTime||"--:--",startKm:e.startKm?.toLocaleString()||"--",endKm:e.endKm?.toLocaleString()||"--",km:null!=e.startKm&&null!=e.endKm?e.endKm-e.startKm:0,status:e.status}));return{date:e.date,dateFormatted:e.date?(0,s.formatDatePtServer)(e.date,x):"Sem data",startTime:e.startTime||"-",endTime:e.endTime||"-",startKm:e.startKm??"-",endKm:e.endKm??"-",kmTraveled:t,hours:parseFloat(a.toFixed(1)),startCountry:e.startCountry||"-",endCountry:e.endCountry||"-",events:e.events.length,truckCheck:e.truckCheck?"Sim":"Não",turnosCount:r.length,turnos:r}}),$=new Set(b.map(e=>(e.date??e.createdAt).toISOString().slice(0,10))).size,D=function(e){let{matricula:t,periodLabel:a,startDate:i,endDate:r,statistics:o,days:d,timezone:l}=e;return`<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relat\xf3rio do Ve\xedculo - ${(0,n.escapeHtml)(t)}</title>
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
  
  <h1>🚛 Relat\xf3rio do Ve\xedculo</h1>
  
  <div class="vehicle-header">
    <div>
      <p style="margin: 0; opacity: 0.8; font-size: 11px;">Matr\xedcula</p>
      <div class="vehicle-plate">${(0,n.escapeHtml)(t)}</div>
    </div>
    <div style="text-align: right;">
      <p style="margin: 0; opacity: 0.8; font-size: 11px;">Per\xedodo</p>
      <p style="margin: 0; font-size: 14px; font-weight: bold;">${(0,n.escapeHtml)(a)}</p>
      ${i&&r?`<p style="margin: 0; font-size: 10px; opacity: 0.8;">${(0,s.formatDatePtServer)(i,l)} a ${(0,s.formatDatePtServer)(r,l)}</p>`:""}
    </div>
  </div>

  <h2>📊 Resumo do Per\xedodo</h2>
  
  <div class="stats">
    <div class="stat-box">
      <div class="stat-value">${o.diasTrabalhados}</div>
      <div class="stat-label">Dias em Servi\xe7o</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${o.totalKm.toLocaleString()}</div>
      <div class="stat-label">KM Total</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${o.totalHours}h</div>
      <div class="stat-label">Horas de Uso</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${o.avgKmPerDay}</div>
      <div class="stat-label">M\xe9dia KM/Dia</div>
    </div>
  </div>
  
  <div class="km-info">
    <div class="km-box">
      <div class="label">KM Inicial do Per\xedodo</div>
      <div class="value">${o.kmInicial?.toLocaleString()||"--"}</div>
    </div>
    <div class="km-box">
      <div class="label">KM Final do Per\xedodo</div>
      <div class="value">${o.kmFinal?.toLocaleString()||"--"}</div>
    </div>
  </div>
  
  ${o.paises.length>0?`
  <div class="paises-section">
    <div class="paises-title">🌍 Pa\xedses Percorridos</div>
    <div class="paises-list">
      ${o.paises.map(e=>`<span class="pais-badge">${(0,n.escapeHtml)(e)}</span>`).join("")}
    </div>
  </div>
  `:""}

  <h2>📋 Hist\xf3rico de Utiliza\xe7\xe3o</h2>
  
  ${0===d.length?`
  <p style="text-align: center; color: #64748b; padding: 20px;">
    Nenhum registro encontrado para este ve\xedculo.
  </p>
  `:d.map(e=>`
  <div class="day-section">
    <div class="day-header">
      <h3>📅 ${e.dateFormatted}</h3>
      <span class="badge">${e.turnosCount} turno${e.turnosCount>1?"s":""} | ${e.kmTraveled} km | ${e.hours}h</span>
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
        <div class="label">KM In\xedcio</div>
        <div class="value">${"number"==typeof e.startKm?e.startKm.toLocaleString():e.startKm}</div>
      </div>
      <div class="day-info-item">
        <div class="label">KM Fim</div>
        <div class="value">${"number"==typeof e.endKm?e.endKm.toLocaleString():e.endKm}</div>
      </div>
      <div class="day-info-item">
        <div class="label">KM Dia</div>
        <div class="value">${e.kmTraveled} km</div>
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
      ${e.events>0?`📝 ${e.events} evento${e.events>1?"s":""} registado${e.events>1?"s":""}`:""}
      ${e.events>0&&"Sim"===e.truckCheck?" | ":""}
      ${"Sim"===e.truckCheck?"✅ Check realizado":""}
    </div>
    `:""}
  </div>
  `).join("")}

  <div class="footer">
    <p><strong>Relat\xf3rio gerado em ${new Date().toLocaleDateString("pt-PT",{timeZone:l||void 0})} \xe0s ${new Date().toLocaleTimeString("pt-PT",{timeZone:l||void 0})}</strong></p>
    <p>Di\xe1rio do Motorista - Sistema de Controle de Ve\xedculos</p>
  </div>
</body>
</html>`}({matricula:g.normalized,periodLabel:l,startDate:f,endDate:h,timezone:x,statistics:{diasTrabalhados:$,totalKm:y,totalHours:parseFloat(w.toFixed(1)),totalEvents:R,avgHoursPerDay:$>0?parseFloat((w/$).toFixed(1)):0,avgKmPerDay:$>0?Math.round(y/$):0,kmInicial:k,kmFinal:C,paises:Array.from(T)},days:S});return new t.NextResponse(D,{status:200,headers:{"Content-Type":"text/html; charset=utf-8"}})}catch(e){return(0,r.logError)("Error generating vehicle PDF report:",e),t.NextResponse.json({error:"Erro ao gerar relatório do veículo"},{status:500})}}e.s(["GET",0,l])},98291,e=>{"use strict";var t=e.i(47909),a=e.i(74017),i=e.i(96250),r=e.i(59756),o=e.i(61916),s=e.i(74677),n=e.i(69741),d=e.i(16795),l=e.i(87718),p=e.i(95169),c=e.i(47587),u=e.i(66012),v=e.i(70101),m=e.i(26937),x=e.i(10372),g=e.i(93695);e.i(52474);var f=e.i(220);let h=new t.AppRouteRouteModule({definition:{kind:a.RouteKind.APP_ROUTE,page:"/api/reports/pdf/veiculo/route",pathname:"/api/reports/pdf/veiculo",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/reports/pdf/veiculo/route.ts",nextConfigOutput:"standalone",userland:()=>e.r(90049),...{}}),{workAsyncStorage:b,workUnitAsyncStorage:y,serverHooks:w}=h;async function R(e,t,i){i.requestMeta&&(0,r.setRequestMeta)(e,i.requestMeta),h.isDev&&(0,r.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let b="/api/reports/pdf/veiculo/route";b=b.replace(/\/index$/,"")||"/";let y=await h.prepare(e,t,{srcPage:b,multiZoneDraftMode:!1});if(!y)return t.statusCode=400,t.end("Bad Request"),null==i.waitUntil||i.waitUntil.call(i,Promise.resolve()),null;let{buildId:w,deploymentId:R,params:k,nextConfig:C,parsedUrl:T,isDraftMode:S,prerenderManifest:$,routerServerContext:D,isOnDemandRevalidate:P,revalidateOnlyGenerated:E,resolvedPathname:K,clientReferenceManifest:A,serverActionsManifest:H}=y,z=(0,n.normalizeAppPath)(b),M=!!($.dynamicRoutes[z]||$.routes[K]),O=async()=>((null==D?void 0:D.render404)?await D.render404(e,t,T,!1):t.end("This page could not be found"),null);if(M&&!S){let e=!!$.routes[K],t=$.dynamicRoutes[z];if(t&&!1===t.fallback&&!e){if(C.adapterPath)return await O();throw new g.NoFallbackError}}let N=null;!M||h.isDev||S||(N="/index"===(N=K)?"/":N);let U=!0===h.isDev||!M,I=M&&!U;H&&A&&(0,s.setManifestsSingleton)({page:b,clientReferenceManifest:A,serverActionsManifest:H});let F=e.method||"GET",_=(0,o.getTracer)(),q=_.getActiveScopeSpan(),L=!!(null==D?void 0:D.isWrappedByNextServer),j=!!(0,r.getRequestMeta)(e,"minimalMode"),B=(0,r.getRequestMeta)(e,"incrementalCache")||await h.getIncrementalCache(e,C,$,j);null==B||B.resetRequestCache(),globalThis.__incrementalCache=B;let V={params:k,previewProps:$.preview,renderOpts:{experimental:{authInterrupts:!!C.experimental.authInterrupts,useCacheTimeout:C.experimental.useCacheTimeout},cacheComponents:!!C.cacheComponents,validationLevel:C.experimental.instantInsights.validationLevel,supportsDynamicResponse:U,incrementalCache:B,hmrRefreshHash:(0,r.getRequestMeta)(e,"hmrRefreshHash"),cacheLifeProfiles:C.cacheLife,staticPageGenerationTimeout:C.staticPageGenerationTimeout,waitUntil:i.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,i,r)=>h.onRequestError(e,t,i,r,D)},sharedContext:{buildId:w,deploymentId:R}},G=new d.NodeNextRequest(e),W=new d.NodeNextResponse(t),X=l.NextRequestAdapter.fromNodeNextRequest(G,(0,l.signalFromNodeResponse)(t)),Z=async({previousCacheEntry:a})=>{try{if(!j&&P&&E&&!a)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let r=await h.handle(X,V);e.fetchMetrics=V.renderOpts.fetchMetrics;let o=V.renderOpts.pendingWaitUntil;o&&i.waitUntil&&(i.waitUntil(o),o=void 0);let s=V.renderOpts.collectedTags;if(!M)return await (0,u.sendResponse)(G,W,r,o),null;{let e=await r.blob(),t=(0,v.toNodeOutgoingHttpHeaders)(r.headers);s&&(t[x.NEXT_CACHE_TAGS_HEADER]=s),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==V.renderOpts.collectedRevalidate&&!(V.renderOpts.collectedRevalidate>=x.INFINITE_CACHE)&&V.renderOpts.collectedRevalidate,i=void 0===V.renderOpts.collectedExpire||V.renderOpts.collectedExpire>=x.INFINITE_CACHE?!1!==a&&a>0?C.expireTime:void 0:V.renderOpts.collectedExpire;return{value:{kind:f.CachedRouteKind.APP_ROUTE,status:r.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:i}}}}catch(t){throw(null==a?void 0:a.isStale)&&await h.onRequestError(e,t,{routerKind:"App Router",routePath:b,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:I,isOnDemandRevalidate:P})},!1,D),t}},Y=async(r,s)=>{try{var n,d;let r=await h.handleResponse({req:e,nextConfig:C,cacheKey:N,routeKind:a.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:$,isRoutePPREnabled:!1,isOnDemandRevalidate:P,revalidateOnlyGenerated:E,responseGenerator:Z,waitUntil:i.waitUntil,isMinimalMode:j});if(!M)return;if((null==r||null==(n=r.value)?void 0:n.kind)!==f.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==r||null==(d=r.value)?void 0:d.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});j||t.setHeader("x-nextjs-cache",P?"REVALIDATED":r.isMiss?"MISS":r.isStale?"STALE":"HIT"),S&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let o=(0,v.fromNodeOutgoingHttpHeaders)(r.value.headers);j&&M||o.delete(x.NEXT_CACHE_TAGS_HEADER),!r.cacheControl||t.getHeader("Cache-Control")||o.get("Cache-Control")||o.set("Cache-Control",(0,m.getCacheControlHeader)(r.cacheControl)),await (0,u.sendResponse)(G,W,new Response(r.value.body,{headers:o,status:r.value.status||200}));return}catch(t){if(t instanceof g.NoFallbackError||await h.onRequestError(e,t,{routerKind:"App Router",routePath:z,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:I,isOnDemandRevalidate:P})},!1,D),M)throw t;await (0,u.sendResponse)(G,W,new Response(null,{status:500}));return}finally{(()=>{if(!r)return;let e=t.statusCode;r.setAttributes({"http.status_code":e,"next.rsc":!1}),e&&e>=500&&(r.setStatus({code:o.SpanStatusCode.ERROR}),r.setAttribute("error.type",e.toString()));let a=_.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==p.BaseServerSpan.handleRequest)return console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let i=a.get("next.route")||z,n=`${F} ${i}`;r.setAttributes({"next.route":i,"http.route":i,"next.span_name":n}),r.updateName(n),s&&s!==r&&(s.setAttribute("http.route",i),s.updateName(n))})()}};if(L&&q)await Y(q,void 0);else{let t=_.getActiveScopeSpan();await _.withPropagatedContext(e.headers,()=>_.trace(p.BaseServerSpan.handleRequest,{spanName:`${F} ${b}`,kind:o.SpanKind.SERVER,attributes:{"http.method":F,"http.target":e.url}},e=>Y(e,t)),void 0,!L)}}e.s(["handler",0,R,"patchFetch",0,function(){return(0,i.patchFetch)({workAsyncStorage:b,workUnitAsyncStorage:y})},"routeModule",0,h,"serverHooks",0,w,"workAsyncStorage",0,b,"workUnitAsyncStorage",0,y])}];

//# sourceMappingURL=_0wlfjos._.js.map