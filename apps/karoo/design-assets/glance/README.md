# Karoo glance verdict assets

Original37x37 Figma SVG exports retained without geometry edits; PNG copies at the same37x37
size are in app/src/main/res/drawable-nodpi/gm_glance_*.png. Native Canvas uses those PNGs in
the corresponding verdict slots; there are no temporary asset URLs at runtime.

Source: Figma cyaMDDfLBKFc4NNK1SUUnb, design-to-code session cfa58783-4a85-4cb7-afeb-97a9261649ab.
ON322:217, MORE322:246, WARN322:285, EASE304:217, CAUTION305:1553.
SVG-to-PNG conversion used the bundled sharp library at original dimensions (no resize/recolour).
Standalone node screenshot exports were blank; these files are from the original design-context
SVG assets, verified nonempty/transparent and rendered in the native preview matrix.
Charts, bands and rider/pacer markers are dynamic Canvas geometry driven by telemetry; the
sample route vectors in Figma are not static production assets.
