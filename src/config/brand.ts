/**
 * The app's name and identity. "Spindle" is a working title: change it here and
 * the manifest, page title and storage keys follow. (Also rename `name` in
 * package.json and the heading in README.md.)
 */
export const BRAND = {
  name: 'Spindle',
  description: 'A turntable DJ app for every age. Spin, scratch and mix your own music.',
  /** Must match --chassis in src/ui/theme/tokens.css. */
  themeColor: '#151518',
  /** Prefix for localStorage / IndexedDB / OPFS names. Changing it orphans saved data. */
  storagePrefix: 'spindle',
} as const;
