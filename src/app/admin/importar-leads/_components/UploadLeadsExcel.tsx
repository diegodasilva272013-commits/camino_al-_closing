'use client';

import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ParsedRow = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  status?: string;
  notes?: string;
};

type ParsedSheet = {
  name: string;
  rows: ParsedRow[];
};

type ImportResult = {
  imported: number;
  batch_id: string;
  perSheet: { sheet: string; matchedSetter: string | null; rows: number }[];
};

function pick(row: Record<string, any>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    const norm = k.trim().toLowerCase();
    if (keys.includes(norm)) {
      const v = row[k];
      if (v !== undefined && v !== null) return String(v).trim();
    }
  }
  return '';
}

function followUpFields(row: Record<string, any>): string {
  const parts: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const v = pick(row, [`seguimiento${i}`, `seguimiento ${i}`]);
    if (v) parts.push(`Seguimiento ${i}: ${v}`);
  }
  const obs = pick(row, ['observaciones', 'observacion', 'notas', 'notes']);
  if (obs) parts.push(`Observaciones: ${obs}`);
  return parts.join('\n');
}

function parseLeadsExcel(file: File): Promise<ParsedSheet[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheets: ParsedSheet[] = workbook.SheetNames.map((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
          const rows: ParsedRow[] = json
            .map((row) => ({
              first_name: pick(row, ['nombre', 'first name', 'firstname', 'first_name']),
              last_name: pick(row, ['apellido', 'last name', 'lastname', 'last_name']),
              phone: pick(row, ['celular', 'telefono', 'teléfono', 'phone', 'tel', 'whatsapp']),
              email: pick(row, ['email', 'correo', 'e-mail', 'mail']),
              status: pick(row, ['estado', 'status']) || 'Pendiente',
              notes: followUpFields(row),
            }))
            .filter((r) => r.phone);
          return { name: sheetName, rows };
        });
        resolve(sheets);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export function UploadLeadsExcel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const totalRows = sheets.reduce((acc, s) => acc + s.rows.length, 0);

  async function handleFile(file: File) {
    setError('');
    setResult(null);
    setParsing(true);
    try {
      const parsed = await parseLeadsExcel(file);
      setSheets(parsed);
      setFileName(file.name);
    } catch {
      setError('No se pudo leer el archivo. Verificá que sea un .xlsx válido.');
      setSheets([]);
    }
    setParsing(false);
  }

  function reset() {
    setSheets([]);
    setFileName('');
    setResult(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function doImport() {
    if (!totalRows) return;
    setImporting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/leads/import-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheets }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al importar.');
      } else {
        setResult(data);
        setSheets([]);
        if (fileRef.current) fileRef.current.value = '';
      }
    } catch {
      setError('Error de red al importar.');
    }
    setImporting(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-brand-muted">
        El archivo .xlsx puede tener una hoja por setter (el nombre de la hoja se usa para
        asignar automáticamente los leads a ese setter) o una base completa en una sola hoja.
        Columnas reconocidas: <code className="text-brand-gold/80">Nombre, Apellido, Celular, Email, Estado,
        Seguimiento1-6, Observaciones</code>.
      </p>

      {sheets.length === 0 && !result && (
        <div
          className="border-2 border-dashed border-[rgba(212,175,55,0.2)] rounded-xl p-10 text-center cursor-pointer hover:border-brand-gold/30 transition"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <FileSpreadsheet className="h-10 w-10 text-brand-gold/30 mx-auto mb-3" />
          <p className="text-sm text-brand-muted">
            {parsing ? 'Leyendo archivo...' : 'Arrastrá el .xlsx o hacé click para seleccionar'}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      )}

      {sheets.length > 0 && (
        <div className="rounded-xl border border-[rgba(212,175,55,0.15)] bg-[#0d0d0d] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-brand-text">{fileName}</p>
            <button onClick={reset} className="text-brand-muted hover:text-brand-text">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 space-y-1">
            {sheets.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <span className="text-brand-muted">Hoja: <span className="text-brand-gold">{s.name}</span></span>
                <span className="text-brand-muted">{s.rows.length} leads</span>
              </div>
            ))}
          </div>

          <p className="mt-3 text-sm text-brand-gold">{totalRows} leads listos para importar</p>

          <button
            onClick={doImport}
            disabled={importing || !totalRows}
            className="mt-4 w-full rounded-xl bg-brand-gold/20 border border-brand-gold/30 py-2.5 text-sm font-semibold text-brand-gold hover:bg-brand-gold/30 transition disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Upload className="h-4 w-4" />
            {importing ? 'Importando...' : `Importar ${totalRows} leads`}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {result && (
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/10 p-5">
          <p className="text-sm font-semibold text-emerald-400">
            ✅ {result.imported} leads importados · Lote {result.batch_id}
          </p>
          <div className="mt-3 space-y-1.5">
            {result.perSheet.map((s) => (
              <div key={s.sheet} className="flex items-center justify-between text-xs">
                <span className="text-brand-muted">{s.sheet} ({s.rows} filas)</span>
                <span className={cn(s.matchedSetter ? 'text-brand-gold' : 'text-orange-400/80')}>
                  {s.matchedSetter ? `→ ${s.matchedSetter}` : 'Sin setter asignado'}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={reset}
            className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-xs text-brand-muted hover:text-brand-text transition"
          >
            Importar otro archivo
          </button>
        </div>
      )}
    </div>
  );
}
