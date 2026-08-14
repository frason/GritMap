# FIT Parser Spike: Real Karoo Files

## Library decision

GritMap's parser uses `@garmin/fitsdk` version `21.213.0`, Garmin's official JavaScript FIT SDK. It was selected because it:

- accepts `ArrayBuffer` directly and has no file-I/O requirement;
- exposes a synchronous decoder, matching `parseFitFile(buffer): ParsedRide`;
- applies FIT profile scale/offset rules and converts timestamps to JavaScript `Date` values;
- checks the FIT header, file size, and CRC;
- is documented for Node or compatible browser runtimes, making it a better portability fit than a Node-oriented parser API.

When the Expo scaffold's package manifest lands, add the dependency with:

```sh
npm install @garmin/fitsdk@21.213.0
```

The current npm release has one packaging defect: its `index.d.ts` re-exports declarations from a `src/types/` directory that is absent from the published package. Runtime decoding works, but TypeScript resolution does not. `src/types/garmin-fitsdk.d.ts` provides the smallest required temporary declaration shim. Remove it when Garmin publishes complete declarations.

## Validation results

Both files passed FIT header, declared-size, and CRC integrity checks. Garmin's decoder returned no errors or warnings.

| File | Points | GPS | Distance | Elevation | Power | HR | Cadence | Speed | Temperature |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `Karoo-Morning_Ride-2026-08-02-0837.fit` | 11,004 | 10,964 | 11,004 | 11,004 | 11,002 | 11,004 | 10,949 | 10,975 | 11,003 |
| `Karoo-Morning_Ride-2026-08-09-0844.fit` | 8,592 | 8,563 | 8,591 | 8,592 | 8,566 | 8,586 | 8,546 | 8,566 | 8,592 |

All requested channels occur in both rides, but several records omit GPS or individual sensors. The parser preserves those omissions as `undefined`. Both files also contain real zero power, cadence, and speed samples, which remain zero.

No local/UTC timestamp pair or timezone-offset field was present, so `originalTimezoneOffsetMinutes` is correctly `undefined`. UTC record timestamps are present throughout. File metadata identifies a Hammerhead Karoo (`manufacturer: hammerhead`, `productName: Karoo`, product 3, serial 241760203), its local barometer, and ANT+ heart-rate, Favero Assioma Uno power, and bike speed/cadence devices.

## Sample normalized points

August 2 first/middle/last:

```json
{"timestampMs":1785685042000,"distanceMeters":0,"elevationMeters":147,"heartRate":78,"cadence":0}
{"timestampMs":1785690864000,"lat":37.79331827536225,"lng":-121.98407826013863,"distanceMeters":37488.98,"elevationMeters":185.2,"power":90,"heartRate":117,"cadence":92,"speedMetersPerSec":8.265,"temperatureCelsius":24}
{"timestampMs":1785696422000,"lat":37.892311653122306,"lng":-122.12852661497891,"distanceMeters":74548.57,"elevationMeters":155.8,"power":0,"heartRate":131,"cadence":0,"speedMetersPerSec":0,"temperatureCelsius":28}
```

August 9 first/middle/last:

```json
{"timestampMs":1786290293000,"elevationMeters":108.2,"temperatureCelsius":19}
{"timestampMs":1786295308000,"lat":37.835854925215244,"lng":-122.18420659191906,"distanceMeters":25951.8,"elevationMeters":360.2,"power":369,"heartRate":166,"cadence":67,"speedMetersPerSec":3.83,"temperatureCelsius":19}
{"timestampMs":1786299608000,"lat":37.89204997010529,"lng":-122.12845494970679,"distanceMeters":55600.81,"elevationMeters":112.6,"power":0,"heartRate":127,"cadence":0,"speedMetersPerSec":0,"temperatureCelsius":26}
```

## Karoo-specific observations

- Initial record messages may contain only timestamp/elevation and a subset of sensors; consumers must not assume the first point has GPS.
- `enhancedAltitude` and `enhancedSpeed` are emitted alongside legacy values. The wrapper prefers enhanced fields and falls back to legacy fields.
- Coordinates arrive from Garmin's SDK in FIT semicircles and are converted to WGS84 degrees by the wrapper.
- Barometric elevation is present on every record in these files, confirming it can be retained as the primary elevation source.
- A coarse route-overlap check found about 14% of sampled August 2 GPS points within 30 meters of the August 9 track. The rides share portions and finish in nearly the same place, but are not the same complete route; segment matching, rather than whole-ride equality, is appropriate.
