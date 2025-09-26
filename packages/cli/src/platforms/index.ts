// Platform abstraction exports
export {
  BasePlatform,
  type BasePlatformConfig,
  type BasePlatformCapabilities,
  type ScrapeOptions,
} from './base-platform.js';

export {
  PlatformFactory,
  type PlatformConstructor,
  type FactoryOptions,
} from './platform-factory.js';

export { PlatformRegistry } from './platform-registry.js';
