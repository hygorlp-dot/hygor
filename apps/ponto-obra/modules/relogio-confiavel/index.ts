// Re-export the native module. On web, it will be resolved to RelogioConfiavelModule.web.ts
// and on native platforms to RelogioConfiavelModule.ts
export { default } from './src/RelogioConfiavelModule';
export * from './src/RelogioConfiavel.types';
