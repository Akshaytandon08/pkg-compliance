# Proposed expected_flags additions (NOT APPLIED — for owner acceptance)

Source runs: `claude-sonnet-5` @ 2026-09-10T08-22-56-288Z (3 run(s)); prompt {"supplier_declaration":"1.3.0","lab_test_report":"1.3.0","heat_treatment_certificate":"1.3.0","mill_declaration":"1.3.0"}.

The manifest's expected flags predate the legibility, type-mismatch, grounding and
two-pass signals. Where the post-validator withheld a value and that was
**demonstrably** the right call, the document should expect `flag_low_confidence`;
otherwise the safety mechanism scores as a false positive forever.

**Nothing here is applied.** The manifest is ground truth and ground truth is
authored by a human. Accept or reject each row.

## Proposed: add `flag_low_confidence` to 7 document(s)

| Document | current expected_flags | justified rejections | why |
|---|---|--:|---|
| 05_supplier_declaration_D.jpg | flag_issuer | 5 | two independent passes read this field differently; at most one can be right |
| 10_lab_test_report_D.jpg | flag_unit_conversion | 12 | two independent passes read this field differently; at most one can be right |
| 12_heat_treatment_certificate_B.pdf | (none) | 2 | quoted span is not present in the document's text layer |
| 15_heat_treatment_certificate_D.jpg | flag_expired | 8 | two independent passes read this field differently; at most one can be right |
| 16_mill_declaration_A.pdf | (none) | 1 | quoted span is not present in the document's text layer |
| 20_mill_declaration_D.jpg | flag_scope_mismatch | 4 | two independent passes read this field differently; at most one can be right |
| 25_presswood_as-1210_D.jpg | (none) | 4 | two independent passes read this field differently; at most one can be right |

## Rejections that could NOT be justified (33) — excluded from the proposal

| Document | field | kind | rejected value |
|---|---|---|---|
| 06_lab_test_report_A.pdf | pb+cd+hg+cr(vi) | type_mismatch | <=100 |
| 07_lab_test_report_B.pdf | pb+cd+hg+cr(vi) | type_mismatch | <=100 |
| 09_lab_test_report_C.pdf | cd | type_mismatch | ND |
| 09_lab_test_report_C.pdf | hg | type_mismatch | ND |
| 09_lab_test_report_C.pdf | cr(vi) detection limit | type_mismatch | 0.1 |
| 09_lab_test_report_C.pdf | pb+cd+hg+cr(vi) acceptance criterion | type_mismatch | <=100 |
| 10_lab_test_report_D.jpg | pb+cd+hg+cr(vi) | type_mismatch | <=100 |
| 19_mill_declaration_C.pdf | stated_limit | type_mismatch | null |
| 04_supplier_declaration_C.pdf | combined heavy-metals concentration (measured value) | type_mismatch | null |
| 06_lab_test_report_A.pdf | pb+cd+hg+cr(vi) | type_mismatch | <=100 |
| 08_lab_test_report_B.pdf | cd | type_mismatch | <LOD |
| 08_lab_test_report_B.pdf | hg | type_mismatch | <LOD |
| 09_lab_test_report_C.pdf | cd | type_mismatch | ND |
| 09_lab_test_report_C.pdf | hg | type_mismatch | ND |
| 09_lab_test_report_C.pdf | pb+cd+hg+cr(vi) acceptance criterion | type_mismatch | <=100 |
| 10_lab_test_report_D.jpg | pb+cd+hg+cr(vi) | type_mismatch | <=100 |
| 11_heat_treatment_certificate_A.pdf | core_temperature | type_mismatch | >=56 |
| 15_heat_treatment_certificate_D.jpg | core_temperature | type_mismatch | >=56 |
| 19_mill_declaration_C.pdf | stated_limit | type_mismatch | null |
| 24_presswood_as-1111_C.pdf | resin grade designation | type_mismatch | E0 |
| 04_supplier_declaration_C.pdf | combined heavy-metals concentration (measured/reported value) | type_mismatch | null |
| 06_lab_test_report_A.pdf | pb+cd+hg+cr(vi) | type_mismatch | <=100 |
| 08_lab_test_report_B.pdf | cd | type_mismatch | <LOD |
| 08_lab_test_report_B.pdf | hg | type_mismatch | <LOD |
| 08_lab_test_report_B.pdf | pb+cd+hg+cr(vi) | type_mismatch | <=100 |

Overlay written to `eval/extraction/expected-flags-v2.json`. While it exists the
harness reports the legacy score and the v2 score side by side; it is not used
as ground truth until the owner folds it into the manifest.
