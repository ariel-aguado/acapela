# Biblias

Bases de origen de las versiones de la Biblia que ofrece Acapela, con el mismo
formato que SúperBiblia (tablas `testament`, `book`, `verse`, `metadata`).

`pnpm bibles:build` (también en `predev` y `prebuild`) las convierte en
`public/bibles/<id>.<hash>.sqlite` + `<id>.books.json` + `manifest.json`
con `scripts/build-bible-db.mjs`. La app descarga cada versión la primera vez
que se usa y desde ahí funciona sin conexión.

| Archivo          | Versión                          |
| ---------------- | -------------------------------- |
| `rvr1960.sqlite` | Reina-Valera 1960                |
| `nvi1999.sqlite` | Nueva Versión Internacional 1999 |
| `lbla.sqlite`    | La Biblia de las Américas        |
| `dhh.sqlite`     | Dios Habla Hoy                   |

Los `.sqlite` no están en este repositorio, que es público: son textos con
derechos de autor. Sin ellos la app compila y funciona igual, solo que sin
versiones de la Biblia para elegir. Para tenerlas, copia los archivos a esta
carpeta.
