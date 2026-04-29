declare module 'gifenc' {
  interface GIFEncoderOptions {
    initialCapacity?: number
    auto?: boolean
  }

  interface FrameOptions {
    transparent?: boolean
    transparentIndex?: number
    delay?: number
    palette?: [number, number, number][]
    repeat?: number
    colorDepth?: number
    dispose?: number
  }

  interface GIFEncoderInstance {
    reset(): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
    writeFrame(index: Uint8Array, width: number, height: number, opts: FrameOptions): void
  }

  function GIFEncoder(opt?: GIFEncoderOptions): GIFEncoderInstance

  function quantize(data: Uint8Array, maxColors: number, opts?: { format?: string }): [number, number, number][]
  function applyPalette(data: Uint8Array, palette: [number, number, number][], format?: string): Uint8Array

  export { GIFEncoder, quantize, applyPalette }
  export default GIFEncoder
}
