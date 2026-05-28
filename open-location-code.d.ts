declare module 'open-location-code' {
  export class OpenLocationCode {
    constructor();
    encode(latitude: number, longitude: number, codeLength: number): string;
    decode(code: string): { latitudeCenter: number; longitudeCenter: number };
  }
}
