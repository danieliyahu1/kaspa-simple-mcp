const SOMPI_PER_KAS = 100_000_000;

export function sompiToKas(sompi: number): string {
  return (sompi / SOMPI_PER_KAS).toFixed(8);
}

export function sompiToKasNumber(sompi: number): number {
  return sompi / SOMPI_PER_KAS;
}
