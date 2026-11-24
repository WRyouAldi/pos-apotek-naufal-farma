/** Domain entities. Persistence-independent business shapes. */
export type Product={id?:number;code:string;barcode:string;name:string;category:string;brand:string;stock:number;unit:string;buyPrice:number;sellPrice:number;minStock:number;shelf:string;supplier:string};
export type Sale={id?:number;createdAt:string;total:number;items:{code:string;name:string;qty:number;price:number;cost:number}[]};
export type Movement={id?:number;createdAt:string;type:'MASUK'|'KELUAR'|'PENJUALAN';code:string;name:string;qty:number;unitCost:number;note:string};
