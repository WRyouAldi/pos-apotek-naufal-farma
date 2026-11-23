import {useEffect,useMemo,useRef,useState} from 'react';
import Papa from 'papaparse';
import {jsPDF} from 'jspdf';
import {Capacitor} from '@capacitor/core';
import {Directory,Filesystem} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {db,type Product,type Sale,type Movement} from './db';
import {Activity,ArrowDownToLine,ArrowUpFromLine,BarChart3,Boxes,Camera,ChevronDown,Home,Package,Search,Settings,ShoppingCart,ShoppingBag,Upload,WifiOff,Download,FileUp,Sparkles,Pill,TrendingUp,AlertTriangle,PackageCheck,ScanLine,ClipboardList,ShieldCheck,Cloud,RefreshCw,Sun,Moon} from 'lucide-react';
import {Html5Qrcode} from 'html5-qrcode';
import {UiButton,UiInput,UiModal} from './ui';
type Tab='Dashboard'|'Kasir'|'Cek Harga'|'Barang'|'Barang Masuk'|'Barang Keluar'|'Laporan'|'Pengaturan';
const localDate=(d=new Date())=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+day};
const money=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
const num=(v:unknown)=>Number(String(v??'0').replace(/[^0-9-]/g,''))||0;
function parseMasterCSV(raw:string){
 const lines=raw.replace(/^\uFEFF/,'').split(/\r\n|\n|\r/);
 const headerAt=lines.findIndex(line=>/kode\s*item/i.test(line)&&/nama\s*item/i.test(line));
 if(headerAt<0)throw new Error('Header CSV tidak ditemukan. Pastikan ada kolom Kode Item dan Nama Item.');
 const headerLine=lines[headerAt];
 const delimiter=headerLine.includes(';')?';':headerLine.includes('\t')?'\t':',';
 const normalized=[headerLine];let repaired=0;
 for(const line of lines.slice(headerAt+1)){
  if(!line.trim())continue;
  const fields=Papa.parse<string[]>(line,{header:false,delimiter,skipEmptyLines:false}).data[0]??[];
  if(fields.length===25){
   normalized.push(Papa.unparse([fields.slice(0,12).concat(''),fields.slice(12)],{delimiter}));
   repaired++;
  }else normalized.push(line);
 }
 const parsed=Papa.parse<Record<string,string>>(normalized.join('\n'),{
  header:true,delimiter,skipEmptyLines:'greedy',
  transformHeader:h=>h.replace(/^\uFEFF/,'').trim().toLowerCase()
 });
 if(parsed.errors.length)throw new Error('Format CSV tidak valid pada baris '+(headerAt+1+parsed.errors[0].row)+'. Periksa pemisah dan tanda kutip.');
 const headers=Object.keys(parsed.data[0]??{});
 const required=['kode item','nama item','stok','harga beli','harga jual'];
 for(const key of required)if(!headers.includes(key))throw new Error('Kolom wajib tidak ditemukan: '+key+'.');
 return {data:parsed.data,headerAt,repaired};
}
function csvInteger(value:string,label:string,line:number){
 const raw=value.trim().replace(/^rp\s*/i,'').replace(/\s/g,'');
 if(!raw)throw new Error(label+' kosong pada baris '+line+'.');
 if(!/^-?\d+$|^-?\d{1,3}(?:\.\d{3})+$/.test(raw))throw new Error(label+' memiliki format angka tidak valid pada baris '+line+': '+value);
 const result=Number(raw.replace(/\./g,''));
 if(!Number.isSafeInteger(result))throw new Error(label+' di luar batas angka aman pada baris '+line+'.');
 return result;
}
function productsFromCSV(parsed:ReturnType<typeof parseMasterCSV>){
 const seen=new Set<string>(),list:Product[]=[];let skipped=0;
 for(let i=0;i<parsed.data.length;i++){
  const row=parsed.data[i];
  const get=(...keys:string[])=>{const k=Object.keys(row).find(x=>keys.includes(x));return k?String(row[k]??'').trim():''};
  const code=get('kode item','kode'),name=get('nama item','nama');
  if(!code&&!name){skipped++;continue}
  if(code==='.'&&name==='.') {skipped++;continue}
  if(/^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}$/.test(code)&&get('kode barcode')==='ADMIN'&&!name){skipped++;continue}
  const line=parsed.headerAt+i+2;
  if(!code||!name)throw new Error('Baris '+line+': kode dan nama produk wajib diisi.');
  if(seen.has(code))throw new Error('Kode produk duplikat: '+code+' (baris '+line+').');
  seen.add(code);
  const stock=csvInteger(get('stok'),'Stok',line);
  const buyPrice=csvInteger(get('harga beli'),'Harga Beli',line);
  const sellPrice=csvInteger(get('harga jual'),'Harga Jual',line);
  const minStock=get('stok min')?csvInteger(get('stok min'),'Stok Minimum',line):0;
  if(buyPrice<0||sellPrice<0||minStock<0)throw new Error('Harga dan stok minimum tidak boleh negatif (baris '+line+').');
  list.push({code,barcode:get('kode barcode','barcode'),name,category:get('jenis','kategori'),brand:get('merek','brand'),stock,unit:get('satuan')||'pcs',buyPrice,sellPrice,minStock,shelf:get('rak'),supplier:get('supplier')});
 }
 if(!list.length)throw new Error('Tidak ada produk valid untuk diproses.');
 return {list,skipped};
}

export default function App(){
 const [theme,setTheme]=useState<'light'|'dark'>(()=>{try{return localStorage.getItem('naufal-farma:theme')==='dark'?'dark':'light'}catch{return 'light'}}),[tab,setTab]=useState<Tab>('Dashboard'),[reportFrom,setReportFrom]=useState(''),[reportTo,setReportTo]=useState(''),[pdfBusy,setPdfBusy]=useState(false),[openMenu,setOpenMenu]=useState<'Produk'|'Persediaan'|null>(null),[products,setProducts]=useState<Product[]>([]),[sales,setSales]=useState<Sale[]>([]),[moves,setMoves]=useState<Movement[]>([]),[query,setQuery]=useState(''),[cart,setCart]=useState<{p:Product,qty:number}[]>([]),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[scan,setScan]=useState(false),[stockDialog,setStockDialog]=useState<'MASUK'|'KELUAR'|null>(null),[stockQty,setStockQty]=useState(''),[syncing,setSyncing]=useState(false),[syncState,setSyncState]=useState<'online'|'offline'|'syncing'|'error'>('offline'),[lastSync,setLastSync]=useState(()=>{try{return localStorage.getItem('naufal-farma:last-csv-sync')||''}catch{return ''}}); const syncLock=useRef(false); const scannerRef=useRef<Html5Qrcode|null>(null),scanTimerRef=useRef<number|undefined>(undefined);
 useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;const meta=document.querySelector('meta[name="theme-color"]');meta?.setAttribute('content',theme==='dark'?'#071321':'#071b3b');try{localStorage.setItem('naufal-farma:theme',theme)}catch{}},[theme]);
 async function refresh(){setProducts(await db.products.toArray());setSales(await db.sales.toArray());setMoves(await db.movements.toArray())}

 async function syncCloudCSV(showFeedback=false){
  if(syncLock.current)return;
  if(!navigator.onLine){setSyncState('offline');return}
  syncLock.current=true;setSyncing(true);setSyncState('syncing');
  try{
   let raw='';
   const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),20000);
   try{
    const url='https://raw.githubusercontent.com/WRyouAldi/pos-apotek-naufal-farma/main/public/data/xReport2.csv?sync='+Date.now();
    const response=await fetch(url,{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error('GitHub raw merespons '+response.status);
    raw=await response.text();
   }catch(rawError){
    const response=await fetch('https://api.github.com/repos/WRyouAldi/pos-apotek-naufal-farma/contents/public/data/xReport2.csv?ref=main',{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
    if(!response.ok)throw new Error('GitHub tidak dapat diakses ('+response.status+'). '+(rawError instanceof Error?rawError.message:''));
    const payload=await response.json() as {content?:string;encoding?:string};
    if(!payload.content||payload.encoding!=='base64')throw new Error('Isi CSV GitHub tidak dapat dibaca.');
    const binary=atob(payload.content.replace(/\s/g,''));
    raw=new TextDecoder().decode(Uint8Array.from(binary,ch=>ch.charCodeAt(0)));
   }finally{window.clearTimeout(timeout)}
   const parsed=parseMasterCSV(raw);
   const {list:incoming,skipped}=productsFromCSV(parsed);
   if(incoming.length<100)throw new Error('CSV GitHub tidak lengkap: hanya '+incoming.length+' produk valid. Data lokal tidak diubah.');
   const existing=await db.products.toArray(),byCode=new Map(existing.map(p=>[p.code,p]));
   await db.transaction('rw',db.products,async()=>{
    for(const item of incoming){
     const old=byCode.get(item.code);
     if(old&&old.id)await db.products.update(old.id,{...item,stock:old.stock,barcode:item.barcode||old.barcode});
     else await db.products.add(item);
    }
   });
   await refresh();const syncedAt=new Date().toISOString();setLastSync(syncedAt);try{localStorage.setItem('naufal-farma:last-csv-sync',syncedAt)}catch{}setSyncState('online');
   if(showFeedback)setNotice('Sinkronisasi GitHub berhasil: '+incoming.length+' produk diperiksa.'+(parsed.repaired?' · '+parsed.repaired+' baris CSV dirapikan.':'')+(skipped?' · '+skipped+' baris non-produk dilewati.':''));
  }catch(e){
   setSyncState(navigator.onLine?'error':'offline');
   if(showFeedback)setNotice('Sync GitHub gagal. Data lokal tetap digunakan: '+(e instanceof Error?e.message:String(e)));
  }finally{syncLock.current=false;setSyncing(false)}
 }
 useEffect(()=>{
  void (async()=>{await refresh();await syncCloudCSV()})();
  const online=()=>void syncCloudCSV();
  const visible=()=>{if(document.visibilityState==='visible')void syncCloudCSV()};
  const timer=window.setInterval(()=>void syncCloudCSV(),15*60*1000);
  window.addEventListener('online',online);document.addEventListener('visibilitychange',visible);
  return()=>{window.clearInterval(timer);window.removeEventListener('online',online);document.removeEventListener('visibilitychange',visible)};
 },[]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3200);return()=>clearTimeout(t)},[notice]);
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpenMenu(null);if(scan)void stopScan();if(stockDialog)setStockDialog(null)}};const onPointer=(e:PointerEvent)=>{if(!(e.target as HTMLElement)?.closest('.nav-item'))setOpenMenu(null)};document.addEventListener('keydown',onKey);document.addEventListener('pointerdown',onPointer);return()=>{document.removeEventListener('keydown',onKey);document.removeEventListener('pointerdown',onPointer)}},[scan,stockDialog]);
 const filtered=useMemo(()=>products.filter(p=>[p.name,p.code,p.barcode].some(v=>(v||'').toLowerCase().includes(query.trim().toLowerCase()))),[products,query]);
 const today=localDate(),todaySales=sales.filter(s=>localDate(new Date(s.createdAt))===today),revenue=todaySales.reduce((a,s)=>a+s.total,0),profit=todaySales.reduce((a,s)=>a+s.items.reduce((b,i)=>b+(i.price-i.cost)*i.qty,0),0);
 function add(p:Product){
  if(p.stock<1){setNotice('Stok '+p.name+' sedang kosong.');return}
  setCart(c=>{const old=c.find(x=>x.p.code===p.code);if(old&&old.qty>=p.stock){setNotice('Jumlah '+p.name+' sudah mencapai stok tersedia.');return c}return old?c.map(x=>x.p.code===p.code?{...x,qty:x.qty+1}:x):[...c,{p,qty:1}]})
 }
 async function checkout(){
  if(!cart.length||busy)return;setBusy(true);
  try{
   const lines=cart.map(x=>({code:x.p.code,qty:x.qty}));
   if(lines.some(x=>!Number.isSafeInteger(x.qty)||x.qty<1))throw new Error('Jumlah harus bilangan bulat positif.');
   await db.transaction('rw',db.products,db.sales,db.movements,async()=>{
    const fresh:{p:Product;qty:number}[]=[];
    for(const line of lines){
     const p=await db.products.where('code').equals(line.code).first();
     if(!p)throw new Error('Produk tidak ditemukan: '+line.code);
     if(!Number.isFinite(p.stock)||line.qty>p.stock)throw new Error('Stok tidak cukup untuk '+p.name+'. Tersedia: '+p.stock);
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
   });
   setCart([]);await refresh();setNotice('Transaksi berhasil disimpan.');
  }catch(e){setNotice('Transaksi dibatalkan: '+(e instanceof Error?e.message:String(e)));await refresh()}
  finally{setBusy(false)}
 }
 async function moveStock(type:'MASUK'|'KELUAR'){
  if(busy)return;
  const p=products.find(x=>x.code===query.trim()||x.barcode===query.trim());
  if(!p){setNotice('Pilih produk dengan kode atau barcode yang tepat.');return}
  const qty=Number(stockQty.trim());
  if(!Number.isSafeInteger(qty)||qty<1){setNotice('Jumlah harus bilangan bulat positif.');return}
  setBusy(true);
  try{
   await db.transaction('rw',db.products,db.movements,async()=>{
    const fresh=await db.products.where('code').equals(p.code).first();
    if(!fresh?.id)throw new Error('Produk tidak ditemukan.');
    if(type==='KELUAR'&&qty>fresh.stock)throw new Error('Stok tidak cukup. Tersedia: '+fresh.stock);
    const next=fresh.stock+(type==='MASUK'?qty:-qty);
    if(!Number.isSafeInteger(next))throw new Error('Perubahan stok tidak valid.');
    await db.products.update(fresh.id,{stock:next});
    await db.movements.add({createdAt:new Date().toISOString(),type,code:fresh.code,name:fresh.name,qty:type==='MASUK'?qty:-qty,unitCost:fresh.buyPrice,note:type==='MASUK'?'Penerimaan':'Pengeluaran'});
   });
   await refresh();setNotice('Mutasi stok tersimpan.');
  }catch(e){setNotice('Mutasi dibatalkan: '+(e instanceof Error?e.message:String(e)))}
  finally{setBusy(false);setStockDialog(null);setStockQty('')}
 }
 async function importCSV(file:File){
  if(busy)return;
  setBusy(true);
  try{
   const raw=await file.text();
   const parsed=parseMasterCSV(raw);
   const {list,skipped}=productsFromCSV(parsed);
   if(list.length<1)throw new Error('Tidak ada produk valid untuk diimpor.');
   const existing=await db.products.toArray(),byCode=new Map(existing.map(p=>[p.code,p]));
   await db.transaction('rw',db.products,async()=>{
    for(const p of list){
     const old=byCode.get(p.code);
     if(old?.id)await db.products.update(old.id,{...p,stock:old.stock,barcode:p.barcode||old.barcode});
     else await db.products.add(p);
    }
   });
   await refresh();setNotice('Impor berhasil: '+list.length+' produk; stok lokal dipertahankan.'+(skipped?' · '+skipped+' baris kosong/non-produk dilewati.':'')+(parsed.repaired?' · '+parsed.repaired+' baris CSV tergabung diperbaiki.':''));
  }catch(e){setNotice('Impor CSV dibatalkan: '+(e instanceof Error?e.message:String(e)))}
  finally{setBusy(false)}
 }
 async function stopScan(){if(scanTimerRef.current!==undefined)window.clearTimeout(scanTimerRef.current);scanTimerRef.current=undefined;const q=scannerRef.current;scannerRef.current=null;if(q){try{if(q.isScanning)await q.stop();q.clear()}catch{}}setScan(false)}
 async function startScan(showReadNotice=true){
  if(scan||scanTimerRef.current!==undefined)return;
  setScan(true);
  scanTimerRef.current=window.setTimeout(async()=>{
   scanTimerRef.current=undefined;
   const reader=document.getElementById('barcode-reader');
   if(!reader){setScan(false);setNotice('Area pemindai belum siap. Coba buka kembali.');return}
   let q:Html5Qrcode|null=null;
   try{
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('Akses kamera memerlukan koneksi aplikasi yang aman. Perbarui aplikasi dan coba lagi.');
    const cameras=await Html5Qrcode.getCameras();
    if(!cameras.length)throw new Error('Kamera tidak ditemukan pada perangkat ini.');
    const camera=cameras.find(c=>/back|rear|environment|belakang/i.test(c.label))||cameras[cameras.length-1];
    q=new Html5Qrcode('barcode-reader',{verbose:false});
    scannerRef.current=q;
    const boxWidth=Math.max(180,Math.min(280,reader.clientWidth-32));
    await q.start(camera.id,{fps:12,qrbox:{width:boxWidth,height:Math.round(boxWidth*.48)},aspectRatio:16/9},async value=>{
     if(scannerRef.current!==q)return;
     setQuery(value.trim());
     if(showReadNotice)setNotice('Barcode berhasil dibaca: '+value.trim());
     await stopScan();
    },()=>{});
    if(scannerRef.current!==q&&q.isScanning)await q.stop();
   }catch(error){
    if(scannerRef.current===q)scannerRef.current=null;
    if(q){try{if(q.isScanning)await q.stop();q.clear()}catch{}}
    const message=error instanceof Error?error.message:String(error),lower=message.toLowerCase();
    setNotice(lower.includes('permission')||lower.includes('notallowed')||lower.includes('denied')
     ?'Izin kamera ditolak. Izinkan akses Kamera untuk aplikasi POS Apotek di pengaturan Android.'
     :lower.includes('secure')?'Akses kamera tidak tersedia pada konteks aplikasi ini. Perbarui aplikasi Android.'
     :'Pemindai gagal dibuka: '+message);
    setScan(false);
   }
  },350);
 }
 useEffect(()=>()=>{if(scanTimerRef.current!==undefined)window.clearTimeout(scanTimerRef.current);const q=scannerRef.current;if(q?.isScanning)void q.stop()},[]);
 async function backupAll(){
  try{setBusy(true);const payload={format:'naufal-farma-pos-backup',version:1,createdAt:new Date().toISOString(),data:{products:await db.products.toArray(),sales:await db.sales.toArray(),movements:await db.movements.toArray()}};
   const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='backup-naufal-farma-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);setNotice('Backup lengkap berhasil dibuat. Simpan file di tempat aman.');
  }catch(e){setNotice('Backup gagal: '+String(e))}finally{setBusy(false)}
 }
 async function restoreAll(file:File){
  if(busy)return;
  if(!window.confirm('Pemulihan akan MENGGANTI seluruh produk, transaksi, dan mutasi lokal. Buat backup terbaru terlebih dahulu. Lanjutkan?'))return;
  setBusy(true);
  try{
   const raw=JSON.parse(await file.text());
   if(raw?.format!=='naufal-farma-pos-backup'||raw?.version!==1||!Array.isArray(raw?.data?.products)||!Array.isArray(raw?.data?.sales)||!Array.isArray(raw?.data?.movements))throw new Error('Format backup tidak dikenali atau tidak didukung.');
   const ps:Product[]=raw.data.products.map((p:any)=>{if(typeof p.code!=='string'||!p.code.trim()||typeof p.name!=='string'||!p.name.trim())throw new Error('Data produk tidak valid.');for(const k of ['stock','buyPrice','sellPrice','minStock'])if(!Number.isFinite(p[k]))throw new Error('Angka produk tidak valid: '+p.code);return{...p,code:p.code.trim(),name:p.name.trim()}});
   const ss:Sale[]=raw.data.sales.map((v:any)=>{if(typeof v.createdAt!=='string'||!Number.isFinite(v.total)||!Array.isArray(v.items))throw new Error('Data transaksi tidak valid.');for(const it of v.items)if(typeof it.code!=='string'||!Number.isSafeInteger(it.qty)||it.qty<1||!Number.isFinite(it.price)||!Number.isFinite(it.cost))throw new Error('Rincian transaksi tidak valid.');return v});
   const ms:Movement[]=raw.data.movements.map((v:any)=>{if(typeof v.createdAt!=='string'||!['MASUK','KELUAR','PENJUALAN'].includes(v.type)||typeof v.code!=='string'||!Number.isSafeInteger(v.qty)||!Number.isFinite(v.unitCost))throw new Error('Data mutasi tidak valid.');return v});
   const codes=new Set<string>();for(const p of ps){if(codes.has(p.code))throw new Error('Kode produk duplikat: '+p.code);codes.add(p.code)}
   await db.transaction('rw',db.products,db.sales,db.movements,async()=>{await db.products.clear();await db.sales.clear();await db.movements.clear();await db.products.bulkAdd(ps);await db.sales.bulkAdd(ss);await db.movements.bulkAdd(ms)});
   await refresh();setCart([]);setNotice('Pemulihan selesai: '+ps.length+' produk, '+ss.length+' transaksi, '+ms.length+' mutasi.');
  }catch(e){setNotice('Pemulihan dibatalkan: '+(e instanceof Error?e.message:String(e)))}
  finally{setBusy(false)}
 }
 const pdfDate=(value:string)=>new Date(value).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'});
 async function savePDF(doc:jsPDF,filename:string){
  const blob=doc.output('blob');
  if(blob.size<100||blob.type!=='application/pdf')throw new Error('Dokumen PDF kosong atau tidak valid.');
  const bytes=new Uint8Array(await blob.arrayBuffer());
  if(String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-')throw new Error('Format file PDF tidak valid.');
  if(Capacitor.isNativePlatform()){
   let binary='';
   for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
   const file=await Filesystem.writeFile({path:filename,data:btoa(binary),directory:Directory.Cache,recursive:true});
   try{
    await Share.share({title:'PDF Apotek Naufal Farma',text:'Pilih Files atau Simpan ke perangkat untuk menyimpan PDF, atau pilih aplikasi lain untuk membagikannya.',url:file.uri,dialogTitle:'Simpan atau bagikan PDF'});
    setNotice('PDF sudah dibuat. Periksa aplikasi tujuan untuk memastikan file tersimpan atau terkirim.');
   }catch{
    setNotice('PDF berhasil dibuat sementara, tetapi menu berbagi gagal dibuka. Coba lagi atau periksa izin aplikasi.');
    return;
   }
   return;
  }
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;a.style.display='none';document.body.appendChild(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),10000);
  setNotice('PDF sudah disiapkan. Periksa folder Unduhan pada perangkat.');
 }
 async function downloadReceiptPDF(sale:Sale){
  setPdfBusy(true);
  try{
   const doc=new jsPDF({unit:'mm',format:[80,180]});
   const pageW=80,margin=5;let y=9;
   doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('APOTEK NAUFAL FARMA',pageW/2,y,{align:'center'});y+=6;
   doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('STRUK PENJUALAN',pageW/2,y,{align:'center'});y+=6;
   doc.setFontSize(7);doc.text('No: '+(sale.id??'-'),margin,y);y+=4;doc.text(pdfDate(sale.createdAt),margin,y);y+=4;
   doc.line(margin,y,pageW-margin,y);y+=5;
   doc.setFont('helvetica','bold');doc.text('Produk',margin,y);doc.text('Total',pageW-margin,y,{align:'right'});y+=4;
   doc.setFont('helvetica','normal');
   for(const item of sale.items){
    const lines=doc.splitTextToSize(item.name, pageW-2*margin-2);
    doc.text(lines,margin,y);y+=lines.length*3.5;
    doc.text(item.qty+' x '+money(item.price),margin+2,y);doc.text(money(item.qty*item.price),pageW-margin,y,{align:'right'});y+=4;
    if(y>165){doc.addPage([80,180]);y=10}
   }
   doc.line(margin,y,pageW-margin,y);y+=6;
   doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('TOTAL',margin,y);doc.text(money(sale.total),pageW-margin,y,{align:'right'});y+=8;
   doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('Terima kasih telah berbelanja',pageW/2,y,{align:'center'});y+=4;doc.text('Semoga lekas sehat kembali.',pageW/2,y,{align:'center'});
   await savePDF(doc,'struk-naufal-farma-'+(sale.id??Date.now())+'.pdf');
  }catch(e){setNotice('PDF struk gagal dibuat: '+String(e))}finally{setPdfBusy(false)}
 }
 async function downloadReportPDF(list:Sale[]){
  if(reportFrom&&reportTo&&reportFrom>reportTo){setNotice('Tanggal awal tidak boleh melewati tanggal akhir.');return}if(!list.length){setNotice('Tidak ada transaksi pada rentang tanggal ini.');return}
  setPdfBusy(true);
  try{
   const doc=new jsPDF({unit:'mm',format:'a4'}),left=14,right=196;let y=16;
   const from=reportFrom||'Awal',to=reportTo||'Hari ini';
   doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text('APOTEK NAUFAL FARMA',left,y);y+=7;
   doc.setFontSize(11);doc.text('LAPORAN PENJUALAN',left,y);y+=6;
   doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('Periode: '+from+' s.d. '+to,left,y);y+=8;
   const total=list.reduce((a,v)=>a+v.total,0),profitTotal=list.reduce((a,v)=>a+v.items.reduce((b,i)=>b+(i.price-i.cost)*i.qty,0),0);
   doc.setFont('helvetica','bold');doc.text('Jumlah transaksi: '+list.length,left,y);y+=5;doc.text('Omzet: '+money(total),left,y);y+=5;doc.text('Estimasi laba: '+money(profitTotal),left,y);y+=8;
   const drawHead=()=>{doc.setFillColor(232,241,250);doc.rect(left,y,182,8,'F');doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('Waktu',left+2,y+5);doc.text('Rincian',left+38,y+5);doc.text('Total',right-2,y+5,{align:'right'});y+=11};
   drawHead();doc.setFont('helvetica','normal');
   for(const sale of list){
    const details=doc.splitTextToSize(sale.items.map(i=>i.name+' x'+i.qty).join(', '),112);
    const rowH=Math.max(7,details.length*4);
    if(y+rowH>280){doc.addPage();y=16;drawHead();doc.setFont('helvetica','normal')}
    doc.setFontSize(7.5);doc.text(pdfDate(sale.createdAt),left+2,y);doc.text(details,left+38,y);doc.text(money(sale.total),right-2,y,{align:'right'});y+=rowH+2;doc.setDrawColor(225,232,240);doc.line(left,y-1,right,y-1);
   }
   await savePDF(doc,'laporan-penjualan-naufal-farma-'+(reportFrom||'semua')+'-'+(reportTo||'terkini')+'.pdf');
  }catch(e){setNotice('PDF laporan gagal dibuat: '+String(e))}finally{setPdfBusy(false)}
 }
 async function downloadStockOutPDF(list:Movement[]){
  if(reportFrom&&reportTo&&reportFrom>reportTo){setNotice('Tanggal awal tidak boleh melewati tanggal akhir.');return}
  if(!list.length){setNotice('Tidak ada barang keluar pada rentang tanggal ini.');return}
  setPdfBusy(true);
  try{
   const doc=new jsPDF({unit:'mm',format:'a4'}),left=14,right=196;let y=16;
   const totalQty=list.reduce((a,m)=>a+Math.abs(m.qty),0),grandTotal=list.reduce((a,m)=>a+Math.abs(m.qty)*m.unitCost,0);
   doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text('APOTEK NAUFAL FARMA',left,y);y+=7;
   doc.setFontSize(11);doc.text('LAPORAN BARANG KELUAR',left,y);y+=6;
   doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('Periode: '+(reportFrom||'Awal')+' s.d. '+(reportTo||'Hari ini'),left,y);y+=8;
   doc.setFont('helvetica','bold');doc.text('Jumlah catatan: '+list.length,left,y);y+=5;doc.text('Total qty: '+totalQty,left,y);y+=5;doc.text('Total nilai harga beli: '+money(grandTotal),left,y);y+=8;
   const drawHead=()=>{doc.setFillColor(226,240,232);doc.rect(left,y,182,8,'F');doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('Nama barang',left+2,y+5);doc.text('Qty',left+116,y+5,{align:'right'});doc.text('Harga beli',right-38,y+5,{align:'right'});doc.text('Total',right-2,y+5,{align:'right'});y+=11};
   drawHead();doc.setFont('helvetica','normal');
   for(const m of list){
    const nameLines=doc.splitTextToSize(m.name,94),rowH=Math.max(7,nameLines.length*4);
    if(y+rowH>280){doc.addPage();y=16;drawHead();doc.setFont('helvetica','normal')}
    const qty=Math.abs(m.qty),lineTotal=qty*m.unitCost;
    doc.setFontSize(7.5);doc.text(nameLines,left+2,y);doc.text(String(qty),left+116,y,{align:'right'});doc.text(money(m.unitCost),right-38,y,{align:'right'});doc.text(money(lineTotal),right-2,y,{align:'right'});y+=rowH+2;
    doc.setDrawColor(220,230,223);doc.line(left,y-1,right,y-1);
   }
   if(y+10>280){doc.addPage();y=16}
   doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('TOTAL KESELURUHAN',left,y+5);doc.text(money(grandTotal),right-2,y+5,{align:'right'});
   await savePDF(doc,'laporan-barang-keluar-'+(reportFrom||'semua')+'-'+(reportTo||'terkini')+'.pdf');
  }catch(e){setNotice('PDF barang keluar gagal dibuat: '+String(e))}finally{setPdfBusy(false)}
 }
 const exportCSV=()=>{const csv=Papa.unparse(products.map(p=>({'Kode Item':p.code,'Kode Barcode':p.barcode,'Nama Item':p.name,'Jenis':p.category,'Merek':p.brand,'Stok':p.stock,'Satuan':p.unit,'Harga Beli':p.buyPrice,'Harga Jual':p.sellPrice,'Stok Min':p.minStock,'Rak':p.shelf,'Supplier':p.supplier})));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='backup-produk.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)};
 return <div className="app"><nav className="topbar" aria-label="Navigasi utama">
 <div className="brand"><span className="brandmark">N</span><div><b>NAUFAL FARMA</b><small>POINT OF SALE</small></div></div>
 <span className="top-status"><span className="dot"/>{syncState==='syncing'?'Sync…':syncState==='online'?'Cloud aktif':syncState==='error'?'Sync gagal':'Offline lokal'}</span>
</nav>
 <div className="nav-menu" aria-label="Navigasi utama">
  <button className={'nav '+(tab==='Dashboard'?'active':'')} onClick={()=>{setTab('Dashboard');setQuery('');setOpenMenu(null)}}><Home/><span>Dashboard</span></button>
  <button className={'nav '+(tab==='Kasir'?'active':'')} onClick={()=>{setTab('Kasir');setQuery('');setOpenMenu(null)}}><ShoppingCart/><span>Kasir</span></button>
  <div className="nav-item">
   <button className={'nav '+((tab==='Barang'||tab==='Cek Harga')?'active':'')} aria-haspopup="true" aria-expanded={openMenu==='Produk'} onClick={()=>setOpenMenu(openMenu==='Produk'?null:'Produk')}><Package/><span>Produk</span><ChevronDown className="chevron"/></button>
   {openMenu==='Produk'&&<div className="nav-submenu" role="group" aria-label="Menu Produk">
    <button className={tab==='Barang'?'selected':''} onClick={()=>{setTab('Barang');setQuery('');setOpenMenu(null)}}><Boxes size={16}/> Master Barang</button>
    <button className={tab==='Cek Harga'?'selected':''} onClick={()=>{setTab('Cek Harga');setQuery('');setOpenMenu(null)}}><Search size={16}/> Cek Harga</button>
   </div>}
  </div>
  <div className="nav-item">
   <button className={'nav '+((tab==='Barang Masuk'||tab==='Barang Keluar')?'active':'')} aria-haspopup="true" aria-expanded={openMenu==='Persediaan'} onClick={()=>setOpenMenu(openMenu==='Persediaan'?null:'Persediaan')}><Boxes/><span>Persediaan</span><ChevronDown className="chevron"/></button>
   {openMenu==='Persediaan'&&<div className="nav-submenu" role="group" aria-label="Menu Persediaan">
    <button className={tab==='Barang Masuk'?'selected':''} onClick={()=>{setTab('Barang Masuk');setQuery('');setOpenMenu(null)}}><ArrowDownToLine size={16}/> Barang Masuk</button>
    <button className={tab==='Barang Keluar'?'selected':''} onClick={()=>{setTab('Barang Keluar');setQuery('');setOpenMenu(null)}}><ArrowUpFromLine size={16}/> Barang Keluar</button>
   </div>}
  </div>
  <button className={'nav '+(tab==='Laporan'?'active':'')} onClick={()=>{setTab('Laporan');setQuery('');setOpenMenu(null)}}><BarChart3/><span>Laporan</span></button>
  <button className={'nav '+(tab==='Pengaturan'?'active':'')} onClick={()=>{setTab('Pengaturan');setQuery('');setOpenMenu(null)}}><Settings/><span>Pengaturan</span></button>
 </div>
 <main className="main"><header><div><span className="eyebrow">APOTEK NAUFAL FARMA</span><h1>{tab}</h1></div><span className="online">{syncState==='online'?<Cloud size={15}/>:<WifiOff size={15}/>} {syncState==='syncing'?'Sinkronisasi…':syncState==='online'?'Cloud tersinkron':syncState==='error'?'Sync gagal · data lokal':'Mode offline'}</span></header>{notice&&<div className="toast">{notice}</div>}
 {tab==='Dashboard'&&<><section className="welcome"><div><span className="eyebrow"><Sparkles size={13}/> RINGKASAN</span><h2>Apotek dalam<br/>satu sentuhan.</h2><div className="welcome-badges"><span><ShieldCheck size={13}/> Lokal</span><span><Activity size={13}/> Aktif</span></div></div><div className="welcome-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-capsule"><Pill size={48}/></div><span className="art-spark spark-one">✦</span><span className="art-spark spark-two">✧</span></div></section><div className="stats">{[['Produk',products.length,PackageCheck],['Omzet',money(revenue),TrendingUp],['Laba',money(profit),Activity],['Stok tipis',products.filter(p=>p.stock<=p.minStock).length,AlertTriangle]].map(([a,b,Icon]:any,i)=><div className="stat" key={String(a)}><div className="stat-top"><span>{a}</span><i className={"stat-icon stat-icon-"+i}><Icon size={18}/></i></div><strong>{b}</strong></div>)}</div><section className="panel"><div className="panel-head"><h3><AlertTriangle size={17}/> Stok perlu dicek</h3><span className="section-count">{products.filter(p=>p.stock<=p.minStock).length}</span></div>{products.filter(p=>p.stock<=p.minStock).slice(0,12).map(p=><p className="row" key={p.code}>{p.name} <b>{p.stock} {p.unit}</b></p>)}</section></>}
 {tab==='Kasir'&&<div className="grid-two"><section className="panel"><div className="panel-head"><h3><ShoppingBag size={17}/> Produk</h3><UiButton className="soft-btn" aria-label="Scan barcode" onClick={()=>void startScan()}><ScanLine size={17}/></UiButton></div><UiInput className="search" placeholder="Cari nama, kode, barcode..." value={query} onChange={e=>setQuery(e.target.value)}/>{filtered.slice(0,40).map(p=><button className="product-pick" key={p.code} disabled={p.stock<1} onClick={()=>add(p)}><span>{p.name}<small>{p.code} · Stok {p.stock}</small></span><b>{money(p.sellPrice)}</b></button>)}{!filtered.length&&<p className="empty-state">Produk tidak ditemukan.</p>}{filtered.length>40&&<p className="empty-state">Menampilkan 40 produk pertama. Persempit pencarian untuk hasil lainnya.</p>}</section><section className="panel"><h3><ShoppingCart size={17}/> Keranjang <span className="section-count">{cart.length}</span></h3>{!cart.length&&<p className="empty-state">Keranjang masih kosong. Pilih produk untuk memulai transaksi.</p>}{cart.map(x=><div className="cart-row" key={x.p.code}><div className="cart-info"><b>{x.p.name}</b><small>{money(x.p.sellPrice)} / {x.p.unit}</small></div><div className="qty-control"><button aria-label={'Kurangi '+x.p.name} onClick={()=>setCart(c=>c.map(y=>y.p.code===x.p.code?{...y,qty:Math.max(0,y.qty-1)}:y).filter(y=>y.qty>0))}>−</button><b>{x.qty}</b><button aria-label={'Tambah '+x.p.name} onClick={()=>add(x.p)}>+</button></div><strong>{money(x.qty*x.p.sellPrice)}</strong></div>)}<h2>{money(cart.reduce((a,x)=>a+x.qty*x.p.sellPrice,0))}</h2><button className="primary full checkout-btn" disabled={!cart.length||busy} onClick={()=>void checkout()}><ShoppingCart size={17}/>{busy?'Memproses…':'Bayar sekarang'}</button></section></div>}
 {(tab==='Cek Harga'||tab==='Barang')&&<section className="panel"><div className="panel-head"><h3>{tab==='Barang'?'Master barang':'Pencarian harga produk'}</h3><div className="panel-actions">{tab==='Barang'&&<label className="soft-btn upload"><Upload size={16}/> Impor CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.currentTarget.value='';if(file)void importCSV(file)}}/></label>}</div></div><div className="search-with-scan"><UiInput className="search" placeholder="Cari nama, kode, atau barcode..." value={query} onChange={e=>setQuery(e.target.value)}/><UiButton className="soft-btn scan-search-btn" aria-label="Buka pemindai barcode" onClick={()=>void startScan(tab!=="Cek Harga")}><Camera size={18}/></UiButton></div><div className="table-wrap"><table><thead><tr><th>Nama</th><th>Kode</th><th>Barcode</th><th>Stok</th><th>Harga beli</th><th>Harga jual</th></tr></thead><tbody>{filtered.slice(0,60).map(p=><tr key={p.code}><td>{p.name}</td><td>{p.code}</td><td>{p.barcode||'—'}</td><td>{p.stock} {p.unit}</td><td>{money(p.buyPrice)}</td><td>{money(p.sellPrice)}</td></tr>)}{!filtered.length&&<tr><td colSpan={6} className="empty-state">Produk tidak ditemukan.</td></tr>}</tbody></table></div>{filtered.length>60&&<p className="empty-state">Menampilkan 60 produk pertama. Gunakan pencarian untuk mempersempit hasil.</p>}</section>}
 {(tab==='Barang Masuk'||tab==='Barang Keluar')&&<section className="panel"><h3>{tab}</h3><div className="search-with-scan"><UiInput className="search" placeholder="Kode item atau barcode" value={query} onChange={e=>setQuery(e.target.value)}/><UiButton className="soft-btn scan-search-btn" aria-label="Scan barcode produk" onClick={()=>void startScan()}><Camera size={18}/></UiButton></div><p>{products.find(p=>p.code===query||p.barcode===query)?.name||'Masukkan kode produk yang tepat.'}</p><button type="button" className="primary" disabled={!products.some(p=>p.code===query.trim()||p.barcode===query.trim())||busy} onClick={()=>{setStockQty('');setStockDialog(tab==='Barang Masuk'?'MASUK':'KELUAR')}}>Catat mutasi</button><h3>Riwayat mutasi</h3>{moves.filter(m=>m.type===(tab==='Barang Masuk'?'MASUK':'KELUAR')).slice(-30).reverse().map((m,i)=><p className="row" key={i}>{m.createdAt.slice(0,16)} · {m.name} · {m.qty}</p>)}</section>}
 {tab==='Laporan'&&(()=>{const inPeriod=(date:string)=>(!reportFrom||localDate(new Date(date))>=reportFrom)&&(!reportTo||localDate(new Date(date))<=reportTo);const reportSales=sales.filter(s=>inPeriod(s.createdAt)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));const outgoing=moves.filter(m=>m.type==='KELUAR'&&inPeriod(m.createdAt)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));const total=reportSales.reduce((a,s)=>a+s.total,0),outQty=outgoing.reduce((a,m)=>a+Math.abs(m.qty),0),outValue=outgoing.reduce((a,m)=>a+Math.abs(m.qty)*m.unitCost,0);return <><section className="panel"><div className="panel-head"><h3>Riwayat penjualan</h3><b>Omzet: {money(total)}</b></div><div className="report-tools"><label>Dari tanggal<input type="date" value={reportFrom} onChange={e=>setReportFrom(e.target.value)}/></label><label>Sampai tanggal<input type="date" value={reportTo} onChange={e=>setReportTo(e.target.value)}/></label><button className="primary" disabled={pdfBusy||!reportSales.length} onClick={()=>void downloadReportPDF(reportSales)}><Download size={16}/> {pdfBusy?'Membuat PDF…':'Unduh laporan PDF'}</button></div><p className="report-summary">{reportSales.length} transaksi · Omzet {money(total)} · Estimasi laba {money(reportSales.reduce((a,s)=>a+s.items.reduce((b,i)=>b+(i.price-i.cost)*i.qty,0),0))}</p>{reportSales.map((sale,i)=><div className="report-row" key={sale.id??sale.createdAt+i}><div><b>{pdfDate(sale.createdAt)}</b><small>{sale.items.map(x=>x.name+' ×'+x.qty).join(', ')}</small><strong>{money(sale.total)}</strong></div><button className="soft-btn" disabled={pdfBusy} onClick={()=>void downloadReceiptPDF(sale)}><Download size={15}/> Struk PDF</button></div>)}</section><section className="panel"><div className="panel-head"><h3>Laporan barang keluar</h3><b>Total: {money(outValue)}</b></div><p className="report-summary">{outgoing.length} catatan · Total qty {outQty} · Total nilai harga beli {money(outValue)}</p><div className="report-tools"><button className="primary" disabled={pdfBusy||!outgoing.length} onClick={()=>void downloadStockOutPDF(outgoing)}><Download size={16}/> {pdfBusy?'Membuat PDF…':'Unduh laporan barang keluar'}</button></div><div className="table-wrap"><table><thead><tr><th>Nama barang</th><th>Qty</th><th>Harga beli</th><th>Total</th></tr></thead><tbody>{outgoing.map((m,i)=><tr key={m.id??m.createdAt+m.code+i}><td><b>{m.name}</b><small className="table-subtext">{pdfDate(m.createdAt)}</small></td><td>{Math.abs(m.qty)}</td><td>{money(m.unitCost)}</td><td><b>{money(Math.abs(m.qty)*m.unitCost)}</b></td></tr>)}{!outgoing.length&&<tr><td colSpan={4} className="empty-state">Belum ada barang keluar pada periode ini.</td></tr>}</tbody><tfoot><tr><th colSpan={3}>TOTAL KESELURUHAN</th><th>{money(outValue)}</th></tr></tfoot></table></div></section></>})()}
 {tab==='Pengaturan'&&<div className="settings-layout">
  <section className="panel settings-panel">
   <div className="settings-heading"><span className="settings-icon"><Sun size={20}/></span><div><h3>Tampilan aplikasi</h3><p>Pilih tema yang nyaman digunakan. Pengaturan tersimpan otomatis di perangkat ini.</p></div></div>
   <div className="theme-picker" role="group" aria-label="Pilih tema tampilan">
    <button type="button" className={'theme-option '+(theme==='light'?'selected':'')} aria-pressed={theme==='light'} onClick={()=>setTheme('light')}><span className="theme-option-icon"><Sun size={20}/></span><span className="theme-option-copy"><b>Light mode</b><small>Pearl · Crystal Liquid</small></span>{theme==='light'&&<ShieldCheck className="theme-check" size={19}/>}</button>
    <button type="button" className={'theme-option '+(theme==='dark'?'selected':'')} aria-pressed={theme==='dark'} onClick={()=>setTheme('dark')}><span className="theme-option-icon"><Moon size={20}/></span><span className="theme-option-copy"><b>Dark mode</b><small>Graphite · nyaman malam hari</small></span>{theme==='dark'&&<ShieldCheck className="theme-check" size={19}/>}</button>
   </div>
  </section>
  <section className="panel settings-panel">
   <div className="settings-heading"><span className="settings-icon"><Cloud size={20}/></span><div><h3>Sinkronisasi database GitHub</h3><p>Master produk tersinkron satu arah dari GitHub ke aplikasi.</p></div></div>
   <div className="sync-status-card"><span className="sync-status-icon"><Cloud size={24}/></span><div className="sync-status-copy"><b>{syncState==='syncing'?'Sedang mengambil CSV dari GitHub…':syncState==='online'?'Terhubung · master produk tersinkron':syncState==='error'?'Sinkronisasi gagal · data lokal tetap aman':'Offline · menggunakan data lokal'}</b><small>{lastSync?'Sinkron terakhir: '+new Date(lastSync).toLocaleString('id-ID'):'Belum ada sinkronisasi berhasil pada sesi ini.'}</small><p>Otomatis saat aplikasi dibuka, koneksi kembali aktif, dan setiap 15 menit. Tidak memerlukan token.</p></div></div>
   <button className="primary settings-primary" disabled={syncing||!navigator.onLine} onClick={()=>void syncCloudCSV(true)}><RefreshCw size={17}/> {syncing?'Menyinkronkan…':'Sinkronkan sekarang'}</button>
  </section>
  <section className="panel settings-panel">
   <div className="settings-heading"><span className="settings-icon"><ShieldCheck size={20}/></span><div><h3>Data lokal</h3><p>Cadangkan dan kelola data pada perangkat ini.</p></div></div>
   <div className="settings-actions">
    <button className="soft-btn" disabled={busy} onClick={()=>void backupAll()}><Download size={17}/> Backup lengkap (JSON)</button>
    <label className="soft-btn upload"><FileUp size={17}/> Pulihkan backup<input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void restoreAll(file);e.currentTarget.value=''}}/></label>
    <button className="soft-btn" disabled={busy} onClick={exportCSV}><Download size={17}/> Ekspor master produk CSV</button>
   </div>
   {busy&&<p className="settings-helper">Memproses data, jangan tutup aplikasi…</p>}
  </section>
 </div>}
 </main>{stockDialog&&<UiModal label={stockDialog==='MASUK'?'Barang masuk':'Barang keluar'} onClose={()=>setStockDialog(null)}><div className="stock-dialog"><h3>{stockDialog==='MASUK'?'Catat barang masuk':'Catat barang keluar'}</h3><p>{products.find(p=>p.code===query.trim()||p.barcode===query.trim())?.name}</p><UiInput autoFocus type="number" min="1" step="1" inputMode="numeric" placeholder="Jumlah unit" value={stockQty} onChange={e=>setStockQty(e.target.value)}/><UiButton variant="primary" className="full" disabled={busy||!Number.isSafeInteger(Number(stockQty))||Number(stockQty)<1} onClick={()=>void moveStock(stockDialog)}>Simpan mutasi</UiButton></div></UiModal>}{scan&&<UiModal label="Pemindai barcode" onClose={()=>void stopScan()}><div className="scan-card-content"><div id="barcode-reader"/><UiButton className="soft-btn full" onClick={()=>void stopScan()}>Tutup pemindai</UiButton></div></UiModal>}</div>
}
