import fs from 'fs';
import path from 'path';

interface FileInfo {
  name: string;
  size: string;
  date: string;
  type: 'zip' | 'sql' | 'docx' | 'md' | 'png' | 'other';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileType(filename: string): FileInfo['type'] {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'zip': return 'zip';
    case 'sql': return 'sql';
    case 'docx': return 'docx';
    case 'md': return 'md';
    case 'png': return 'png';
    case 'jpg':
    case 'jpeg': return 'png';
    default: return 'other';
  }
}

function getFileIcon(type: FileInfo['type']): string {
  switch (type) {
    case 'zip': return '📦';
    case 'sql': return '🗄️';
    case 'docx': return '📄';
    case 'md': return '📝';
    case 'png': return '🖼️';
    default: return '📁';
  }
}

export default function DownloadsPage() {
  const downloadDir = '/home/z/my-project/download';
  
  let files: FileInfo[] = [];
  try {
    // Verificar se o diretório existe antes de ler
    if (fs.existsSync(downloadDir)) {
      const filenames = fs.readdirSync(downloadDir);
      files = filenames
      .filter(f => !f.startsWith('.'))
      .map(filename => {
        const filepath = path.join(downloadDir, filename);
        const stats = fs.statSync(filepath);
        return {
          name: filename,
          size: formatSize(stats.size),
          date: stats.mtime.toLocaleDateString('pt-BR'),
          type: getFileType(filename)
        };
      })
      .sort((a, b) => {
        // Priorizar arquivos mais recentes e importantes
        if (a.name.includes('v3_matricula')) return -1;
        if (b.name.includes('v3_matricula')) return 1;
        return b.name.localeCompare(a.name);
      });
    } // fim do if existsSync
  } catch (e) {
    console.error('Erro ao ler diretório:', e);
  }

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <title>Downloads - Diário do Motorista</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
            min-height: 100vh;
            padding: 20px;
          }
          .container {
            max-width: 900px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #fff;
            font-size: 2rem;
            margin-bottom: 10px;
          }
          .header p {
            color: #94a3b8;
          }
          .card {
            background: #1e293b;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 15px;
            border: 1px solid #334155;
            display: flex;
            align-items: center;
            gap: 15px;
            transition: all 0.2s;
          }
          .card:hover {
            border-color: #3b82f6;
            transform: translateY(-2px);
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
          }
          .icon {
            font-size: 2.5rem;
            width: 60px;
            text-align: center;
          }
          .info {
            flex: 1;
          }
          .filename {
            color: #fff;
            font-weight: 600;
            font-size: 1rem;
            margin-bottom: 5px;
            word-break: break-all;
          }
          .meta {
            color: #64748b;
            font-size: 0.85rem;
          }
          .download-btn {
            background: #3b82f6;
            color: #fff;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.2s;
            white-space: nowrap;
          }
          .download-btn:hover {
            background: #2563eb;
          }
          .highlight {
            border-color: #22c55e;
            background: linear-gradient(135deg, #1e293b 0%, #14532d 100%);
          }
          .badge {
            background: #22c55e;
            color: #fff;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 0.7rem;
            margin-left: 10px;
          }
          .section-title {
            color: #94a3b8;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 25px 0 15px;
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="header">
            <h1>📥 Downloads</h1>
            <p>Diário do Motorista - Arquivos disponíveis</p>
          </div>

          <div className="section-title">🚀 Última Versão (v3.0 com Matrícula)</div>
          
          {files.filter(f => f.name.includes('v3_matricula') || f.name.includes('migracao_matricula_v3')).map(file => (
            <div key={file.name} className={`card ${file.name.includes('v3') ? 'highlight' : ''}`}>
              <div className="icon">{getFileIcon(file.type)}</div>
              <div className="info">
                <div className="filename">
                  {file.name}
                  {file.name.includes('v3_matricula.zip') && <span className="badge">NOVO</span>}
                </div>
                <div className="meta">{file.size} • {file.date}</div>
              </div>
              <a href={`/api/download?file=${encodeURIComponent(file.name)}`} className="download-btn">
                Baixar
              </a>
            </div>
          ))}

          <div className="section-title">📁 Arquivos Anteriores</div>
          
          {files.filter(f => !f.name.includes('v3_matricula') && !f.name.includes('migracao_matricula_v3')).map(file => (
            <div key={file.name} className="card">
              <div className="icon">{getFileIcon(file.type)}</div>
              <div className="info">
                <div className="filename">{file.name}</div>
                <div className="meta">{file.size} • {file.date}</div>
              </div>
              <a href={`/api/download?file=${encodeURIComponent(file.name)}`} className="download-btn">
                Baixar
              </a>
            </div>
          ))}
        </div>
      </body>
    </html>
  );
}
