import {db} from '../../../infrastructure/database';
import type {Product} from '../../../domain/entities';
import {readProductOverrides,writeProductOverrides,readDeletedProductCodes,writeDeletedProductCodes} from '../../../shared/data/product-sync-preferences';
export type CatalogInput=Omit<Product,'id'>;
export async function saveCatalogProduct(payload:CatalogInput,existing?:Product|null):Promise<void>{
 const code=payload.code.trim(),name=payload.name.trim();
 if(!code||!name)throw new Error('Kode item dan nama barang wajib diisi.');
 for(const [label,value] of [['Stok',payload.stock],['Harga beli',payload.buyPrice],['Harga jual',payload.sellPrice],['Stok minimum',payload.minStock]] as const)if(!Number.isSafeInteger(value)||value<0)throw new Error(label+' harus berupa bilangan bulat nol atau lebih.');
 const duplicate=await db.products.where('code').equals(code).first();
 if(duplicate&&duplicate.id!==existing?.id)throw new Error('Kode item sudah digunakan oleh barang lain.');
 const normalized={...payload,code,name};
 if(existing?.id){
  await db.products.update(existing.id,normalized);
  const overrides=readProductOverrides();
  if(existing.code!==code){writeDeletedProductCodes([...readDeletedProductCodes(),existing.code]);delete overrides[existing.code];}
  writeProductOverrides({...overrides,[code]:normalized});
 }else{
  await db.products.add(normalized);
  writeDeletedProductCodes(readDeletedProductCodes().filter(value=>value!==code));
  writeProductOverrides({...readProductOverrides(),[code]:normalized});
 }
}
export async function removeCatalogProduct(product:Product):Promise<void>{
 if(!product.id)throw new Error('Identitas produk tidak valid.');
 await db.products.delete(product.id);
 writeDeletedProductCodes([...readDeletedProductCodes(),product.code]);
 const overrides=readProductOverrides();delete overrides[product.code];writeProductOverrides(overrides);
}
export async function importCatalogProducts(incoming:Product[]):Promise<void>{
 if(!incoming.length)throw new Error('Tidak ada produk valid untuk diimpor.');
 const existing=await db.products.toArray(),byCode=new Map(existing.map(p=>[p.code,p]));
 await db.transaction('rw',db.products,async()=>{for(const p of incoming){const old=byCode.get(p.code);if(old?.id)await db.products.update(old.id,{...p,stock:old.stock,barcode:p.barcode||old.barcode});else await db.products.add(p);}});
}
