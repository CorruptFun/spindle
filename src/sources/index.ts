/**
 * sources: where music comes from. One folder per source, one shared contract.
 * The rest of the app asks the registry what a source can do and never
 * special-cases a service by name.
 */
export * from './types';
export * from './registry';
