import Papa from 'papaparse';
import type {Product} from '../../domain/entities';
export function parseMasterCSV(raw:string){
 const lines=raw.replace(/^\uFEFF/,'').split(/\r\n|\n|\r/);
 const headerAt=lines.findIndex(line=>/kode\s*item/i.test(line)&&/nama\s*item/i.test(line));
 if(headerAt<0)throw new Error('Header CSV tidak ditemukan. Pastikan ada kolom Kode Item dan Nama Item.');
 const headerLine=lines[headerAt],delimiter=headerLine.includes(';')?';':headerLine.includes('\t')?'\t':',';
 const normalized=[headerLine];let repaired=0;
 for(const line of lines.slice(headerAt+1)){if(!line.trim())continue;const fields=Papa.parse<string[]>(line,{header:false,delimiter,skipEmptyLines:false}).data[0]??[];if(fields.length===25){normalized.push(Papa.unparse([fields.slice(0,12).concat(''),fields.slice(12)],{delimiter}));repaired++;}else normalized.push(line);}
 const parsed=Papa.parse<Record<string,string>>(normalized.join('\n'),{header:true,delimiter,skipEmptyLines:'greedy',transformHeader:h=>h.replace(/^\uFEFF/,'').trim().toLowerCase()});
 if(parsed.errors.length)throw new Error('Format CSV tidak valid pada baris '+(headerAt+1+parsed.errors[0].row)+'. Periksa pemisah dan tanda kutip.');
 const headers=Object.keys(parsed.data[0]??{}),required=['kode item','nama item','stok','harga beli','harga jual'];
 for(const key of required)if(!headers.includes(key))throw new Error('Kolom wajib tidak ditemukan: '+key+'.');
 return {data:parsed.data,headerAt,repaired};
}
function csvInteger(value:string,label:string,line:number){const raw=value.trim().replace(/^rp\s*/i,'').replace(/\s/g,'');if(!raw)throw new Error(label+' kosong pada baris '+line+'.');if(!/^-?\d+$|^-?\d{1,3}(?:\.\d{3})+$/.test(raw))throw new Error(label+' memiliki format angka tidak valid pada baris '+line+': '+value);const result=Number(raw.replace(/\./g,''));if(!Number.isSafeInteger(result))throw new Error(label+' di luar batas angka aman pada baris '+line+'.');return result;}
export function productsFromCSV(parsed:ReturnType<typeof parseMasterCSV>){
 const seen=new Set<string>(),list:Product[]=[];let skipped=0;
 for(let i=0;i<parsed.data.length;i++){const row=parsed.data[i],get=(...keys:string[])=>{const k=Object.keys(row).find(x=>keys.includes(x));return k?String(row[k]??'').trim():'';};const code=get('kode item','kode'),name=get('nama item','nama');
 if(!code&&!name){skipped++;continue;}if(code==='.'&&name==='.') {skipped++;continue;}if(/^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}$/.test(code)&&get('kode barcode')==='ADMIN'&&!name){skipped++;continue;}
 const line=parsed.headerAt+i+2;if(!code||!name)throw new Error('Baris '+line+': kode dan nama produk wajib diisi.');if(seen.has(code))throw new Error('Kode produk duplikat: '+code+' (baris '+line+').');seen.add(code);
 const stock=csvInteger(get('stok'),'Stok',line),buyPrice=csvInteger(get('harga beli'),'Harga Beli',line),sellPrice=csvInteger(get('harga jual'),'Harga Jual',line),minStock=get('stok min')?csvInteger(get('stok min'),'Stok Minimum',line):0;
 if(buyPrice<0||sellPrice<0||minStock<0)throw new Error('Harga dan stok minimum tidak boleh negatif (baris '+line+').');
 list.push({code,barcode:get('kode barcode','barcode'),name,category:get('jenis','kategori'),brand:get('merek','brand'),stock,unit:get('satuan')||'pcs',buyPrice,sellPrice,minStock,shelf:get('rak'),supplier:get('supplier')});}
 if(!list.length)throw new Error('Tidak ada produk valid untuk diproses.');return {list,skipped};
}
