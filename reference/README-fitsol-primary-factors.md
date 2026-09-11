# Fitsol primary emission factors — owner-supplied

`fitsol_primary_factors.csv` ships with a **header row and no data**, on purpose.

A `primary` factor is Fitsol's own measured or supplier-confirmed value. It
outranks any `secondary_database` factor for the same `(material, process)`, so
it is the number a customer sees. Nobody but the owner can supply one, and this
repository will not invent a row to make the footprint card look complete.

Fill the rows, then load them — this is a **human-only** command, like
`corpus:approve`:

```bash
npm run factors:select -- --primary-file reference/fitsol_primary_factors.csv --selected-by "Akshay Tandon"
```

## Columns

| Column | Required | Meaning |
|---|---|---|
| `material` | yes | BOM material (`corrugated`, `plastic`, `wood_solid`, `wood_processed`, `metal`) or `transport` |
| `process` | yes | `production`, or the mode (`road`, `sea`, `air`) for a transport row |
| `factor` | yes | The value |
| `unit` | yes | `kgCO2e/kg` for production; `kgCO2e/kg.km` for transport |
| `region` | yes | ISO-3166 code, or a region key you use consistently |
| `year` | yes | The year the value represents |
| `source` | no | Defaults to `Fitsol` |
| `source_dataset` | no | Which study/measurement campaign it came from |
| `methodology` | no | GWP set and system boundary, e.g. `AR6 GWP100, cradle-to-gate` |
| `licence_note` | no | What the terms say about republishing the value |
| `value_display_permitted` | no | `true` lets the **public passport** show the value itself. Default `false` — the passport shows the computed result and the source name only |
| `notes` | no | Anything a reviewer should know |

Loading appends a **new version** per `(material, process)`; it never overwrites.
Assessments already evaluated keep the version they pinned.
