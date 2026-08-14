// @garmin/fitsdk 21.213.0 publishes declarations that reference an omitted src/types
// directory. Keep this minimal runtime-facing shim until Garmin repairs that package.
declare module "@garmin/fitsdk" {
  export class Stream {
    static fromArrayBuffer(buffer: ArrayBuffer): Stream;
  }

  export class Decoder {
    static isFIT(stream: Stream): boolean;
    constructor(stream: Stream);
    checkIntegrity(): boolean;
    read(options?: Record<string, unknown>): {
      messages: Record<string, Array<Record<string, unknown>> | undefined>;
      errors: unknown[];
    };
  }
}
