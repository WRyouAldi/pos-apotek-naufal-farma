import {db} from '../../../infrastructure/database';
import type {Movement} from '../../../domain/entities';
export type InventoryMovementType='MASUK'|'KELUAR';
/** Atomically changes stock and writes its movement ledger entry. */
export async function recordInventoryMovement(code:string,qty:number,type:InventoryMovementType):Promise<Movement>{
 if(!code.trim())throw new Error('Produk tidak ditemukan.');
 if(!Number.isSafeInteger(qty)||qty<1)throw new Error('Jumlah harus bilangan bulat positif.');
 return db.transaction('rw',db.products,db.movements,async()=>{
  const product=await db.products.where('code').equals(code).first();
  if(!product?.id)throw new Error('Produk tidak ditemukan.');
  if(type==='KELUAR'&&qty>product.stock)throw new Error('Stok tidak cukup. Tersedia: '+product.stock);
  const next=product.stock+(type==='MASUK'?qty:-qty);
  if(!Number.isSafeInteger(next))throw new Error('Perubahan stok tidak valid.');
  await db.products.update(product.id,{stock:next});
  const movement:Movement={createdAt:new Date().toISOString(),type,code:product.code,name:product.name,qty:type==='MASUK'?qty:-qty,unitCost:product.buyPrice,note:type==='MASUK'?'Penerimaan':'Pengeluaran'};
  await db.movements.add(movement);
  return movement;
 });
}
