import {db} from '../../../infrastructure/database';
import type {Product,Sale} from '../../../domain/entities';
export type SaleLineRequest={code:string;qty:number};
/** Atomically persists a sale, decrements stock and writes the inventory ledger. */
export async function recordSale(lines:SaleLineRequest[]):Promise<Sale>{
 if(!lines.length)throw new Error('Keranjang masih kosong.');
 if(lines.some(x=>!Number.isSafeInteger(x.qty)||x.qty<1))throw new Error('Jumlah harus bilangan bulat positif.');
 return db.transaction('rw',db.products,db.sales,db.movements,async()=>{
  const fresh:{p:Product;qty:number}[]=[];
  for(const line of lines){
   const p=await db.products.where('code').equals(line.code).first();
   if(!p)throw new Error('Produk tidak ditemukan: '+line.code);
   if(!Number.isFinite(p.sellPrice)||p.sellPrice<0||!Number.isFinite(p.buyPrice)||p.buyPrice<0)throw new Error('Harga tidak valid: '+p.name);
   fresh.push({p,qty:line.qty});
  }
  const sale:Sale={createdAt:new Date().toISOString(),total:fresh.reduce((a,x)=>a+x.qty*x.p.sellPrice,0),items:fresh.map(x=>({code:x.p.code,name:x.p.name,qty:x.qty,price:x.p.sellPrice,cost:x.p.buyPrice}))};
  if(!Number.isFinite(sale.total)||sale.total<0)throw new Error('Total tidak valid.');
  await db.sales.add(sale);
  for(const x of fresh){
   if(!x.p.id)throw new Error('Identitas produk tidak valid.');
   await db.products.update(x.p.id,{stock:x.p.stock-x.qty});
   await db.movements.add({createdAt:sale.createdAt,type:'PENJUALAN',code:x.p.code,name:x.p.name,qty:-x.qty,unitCost:x.p.buyPrice,note:'Penjualan kasir'});
  }
  return sale;
 });
}
