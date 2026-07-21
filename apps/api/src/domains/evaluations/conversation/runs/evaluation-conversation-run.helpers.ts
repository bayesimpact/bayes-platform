export function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < array.length; index += batchSize) {
    batches.push(array.slice(index, index + batchSize))
  }
  return batches
}
