import { NextResponse } from 'next/server'

export function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function buildCsvRow(fields: unknown[]): string {
  return fields.map(escapeCsvField).join(',')
}

export function buildCsvResponse(headers: string[], rows: unknown[][], filename: string): NextResponse {
  const headerLine = headers.map(escapeCsvField).join(',')
  const dataLines = rows.map(r => buildCsvRow(r)).join('\n')
  const csv = headerLine + '\n' + dataLines

  // Sanitize filename: remove path traversal and non-safe characters
  const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/_{2,}/g, '_')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
    },
  })
}

export function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = parseCsvLine(lines[0])
  const rows = lines.slice(1).map(parseCsvLine)
  return { headers, rows }
}

export interface CsvImportResult {
  success: number
  errors: { row: number; message: string }[]
}

export function buildImportResponse(result: CsvImportResult) {
  if (result.errors.length === 0) {
    return NextResponse.json({ message: `Imported ${result.success} records successfully.`, result })
  }
  return NextResponse.json({
    message: `Imported ${result.success} records with ${result.errors.length} errors.`,
    result,
  }, { status: 207 })
}

export function extractColumn(headers: string[], rows: string[][], name: string): { index: number; values: string[] } {
  const index = headers.findIndex(h => h.toLowerCase().trim() === name.toLowerCase().trim())
  if (index === -1) return { index: -1, values: [] }
  return { index, values: rows.map(r => r[index] || '') }
}
