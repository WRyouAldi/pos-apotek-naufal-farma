import Dexie,{type Table} from 'dexie';
import type {Movement,Product,Sale} from '../domain/entities';
/** IndexedDB adapter. Schema changes must be versioned and migration-tested. */
class PharmacyDatabase extends Dexie {
 products!:Table<Product>; sales!:Table<Sale>; movements!:Table<Movement>;
 constructor(){super('naufal-farma-pos');this.version(1).stores({products:'++id,&code,barcode,name,category',sales:'++id,createdAt',movements:'++id,createdAt,type,code'});}
}
export const db=new PharmacyDatabase();
export type {Movement,Product,Sale} from '../domain/entities';
