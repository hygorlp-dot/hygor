// Declarações extraídas literalmente da entrada legada; não importar LegacyApp aqui.
import { lazyWithCssRetry as lazy } from "../../lib/lazy-with-css-retry.js";

export const LazyRealEstateCommercial = lazy(() => import("./RealEstateCommercial")
  .then(module => ({ default:module.RealEstateCommercial })));
