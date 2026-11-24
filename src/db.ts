/** @deprecated Compatibility facade. New modules import app/domain or app/infrastructure directly. */
export {db} from './app/infrastructure/database';
export type {Product,Sale,Movement} from './app/domain/entities';
