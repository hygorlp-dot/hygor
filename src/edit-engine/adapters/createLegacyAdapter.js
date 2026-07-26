export function createLegacyAdapter({ fromLegacy, toLegacy }) {
  return {
    fromLegacy(record) { return fromLegacy(record); },
    toLegacy(values, original) { return { ...original, ...toLegacy(values, original) }; },
  };
}
