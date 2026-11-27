#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
/**
 * Genera el .sqlite servido por la PWA a partir de una base cruda tipo
 * `rvr1960.sqlite` (tablas testament/book/verse/metadata, sin FTS5):
 *
 *   1. trimea el texto de cada versículo
 *   2. crea la tabla virtual FTS5 `verse_fts` para búsqueda full-text
 *   3. exporta el índice de libros a JSON (para Fuse.js en el cliente)
 *   4. escribe el resultado en public/bibles/<id>.<hash8>.sqlite y
 *      actualiza public/bibles/manifest.json
 *
 * El archivo de entrada NUNCA se modifica — se copia a un temporal y se
 * trabaja ahí. Usa node:sqlite (built-in desde Node 22.5+), sin
 * dependencias nativas nuevas.
 *
 * Uso:
 *   node scripts/build-bible-db.mjs --input data/biblias/rvr1960.sqlite --id rvr1960 --label "Reina-Valera 1960"
 */
import { DatabaseSync } from 'node:sqlite'

function parseArgs(argv) {
  const args = { input: 'data/biblias/rvr1960.sqlite', id: 'rvr1960', label: 'Reina-Valera 1960' }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--input')
      args.input = argv[++i]
    else if (arg === '--id')
      args.id = argv[++i]
    else if (arg === '--label')
      args.label = argv[++i]
  }
  return args
}

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function main() {
  const { input, id, label } = parseArgs(process.argv.slice(2))
  const projectRoot = process.cwd()
  const inputPath = path.resolve(projectRoot, input)
  const outDir = path.resolve(projectRoot, 'public/bibles')

  const stat = statSync(inputPath, { throwIfNoEntry: false })
  if (!stat) {
    console.error(`[build-bible-db] no se encontró el archivo de entrada: ${inputPath}`)
    process.exit(1)
  }

  mkdirSync(outDir, { recursive: true })

  const features = []
  const workDir = mkdtempSync(path.join(tmpdir(), 'bible-db-'))
  const workPath = path.join(workDir, `${id}.sqlite`)
  copyFileSync(inputPath, workPath)

  console.log(`[build-bible-db] procesando ${input} -> ${workPath}`)
  const db = new DatabaseSync(workPath)

  try {
    // Columna opcional: solo los orígenes convertidos con convert-mybible-db.mjs
    // (post-fusión de versículos, ver ese script) la traen. Se agrega acá tal
    // cual, en NULL, para cualquier otro origen (ej. rvr1960.sqlite, que no
    // tiene el concepto) — así el schema queda uniforme entre TODAS las
    // traducciones y el worker puede seleccionarla sin condicionales.
    const hasRangeEndColumn = db.prepare('PRAGMA table_info(verse)').all().some(col => col.name === 'verse_range_end')
    if (!hasRangeEndColumn)
      db.exec('ALTER TABLE verse ADD COLUMN verse_range_end INTEGER;')

    // trim() en SQLite solo recorta espacios por defecto — el dataset original
    // trae \n/\r/\t sueltos al inicio/fin de varios versículos (ej. los
    // encabezados hebreos de Salmos 119, "\n \n\nAlef\n..."), así que hay que
    // pasar explícitamente el set de caracteres de espacio en blanco a recortar.
    db.exec('UPDATE verse SET text = trim(text, \' \' || char(10) || char(13) || char(9));')

    db.exec('DROP TABLE IF EXISTS verse_fts;')
    db.exec(`
      CREATE VIRTUAL TABLE verse_fts USING fts5(
        text,
        content='verse',
        content_rowid='id',
        tokenize="unicode61 remove_diacritics 2"
      );
    `)
    db.exec('INSERT INTO verse_fts(verse_fts) VALUES(\'rebuild\');')

    // Chequeo de sanidad del tokenizer: "amo" debe matchear también "Amó" (con tilde).
    const diacriticsCheck = db.prepare(
      'SELECT count(*) AS n FROM verse_fts WHERE verse_fts MATCH \'amo*\'',
    ).get()
    if (!diacriticsCheck || Number(diacriticsCheck.n) === 0) {
      throw new Error(
        'el tokenizer FTS5 (remove_diacritics 2) no matcheó ningún resultado para "amo*" — revisar el schema antes de shippear',
      )
    }
    console.log(`[build-bible-db] chequeo FTS5/diacríticos OK (${diacriticsCheck.n} filas para "amo*")`)

    db.exec('VACUUM;')
    db.prepare('PRAGMA journal_mode = DELETE').get()

    // Índice de libros para el autocompletado en el cliente (Fuse.js) y para
    // la navegación entre capítulos (chapterCount), no pasa por SQLite en runtime.
    const books = db
      .prepare(
        `SELECT book.id AS id, book.testament_id AS testamentId, book.name AS name, book.abbreviation AS abbreviation,
                (SELECT MAX(v.chapter) FROM verse v WHERE v.book_id = book.id) AS chapterCount
         FROM book ORDER BY book.id`,
      )
      .all()

    // versesPerChapter[i] = cantidad de versículos del capítulo i+1 — le da al
    // parser de referencia rápida (parseBibleReference.ts) la estructura real
    // de la Biblia para validar/desambiguar (ej. "HB29": ¿existe Hebreos 29?
    // no -> ¿existe Hebreos 2:9? sí), en vez de aceptar cualquier número.
    const chapterVerseCounts = db
      .prepare(
        `SELECT book_id AS bookId, chapter, MAX(verse) AS verseCount
         FROM verse GROUP BY book_id, chapter ORDER BY book_id, chapter`,
      )
      .all()
    const versesPerChapterByBook = new Map()
    for (const row of chapterVerseCounts) {
      const list = versesPerChapterByBook.get(row.bookId) ?? []
      list[row.chapter - 1] = row.verseCount
      versesPerChapterByBook.set(row.bookId, list)
    }
    const booksWithStructure = books.map(book => ({
      ...book,
      versesPerChapter: versesPerChapterByBook.get(book.id) ?? [],
    }))

    writeFileSync(path.join(outDir, `${id}.books.json`), JSON.stringify(booksWithStructure, null, 2))
    console.log(`[build-bible-db] ${books.length} libros exportados a ${id}.books.json`)

    // Funciones extra de la traducción, para que la app ofrezca solo lo que
    // la base trae: 'strongs' = números Strong por palabra (ver
    // scripts/convert-lbla-db.mjs).
    const columns = db.prepare('PRAGMA table_info(verse)').all().map(col => col.name)
    if (columns.includes('strongs'))
      features.push('strongs')
  }
  finally {
    db.close()
  }

  const hash8 = sha256File(workPath).slice(0, 8)
  const finalName = `${id}.${hash8}.sqlite`
  const finalPath = path.join(outDir, finalName)

  // Limpia builds anteriores del mismo id (nombre con hash distinto) para no
  // acumular .sqlite huérfanos en cada rebuild durante desarrollo.
  const stalePattern = new RegExp(`^${id}\\.[0-9a-f]{8}\\.sqlite$`)
  for (const entry of readdirSync(outDir)) {
    if (stalePattern.test(entry) && entry !== finalName) {
      rmSync(path.join(outDir, entry))
    }
  }

  copyFileSync(workPath, finalPath)
  rmSync(workDir, { recursive: true, force: true })

  const sizeBytes = statSync(finalPath).size
  const sha256 = sha256File(finalPath)
  const builtAt = new Date().toISOString()

  const manifestPath = path.join(outDir, 'manifest.json')
  const manifestStat = statSync(manifestPath, { throwIfNoEntry: false })
  const manifest = manifestStat ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { versions: [] }

  const entry = { id, label, file: finalName, sizeBytes, sha256, schemaVersion: 1, builtAt, ...(features.length ? { features } : {}) }
  manifest.versions = [...manifest.versions.filter(v => v.id !== id), entry]
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  console.log(`[build-bible-db] listo: public/bibles/${finalName} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`)
}

main()
