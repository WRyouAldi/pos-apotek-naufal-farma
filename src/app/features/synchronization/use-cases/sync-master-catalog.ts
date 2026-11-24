import {db} from '../../../infrastructure/database';
import type {Product} from '../../../domain/entities';
import {parseMasterCSV,productsFromCSV} from '../../../shared/data/master-csv';
import {readProductOverrides,readDeletedProductCodes} from '../../../shared/data/product-sync-preferences';
export async function syncMasterCatalogCSV(raw:string):Promise<{count:number;skipped:number;repaired:number}>{
 const parsed=parseMasterCSV(raw),{list:incoming,skipped}=productsFromCSV(parsed);
 if(incoming.length<100)throw new Error('CSV GitHub tidak lengkap: hanya '+incoming.length+' produk valid. Data lokal tidak diubah.');
 const existing=await db.products.toArray(),byCode=new Map(existing.map(p=>[p.code,p]));
 const overrides=readProductOverrides(),deleted=new Set(readDeletedProductCodes());
 await db.transaction('rw',db.products,async()=>{for(const item of incoming){if(deleted.has(item.code))continue;const merged={...item,...(overrides[item.code]||{})};const old=byCode.get(item.code);if(old?.id)await db.products.update(old.id,{...merged,stock:overrides[item.code]?.stock??old.stock,barcode:merged.barcode||old.barcode});else await db.products.add(merged);}});
 return {count:incoming.length,skipped,repaired:parsed.repaired};
}
export async function fetchMasterCatalogCSV():Promise<string>{
 const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),20000);
 try{const response=await fetch('https://raw.githubusercontent.com/WRyouAldi/pos-apotek-naufal-farma/main/public/data/xReport2.csv?sync='+Date.now(),{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('GitHub raw merespons '+response.status);return await response.text();}
 catch(rawError){const response=await fetch('https://api.github.com/repos/WRyouAldi/pos-apotek-naufal-farma/contents/public/data/xReport2.csv?ref=main',{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});if(!response.ok)throw new Error('GitHub tidak dapat diakses ('+response.status+'). '+(rawError instanceof Error?rawError.message:''));const payload=await response.json() as {content?:string;encoding?:string};if(!payload.content||payload.encoding!=='base64')throw new Error('Isi CSV GitHub tidak dapat dibaca.');const binary=atob(payload.content.replace(/\\s/g,''));return new TextDecoder().decode(Uint8Array.from(binary,ch=>ch.charCodeAt(0)));}
 finally{window.clearTimeout(timeout)}
}
