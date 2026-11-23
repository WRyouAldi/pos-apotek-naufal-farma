import Dexie, {type Table} from 'dexie';
export type Product={id?:number;code:string;barcode:string;name:string;category:string;brand:string;stock:number;unit:string;buyPrice:number;sellPrice:number;minStock:number;shelf:string;supplier:string;};
export type Sale={id?:number;createdAt:string;total:number;items:{code:string;name:string;qty:number;price:number;cost:number}[]};
export type Movement={id?:number;createdAt:string;type:'MASUK'|'KELUAR'|'PENJUALAN';code:string;name:string;qty:number;unitCost:number;note:string};
class AppDB extends Dexie {
 products!:Table<Product>;sales!:Table<Sale>;movements!:Table<Movement>;
 constructor(){super('naufal-farma-pos');this.version(1).stores({products:'++id,&code,barcode,name,category',sales:'++id,createdAt',movements:'++id,createdAt,type,code'});}
}
export const db=new AppDB();
