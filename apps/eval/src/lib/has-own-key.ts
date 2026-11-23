/**
 * Whether an object has this key of its own, so the key can index it: `in` and a plain lookup
 * also match inherited keys such as `constructor`, which a key read from data may well be.
 */
export function hasOwnKey<TObject extends object>(
  object: TObject,
  key: string,
): key is Extract<keyof TObject, string> {
  return Object.hasOwn(object, key)
}
