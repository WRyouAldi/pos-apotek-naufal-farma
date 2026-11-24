import {useEffect,useMemo,useRef,useState} from 'react';
import Papa from 'papaparse';
import {jsPDF} from 'jspdf';
import {Capacitor} from '@capacitor/core';
import {App as CapacitorApp} from '@capacitor/app';
import {Directory,Filesystem} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {db,type Product,type Sale,type Movement} from './db';
import {buildInventoryMovementPDF} from './reports/inventory-pdf';
import {Activity,ArrowDownToLine,ArrowUpFromLine,BarChart3,Boxes,Camera,ChevronDown,Home,Package,Search,Settings,ShoppingCart,ShoppingBag,Upload,WifiOff,Download,FileUp,Sparkles,Pill,TrendingUp,AlertTriangle,PackageCheck,ScanLine,ClipboardList,ShieldCheck,Cloud,RefreshCw,Sun,Moon,Wallet,Plus,Pencil,Trash2} from 'lucide-react';
import {Html5Qrcode} from 'html5-qrcode';
import {UiButton,UiInput,UiModal} from './ui';
type Tab='Dashboard'|'Kasir'|'Cek Harga'|'Barang'|'Barang Masuk'|'Barang Keluar'|'Laporan'|'Pengaturan';
import {parseMasterCSV,productsFromCSV} from './app/shared/data/master-csv';
import {readProductOverrides,writeProductOverrides,readDeletedProductCodes,writeDeletedProductCodes} from './app/shared/data/product-sync-preferences';
import {localDate,money,num} from './app/shared/format/formatters';
import {recordSale} from './app/features/cashier/use-cases/record-sale';
import {recordInventoryMovement} from './app/features/inventory/use-cases/record-movement';
import {saveCatalogProduct,removeCatalogProduct,importCatalogProducts} from './app/features/catalog/use-cases/manage-catalog';
import {BarcodeScanner} from './app/features/scanner/infrastructure/barcode-scanner';
import {filterSalesByRange,filterMovementsByRange,summarizeInventoryMovements} from './app/features/reports/domain/report-selectors';
import {fetchMasterCatalogCSV,syncMasterCatalogCSV} from './app/features/synchronization/use-cases/sync-master-catalog';
export default function App(){
 const [theme,setTheme]=useState<'light'|'dark'>(()=>{try{return localStorage.getItem('naufal-farma:theme')==='dark'?'dark':'light'}catch{return 'light'}}),[tab,setTab]=useState<Tab>('Dashboard'),[reportFrom,setReportFrom]=useState(''),[reportTo,setReportTo]=useState(''),[pdfBusy,setPdfBusy]=useState(false),[openMenu,setOpenMenu]=useState<'Produk'|'Persediaan'|null>(null),[products,setProducts]=useState<Product[]>([]),[productDialog,setProductDialog]=useState(false),[editingProduct,setEditingProduct]=useState<Product|null>(null),[productForm,setProductForm]=useState({code:'',barcode:'',name:'',category:'',brand:'',stock:'0',unit:'pcs',buyPrice:'0',sellPrice:'0',minStock:'0',shelf:'',supplier:''}),[sales,setSales]=useState<Sale[]>([]),[moves,setMoves]=useState<Movement[]>([]),[query,setQuery]=useState(''),[cart,setCart]=useState<{p:Product,qty:number}[]>([]),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[scan,setScan]=useState(false),[stockDialog,setStockDialog]=useState<'MASUK'|'KELUAR'|null>(null),[stockQty,setStockQty]=useState(''),[syncing,setSyncing]=useState(false),[syncState,setSyncState]=useState<'online'|'offline'|'syncing'|'error'>('offline'),[lastSync,setLastSync]=useState(()=>{try{return localStorage.getItem('naufal-farma:last-csv-sync')||''}catch{return ''}}); const syncLock=useRef(false); const scannerRef=useRef<BarcodeScanner|null>(null),scanTimerRef=useRef<number|undefined>(undefined);
 useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;const meta=document.querySelector('meta[name="theme-color"]');meta?.setAttribute('content',theme==='dark'?'#17232b':'#f3f5f0');try{localStorage.setItem('naufal-farma:theme',theme)}catch{}},[theme]);
 async function refresh(){setProducts(await db.products.toArray());setSales(await db.sales.toArray());setMoves(await db.movements.toArray())}

 async function syncCloudCSV(showFeedback=false){
  if(syncLock.current)return;if(!navigator.onLine){setSyncState('offline');return}
  syncLock.current=true;setSyncing(true);setSyncState('syncing');
  try{
   const raw=await fetchMasterCatalogCSV();
   const result=await syncMasterCatalogCSV(raw);
   await refresh();const syncedAt=new Date().toISOString();setLastSync(syncedAt);try{localStorage.setItem('naufal-farma:last-csv-sync',syncedAt)}catch{}setSyncState('online');
   if(showFeedback)setNotice('Sinkronisasi GitHub berhasil: '+result.count+' produk diperiksa.'+(result.repaired?', '+result.repaired+' baris CSV dirapikan.':'')+(result.skipped?', '+result.skipped+' baris non-produk dilewati.':''));
  }catch(e){setSyncState(navigator.onLine?'error':'offline');if(showFeedback)setNotice('Sync GitHub gagal. Data lokal tetap digunakan: '+(e instanceof Error?e.message:String(e)))}
  finally{syncLock.current=false;setSyncing(false)}
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
 useEffect(()=>{if(!Capacitor.isNativePlatform())return;let active=true;let backListener:{remove:()=>Promise<void>}|undefined;let stateListener:{remove:()=>Promise<void>}|undefined;void CapacitorApp.addListener('backButton',({canGoBack})=>{if(scan){void stopScan();return}if(stockDialog){setStockDialog(null);return}if(openMenu){setOpenMenu(null);return}if(tab!=='Dashboard'){setTab('Dashboard');setQuery('');return}if(!canGoBack)void CapacitorApp.exitApp()}).then(listener=>{if(active)backListener=listener;else void listener.remove()}).catch(()=>{});void CapacitorApp.addListener('appStateChange',({isActive})=>{if(!isActive&&scan)void stopScan()}).then(listener=>{if(active)stateListener=listener;else void listener.remove()}).catch(()=>{});return()=>{active=false;if(backListener)void backListener.remove();if(stateListener)void stateListener.remove()}},[scan,stockDialog,openMenu,tab]);
 const filtered=useMemo(()=>products.filter(p=>[p.name,p.code,p.barcode].some(v=>(v||'').toLowerCase().includes(query.trim().toLowerCase()))),[products,query]);
 function categoryAsset(category:string){const value=(category||'').toLowerCase();if(/tablet|pil/.test(value))return '/assets/category-tablets.svg';if(/kapsul|capsul/.test(value))return '/assets/category-capsules.svg';if(/sirup|syrup|cair/.test(value))return '/assets/category-syrup.svg';if(/vitamin|suplemen/.test(value))return '/assets/category-vitamins.svg';if(/alat kesehatan|alkes|medical|termometer|tensimeter/.test(value))return '/assets/category-medical-device.svg';if(/p3k|pertolongan|first aid|perban|antiseptik/.test(value))return '/assets/category-first-aid.svg';return ''}
 const today=localDate(),todaySales=sales.filter(s=>localDate(new Date(s.createdAt))===today),revenue=todaySales.reduce((a,s)=>a+s.total,0),profit=todaySales.reduce((a,s)=>a+s.items.reduce((b,i)=>b+(i.price-i.cost)*i.qty,0),0);
 function add(p:Product){
  setCart(c=>{const old=c.find(x=>x.p.code===p.code);return old?c.map(x=>x.p.code===p.code?{...x,qty:x.qty+1}:x):[...c,{p,qty:1}]})
 }
 async function checkout(){
  if(!cart.length||busy)return;setBusy(true);
  try{
   const lines=cart.map(x=>({code:x.p.code,qty:x.qty}));
   await recordSale(lines);
   setCart([]);await refresh();setNotice('Transaksi berhasil disimpan.');
  }catch(e){setNotice('Transaksi dibatalkan: '+(e instanceof Error?e.message:String(e)));await refresh()}
  finally{setBusy(false)}
 }
 async function moveStock(type:'MASUK'|'KELUAR'){
  if(busy)return;const p=products.find(x=>x.code===query.trim()||x.barcode===query.trim());
  if(!p){setNotice('Pilih produk dengan kode atau barcode yang tepat.');return}
  const qty=Number(stockQty.trim());if(!Number.isSafeInteger(qty)||qty<1){setNotice('Jumlah harus bilangan bulat positif.');return}
  setBusy(true);try{await recordInventoryMovement(p.code,qty,type);await refresh();setNotice('Mutasi stok tersimpan.')}
  catch(e){setNotice('Mutasi dibatalkan: '+(e instanceof Error?e.message:String(e)))}
  finally{setBusy(false);setStockDialog(null);setStockQty('')}
 }
 function openProductForm(product?:Product){
  setEditingProduct(product??null);
  setProductForm(product?{code:product.code,barcode:product.barcode||'',name:product.name,category:product.category||'',brand:product.brand||'',stock:String(product.stock),unit:product.unit||'pcs',buyPrice:String(product.buyPrice),sellPrice:String(product.sellPrice),minStock:String(product.minStock),shelf:product.shelf||'',supplier:product.supplier||''}:{code:'',barcode:'',name:'',category:'',brand:'',stock:'0',unit:'pcs',buyPrice:'0',sellPrice:'0',minStock:'0',shelf:'',supplier:''});
  setProductDialog(true);
 }
 async function saveProduct(){
  if(busy)return;const code=productForm.code.trim(),name=productForm.name.trim();
  const stock=Number(productForm.stock),buyPrice=Number(productForm.buyPrice),sellPrice=Number(productForm.sellPrice),minStock=Number(productForm.minStock);
  const payload:Product={code,barcode:productForm.barcode.trim(),name,category:productForm.category.trim(),brand:productForm.brand.trim(),stock,unit:productForm.unit.trim()||'pcs',buyPrice,sellPrice,minStock,shelf:productForm.shelf.trim(),supplier:productForm.supplier.trim()};
  setBusy(true);try{await saveCatalogProduct(payload,editingProduct);await refresh();setProductDialog(false);setEditingProduct(null);setNotice(editingProduct?'Master barang berhasil diperbarui.':'Barang baru berhasil ditambahkan.')}
  catch(e){setNotice('Simpan master barang gagal: '+(e instanceof Error?e.message:String(e)))}finally{setBusy(false)}
 }
 async function deleteProduct(product:Product){
  if(busy||!product.id)return;
  if(!window.confirm('Hapus "'+product.name+'" dari master barang pada perangkat ini? Riwayat transaksi dan mutasi yang sudah tersimpan tidak ikut dihapus.'))return;
  setBusy(true);try{await removeCatalogProduct(product);setCart(current=>current.filter(item=>item.p.code!==product.code));await refresh();setNotice('Barang berhasil dihapus dari master lokal.')}
  catch(e){setNotice('Hapus barang gagal: '+(e instanceof Error?e.message:String(e)))}finally{setBusy(false)}
 }
 async function importCSV(file:File){
  if(busy)return;setBusy(true);try{const parsed=parseMasterCSV(await file.text());const {list,skipped}=productsFromCSV(parsed);await importCatalogProducts(list);await refresh();setNotice('Impor berhasil: '+list.length+' produk; stok lokal dipertahankan.'+(skipped?', '+skipped+' baris kosong/non-produk dilewati.':'')+(parsed.repaired?', '+parsed.repaired+' baris CSV tergabung diperbaiki.':''))}
  catch(e){setNotice('Impor CSV dibatalkan: '+(e instanceof Error?e.message:String(e)))}finally{setBusy(false)}
 }
 async function stopScan(){if(scanTimerRef.current!==undefined)window.clearTimeout(scanTimerRef.current);scanTimerRef.current=undefined;const q=scannerRef.current;scannerRef.current=null;if(q)await q.stop();setScan(false)}
 async function startScan(showReadNotice=true){
  if(scan||scanTimerRef.current!==undefined)return;setScan(true);
  scanTimerRef.current=window.setTimeout(async()=>{scanTimerRef.current=undefined;const scanner=new BarcodeScanner();scannerRef.current=scanner;
   try{await scanner.start('barcode-reader',async value=>{if(scannerRef.current!==scanner)return;setQuery(value);if(showReadNotice)setNotice('Barcode berhasil dibaca: '+value);await stopScan()})}
   catch(error){if(scannerRef.current===scanner)scannerRef.current=null;await scanner.stop();const message=error instanceof Error?error.message:String(error),lower=message.toLowerCase();setNotice(lower.includes('permission')||lower.includes('notallowed')||lower.includes('denied')?'Izin kamera ditolak. Izinkan akses Kamera untuk aplikasi POS Apotek di pengaturan Android.':lower.includes('secure')?'Akses kamera tidak tersedia pada konteks aplikasi ini. Perbarui aplikasi Android.':'Pemindai gagal dibuka: '+message);setScan(false)}
  },350)
 }
 useEffect(()=>()=>{if(scanTimerRef.current!==undefined)window.clearTimeout(scanTimerRef.current);const q=scannerRef.current;if(q)void q.stop()},[]);
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
   doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(24,83,58);doc.text('APOTEK NAUFAL FARMA',left,y);y+=7;
   doc.setFontSize(11);doc.text('LAPORAN PENJUALAN',left,y);y+=6;
   doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('Periode: '+from+' s.d. '+to,left,y);y+=8;
   const total=list.reduce((a,v)=>a+v.total,0),profitTotal=list.reduce((a,v)=>a+v.items.reduce((b,i)=>b+(i.price-i.cost)*i.qty,0),0);
   doc.setFont('helvetica','bold');doc.text('Jumlah transaksi: '+list.length,left,y);y+=5;doc.text('Omzet: '+money(total),left,y);y+=5;doc.text('Estimasi laba: '+money(profitTotal),left,y);y+=8;
   const drawHead=()=>{doc.setFillColor(222,239,228);doc.setDrawColor(183,211,190);doc.rect(left,y,182,8,'F');doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('Waktu',left+2,y+5);doc.text('Rincian',left+38,y+5);doc.text('Total',right-2,y+5,{align:'right'});y+=11};
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
 async function downloadInventoryPDF(list:Movement[],type:'MASUK'|'KELUAR'){
  if(reportFrom&&reportTo&&reportFrom>reportTo){setNotice('Tanggal awal tidak boleh melewati tanggal akhir.');return}
  if(!list.length){setNotice(type==='MASUK'?'Tidak ada barang masuk pada rentang tanggal ini.':'Tidak ada barang keluar pada rentang tanggal ini.');return}
  setPdfBusy(true);
  try{
   const doc=buildInventoryMovementPDF(list,type,{from:reportFrom,to:reportTo},money);
   const label=type==='MASUK'?'masuk':'keluar';
   await savePDF(doc,'laporan-barang-'+label+'-'+(reportFrom||'semua')+'-'+(reportTo||'terkini')+'.pdf');
  }catch(e){setNotice('PDF barang '+(type==='MASUK'?'masuk':'keluar')+' gagal dibuat: '+String(e))}
  finally{setPdfBusy(false)}
 }
 const exportCSV=()=>{const csv=Papa.unparse(products.map(p=>({'Kode Item':p.code,'Kode Barcode':p.barcode,'Nama Item':p.name,'Jenis':p.category,'Merek':p.brand,'Stok':p.stock,'Satuan':p.unit,'Harga Beli':p.buyPrice,'Harga Jual':p.sellPrice,'Stok Min':p.minStock,'Rak':p.shelf,'Supplier':p.supplier})));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='backup-produk.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)};
 return <div className="nf-app"><nav className="nf-app-topbar" aria-label="Navigasi utama">
 <div className="nf-brand"><span className="nf-brandmark"><Pill size={22}/></span><div><b>NAUFAL FARMA</b><small>Apotek point of sale</small></div></div>
 <span className="nf-top-status">{syncState==='syncing'?'Sync…':syncState==='online'?'Cloud aktif':syncState==='error'?'Sync gagal':'Offline lokal'}</span>
</nav>
 <div className="nf-app-nav" role="navigation" aria-label="Navigasi utama">
  <button className={'nf-nav '+(tab==='Dashboard'?'nf-active':'')} onClick={()=>{setTab('Dashboard');setQuery('');setOpenMenu(null)}}><Home/><span>Dashboard</span></button>
  <button className={'nf-nav '+(tab==='Kasir'?'nf-active':'')} onClick={()=>{setTab('Kasir');setQuery('');setOpenMenu(null)}}><ShoppingCart/><span>Kasir</span></button>
  <div className="nf-nav-item">
   <button className={'nf-nav '+((tab==='Barang'||tab==='Cek Harga')?'nf-active':'')} aria-haspopup="true" aria-expanded={openMenu==='Produk'} onClick={()=>setOpenMenu(openMenu==='Produk'?null:'Produk')}><Package/><span>Produk</span><ChevronDown className="nf-chevron"/></button>
   {openMenu==='Produk'&&<div className="nf-nav-submenu" role="group" aria-label="Menu Produk">
    <button className={tab==='Barang'?'nf-selected':''} onClick={()=>{setTab('Barang');setQuery('');setOpenMenu(null)}}><Boxes size={16}/> Master Barang</button>
    <button className={tab==='Cek Harga'?'nf-selected':''} onClick={()=>{setTab('Cek Harga');setQuery('');setOpenMenu(null)}}><Search size={16}/> Cek Harga</button>
   </div>}
  </div>
  <div className="nf-nav-item">
   <button className={'nf-nav '+((tab==='Barang Masuk'||tab==='Barang Keluar')?'nf-active':'')} aria-haspopup="true" aria-expanded={openMenu==='Persediaan'} onClick={()=>setOpenMenu(openMenu==='Persediaan'?null:'Persediaan')}><Boxes/><span>Persediaan</span><ChevronDown className="nf-chevron"/></button>
   {openMenu==='Persediaan'&&<div className="nf-nav-submenu" role="group" aria-label="Menu Persediaan">
    <button className={tab==='Barang Masuk'?'nf-selected':''} onClick={()=>{setTab('Barang Masuk');setQuery('');setOpenMenu(null)}}><ArrowDownToLine size={16}/> Barang Masuk</button>
    <button className={tab==='Barang Keluar'?'nf-selected':''} onClick={()=>{setTab('Barang Keluar');setQuery('');setOpenMenu(null)}}><ArrowUpFromLine size={16}/> Barang Keluar</button>
   </div>}
  </div>
  <button className={'nf-nav '+(tab==='Laporan'?'nf-active':'')} onClick={()=>{setTab('Laporan');setQuery('');setOpenMenu(null)}}><BarChart3/><span>Laporan</span></button>
  <button className={'nf-nav '+(tab==='Pengaturan'?'nf-active':'')} onClick={()=>{setTab('Pengaturan');setQuery('');setOpenMenu(null)}}><Settings/><span>Pengaturan</span></button>
 </div>
 <main className="nf-app-main"><header className="nf-screen-header"><div><span className="nf-screen-context">Naufal Farma / Operasional</span><h1>{tab}</h1></div><span className="nf-online">{syncState==='online'?<Cloud size={15}/>:<WifiOff size={15}/>} {syncState==='syncing'?'Sinkronisasi…':syncState==='online'?'Cloud tersinkron':syncState==='error'?'Sync gagal, data lokal':'Mode offline'}</span></header>{notice&&<div className="nf-toast">{notice}</div>}
 {tab==='Dashboard'&&<><section className="nf-dashboard-intro"><div className="nf-dashboard-intro-copy"><p><span className="nf-poster-kicker-dot"/> NAUFAL FARMA · PHARMACY CARE</p><h2>Sehat terjaga.<br/>Stok terkendali.</h2><small>Kontrol penjualan, persediaan, dan aktivitas apotek dari satu ruang kerja.</small></div><div className="nf-dashboard-poster-art" aria-hidden="true"><img src="/assets/dashboard-pharmacy.svg" alt="" /></div><div className="nf-dashboard-quick-actions"><button type="button" onClick={()=>{setTab('Kasir');setQuery('');setOpenMenu(null)}}><ShoppingCart size={17}/><span>Mulai transaksi</span></button><button type="button" onClick={()=>{setTab('Barang');setQuery('');setOpenMenu(null)}}><Package size={17}/><span>Master barang</span></button></div></section><div className="nf-stats">{[['Produk',products.length,PackageCheck],['Omzet',money(revenue),TrendingUp],['Laba',money(profit),Activity],['Stok tipis',products.filter(p=>p.stock<=p.minStock).length,AlertTriangle]].map(([a,b,Icon]:any,i)=><div className="nf-stat" key={String(a)}><div className="nf-stat-top"><span>{a}</span><i className={"nf-stat-icon nf-stat-icon-"+i}><Icon size={18}/></i></div><strong>{b}</strong></div>)}</div><section className="nf-panel"><div className="nf-panel-head"><h3><AlertTriangle size={17}/> Stok perlu dicek</h3><span className="nf-section-count">{products.filter(p=>p.stock<=p.minStock).length}</span></div><div className="nf-visual-stock-grid">{products.filter(p=>p.stock<=p.minStock).slice(0,8).map(p=><div className="nf-visual-stock-card" key={p.code}><span className="nf-visual-product-icon"><Pill size={19}/></span><span className="nf-visual-stock-copy"><b>{p.name}</b><small>{p.code}</small></span><strong>{p.stock}<small> {p.unit}</small></strong></div>)}</div>{!products.some(p=>p.stock<=p.minStock)&&<div className="nf-visual-empty"><PackageCheck size={30}/><b>Stok aman</b><small>Tidak ada produk di bawah batas minimum.</small></div>}</section><section className="nf-panel nf-dashboard-trend"><div className="nf-panel-head"><h3><TrendingUp size={17}/> Aktivitas 7 hari</h3><span className="nf-section-count">{sales.filter(x=>Date.now()-new Date(x.createdAt).getTime()<7*86400000).length} transaksi</span></div><div className="nf-trend-bars">{Array.from({length:7},(_,i)=>{const day=new Date();day.setHours(0,0,0,0);day.setDate(day.getDate()-(6-i));const key=localDate(day);const amount=sales.filter(x=>localDate(new Date(x.createdAt))===key).reduce((a,x)=>a+x.total,0);const peak=Math.max(1,...Array.from({length:7},(_,j)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(6-j));return sales.filter(x=>localDate(new Date(x.createdAt))===localDate(d)).reduce((a,x)=>a+x.total,0)}));return <div className="nf-trend-day" key={key}><div className="nf-trend-track"><span style={{height:Math.max(5,amount/peak*100)+'%'}}/></div><small>{['Min','Sen','Sel','Rab','Kam','Jum','Sab'][day.getDay()]}</small></div>})}</div></section></>}
 {tab==='Kasir'&&<div className="nf-grid-two"><section className="nf-panel"><div className="nf-panel-head"><h3><ShoppingBag size={17}/> Produk</h3><UiButton className="nf-soft-btn" aria-label="Scan barcode" onClick={()=>void startScan()}><ScanLine size={17}/></UiButton></div><UiInput className="nf-search" placeholder="Cari nama, kode, barcode..." value={query} onChange={e=>setQuery(e.target.value)}/><div className="nf-product-visual-grid">{filtered.slice(0,40).map(p=><button className="nf-product-pick" key={p.code} onClick={()=>add(p)}><span className="nf-product-card-icon">{categoryAsset(p.category)?<img src={categoryAsset(p.category)} alt="" loading="lazy"/>:<Pill size={21}/>}</span><span className="nf-product-card-copy"><b>{p.name}</b><small>{p.code}, Stok {p.stock} {p.unit}</small><strong>{money(p.sellPrice)}</strong></span><span className="nf-product-add-icon"><ShoppingCart size={16}/></span></button>)}</div>{!filtered.length&&<p className="nf-empty-state">Produk tidak ditemukan.</p>}{filtered.length>40&&<p className="nf-empty-state">Menampilkan 40 produk pertama. Persempit pencarian untuk hasil lainnya.</p>}</section><section className="nf-panel"><h3><ShoppingCart size={17}/> Keranjang <span className="nf-section-count">{cart.length}</span></h3>{!cart.length&&<p className="nf-empty-state">Keranjang masih kosong. Pilih produk untuk memulai transaksi.</p>}{cart.map(x=><div className="nf-cart-row" key={x.p.code}><div className="nf-cart-info"><b>{x.p.name}</b><small>{money(x.p.sellPrice)} / {x.p.unit}</small></div><div className="nf-qty-control"><button aria-label={'Kurangi '+x.p.name} onClick={()=>setCart(c=>c.map(y=>y.p.code===x.p.code?{...y,qty:Math.max(0,y.qty-1)}:y).filter(y=>y.qty>0))}>−</button><b>{x.qty}</b><button aria-label={'Tambah '+x.p.name} onClick={()=>add(x.p)}>+</button></div><strong>{money(x.qty*x.p.sellPrice)}</strong></div>)}<h2>{money(cart.reduce((a,x)=>a+x.qty*x.p.sellPrice,0))}</h2><button className="nf-primary nf-full nf-checkout-btn" disabled={!cart.length||busy} onClick={()=>void checkout()}><ShoppingCart size={17}/>{busy?'Memproses…':'Bayar sekarang'}</button></section></div>}
 {(tab==='Cek Harga'||tab==='Barang')&&<section className="nf-panel"><div className="nf-panel-head"><h3>{tab==='Barang'?'Master barang':'Pencarian harga produk'}</h3><div className="nf-panel-actions">{tab==='Barang'&&<><button type="button" className="nf-primary" disabled={busy} onClick={()=>openProductForm()}><Plus size={16}/> Tambah barang</button><label className="nf-soft-btn nf-upload"><Upload size={16}/> Impor CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.currentTarget.value='';if(file)void importCSV(file)}}/></label></>}</div></div><div className="nf-catalog-summary"><div><PackageCheck size={20}/><b>{filtered.length}</b><small>Produk ditemukan</small></div><div><Boxes size={20}/><b>{filtered.reduce((n,p)=>n+p.stock,0).toLocaleString('id-ID')}</b><small>Total unit stok</small></div><div><AlertTriangle size={20}/><b>{filtered.filter(p=>p.stock<=p.minStock).length}</b><small>Perlu restok</small></div></div><div className="nf-search-with-scan"><UiInput className="nf-search" placeholder="Cari nama, kode, atau barcode..." value={query} onChange={e=>setQuery(e.target.value)}/><UiButton className="nf-soft-btn nf-scan-search-btn" aria-label="Buka pemindai barcode" onClick={()=>void startScan(tab!=="Cek Harga")}><Camera size={18}/></UiButton></div><div className="nf-master-grid">{filtered.map(p=><article className="nf-master-card" key={p.code}><div className="nf-master-card-top"><span className="nf-master-product-icon">{categoryAsset(p.category)?<img src={categoryAsset(p.category)} alt="" loading="lazy"/>:<Pill size={22}/>}</span><span className={'nf-stock-status '+(p.stock<=p.minStock?'nf-stock-low':'nf-stock-ok')}>{p.stock<=p.minStock?'Stok menipis':'Stok tersedia'}</span></div><div className="nf-master-card-name"><b>{p.name}</b><small>{p.code}{p.barcode?', Barcode '+p.barcode:''}</small></div><div className="nf-master-card-data"><span><small>Stok</small><b>{p.stock.toLocaleString('id-ID')} {p.unit}</b></span><span><small>Harga beli</small><b>{money(p.buyPrice)}</b></span><span><small>Harga jual</small><b>{money(p.sellPrice)}</b></span></div>{tab==='Barang'&&<div className="nf-master-card-actions"><button type="button" className="nf-soft-btn" aria-label={'Edit '+p.name} title="Edit barang" disabled={busy} onClick={()=>openProductForm(p)}><Pencil size={15}/> Edit</button><button type="button" className="nf-soft-btn nf-danger-btn" aria-label={'Hapus '+p.name} title="Hapus barang" disabled={busy} onClick={()=>void deleteProduct(p)}><Trash2 size={15}/> Hapus</button></div>}</article>)}{!filtered.length&&<div className="nf-visual-empty"><img className="nf-empty-illustration" src="/assets/empty-products.svg" alt="" loading="lazy"/><b>Produk tidak ditemukan</b><small>Coba kata kunci, kode item, atau barcode lain.</small></div>}</div></section>}
 {(tab==='Barang Masuk'||tab==='Barang Keluar')&&(()=>{
  const kind=tab==='Barang Masuk'?'MASUK':'KELUAR';
  const selected=products.find(p=>p.code===query.trim()||p.barcode===query.trim());
  const history=moves.filter(m=>m.type===kind).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return <section className="nf-panel">
   <div className="nf-panel-head nf-movement-page-head"><div><span className="nf-screen-context">Persediaan apotek</span><h3>{tab}</h3></div><span className="nf-section-count">{products.length.toLocaleString('id-ID')} produk</span></div>
   <div className="nf-movement-picker-head"><div><b>Pilih produk</b><small>Cari berdasarkan nama, kode item, atau barcode.</small></div><span className="nf-movement-picker-count">{filtered.length} ditemukan</span></div>
   <div className="nf-search-with-scan"><UiInput className="nf-search" placeholder="Cari nama / kode / barcode…" value={query} onChange={e=>setQuery(e.target.value)}/><UiButton className="nf-soft-btn nf-scan-search-btn" aria-label="Scan barcode produk" onClick={()=>void startScan()}><Camera size={18}/></UiButton></div>
   <div className="nf-movement-product-list" role="group" aria-label="Daftar produk untuk mutasi">
    {filtered.map(p=><button type="button" key={p.code} className={'nf-movement-product-option '+(selected?.code===p.code?'nf-selected':'')} onClick={()=>setQuery(p.code)}>
     <span className="nf-movement-product-icon">{categoryAsset(p.category)?<img src={categoryAsset(p.category)} alt="" loading="lazy"/>:<Pill size={19}/>}</span><span className="nf-movement-option-copy"><b>{p.name}</b><small>{p.code}{p.barcode?', '+p.barcode:''}, {p.category||'Umum'}</small></span><span className="nf-movement-option-stock"><b>{p.stock.toLocaleString('id-ID')}</b><small>{p.unit}</small></span><span className="nf-movement-option-price">{money(p.buyPrice)}</span>
    </button>)}
    {!filtered.length&&<div className="nf-movement-list-empty"><img className="nf-empty-illustration" src="/assets/empty-products.svg" alt="" loading="lazy"/><b>Produk tidak ditemukan</b><small>Periksa kata kunci atau barcode yang dimasukkan.</small></div>}
   </div>
   {selected&&<div className="nf-movement-selected-card"><span className="nf-movement-product-icon">{categoryAsset(selected.category)?<img src={categoryAsset(selected.category)} alt="" loading="lazy"/>:<Pill size={22}/>}</span><div><small>Produk dipilih</small><b>{selected.name}</b><span>{selected.code}, Stok {selected.stock} {selected.unit}, Harga beli {money(selected.buyPrice)}</span></div><ShieldCheck size={20}/></div>}
   <button type="button" className="nf-primary nf-movement-action" disabled={!selected||busy} onClick={()=>{setStockQty('');setStockDialog(kind)}}>{kind==='MASUK'?<ArrowDownToLine size={17}/>:<ArrowUpFromLine size={17}/>} Catat barang {kind==='MASUK'?'masuk':'keluar'}</button>
   <div className="nf-movement-history-head"><div><h3>Riwayat {kind==='MASUK'?'barang masuk':'barang keluar'}</h3><small>Seluruh catatan tersimpan</small></div><span className="nf-section-count">{history.length.toLocaleString('id-ID')} catatan</span></div>
   <div className="nf-movement-history-grid">{history.map(m=><div className="nf-movement-history-card" key={m.id??m.createdAt+m.code+m.qty}><span className={'nf-movement-history-icon '+(m.type==='MASUK'?'nf-is-in':'nf-is-out')}>{m.type==='MASUK'?<ArrowDownToLine size={17}/>:<ArrowUpFromLine size={17}/>}</span><span><b>{m.name}</b><small>{pdfDate(m.createdAt)}, {m.code}</small><small>{m.note||'Mutasi stok'}, {money(m.unitCost)} / unit</small></span><strong>{Math.abs(m.qty).toLocaleString('id-ID')} <small>{products.find(p=>p.code===m.code)?.unit||'unit'}</small></strong></div>)}
    {!history.length&&<div className="nf-movement-list-empty"><ClipboardList size={25}/><b>Belum ada riwayat</b><small>Catatan mutasi akan muncul di sini setelah disimpan.</small></div>}
   </div>
  </section>;
})()}
 {tab==='Laporan'&&(()=>{
  const range={from:reportFrom,to:reportTo};
  const reportSales=filterSalesByRange(sales,range,localDate);
  const incoming=filterMovementsByRange(moves,'MASUK',range,localDate);
  const outgoing=filterMovementsByRange(moves,'KELUAR',range,localDate);
  const total=reportSales.reduce((a,s)=>a+s.total,0);
  const inventorySummary=summarizeInventoryMovements;
  const incomingTotals=inventorySummary(incoming),outgoingTotals=inventorySummary(outgoing);
  const inventoryTable=(list:Movement[],emptyLabel:string)=><div className="nf-table-wrap"><table><thead><tr><th>Nama barang</th><th>Qty</th><th>Harga beli</th><th>Total</th></tr></thead><tbody>{list.map((m,i)=><tr key={m.id??m.createdAt+m.code+i}><td><b>{m.name}</b><small className="nf-table-subtext">{pdfDate(m.createdAt)}</small></td><td>{Math.abs(m.qty)}</td><td>{money(m.unitCost)}</td><td><b>{money(Math.abs(m.qty)*m.unitCost)}</b></td></tr>)}{!list.length&&<tr><td colSpan={4} className="nf-empty-state">{emptyLabel}</td></tr>}</tbody><tfoot><tr><th colSpan={3}>Total keseluruhan</th><th>{money(inventorySummary(list).value)}</th></tr></tfoot></table></div>;
  return <>
   <section className="nf-panel">
    <div className="nf-panel-head"><h3>Riwayat penjualan</h3><b>Omzet: {money(total)}</b></div>
    <div className="nf-report-tools"><label>Dari tanggal<input type="date" value={reportFrom} onChange={e=>setReportFrom(e.target.value)}/></label><label>Sampai tanggal<input type="date" value={reportTo} onChange={e=>setReportTo(e.target.value)}/></label><button className="nf-primary" disabled={pdfBusy||!reportSales.length||Boolean(reportFrom&&reportTo&&reportFrom>reportTo)} onClick={()=>void downloadReportPDF(reportSales)}><Download size={16}/> {pdfBusy?'Membuat PDF…':'Unduh laporan PDF'}</button></div>
    <div className="nf-report-kpi-grid"><div className="nf-report-kpi"><span><ShoppingCart size={17}/></span><small>Transaksi</small><b>{reportSales.length}</b></div><div className="nf-report-kpi"><span><TrendingUp size={17}/></span><small>Omzet</small><b>{money(total)}</b></div><div className="nf-report-kpi"><span><Activity size={17}/></span><small>Estimasi laba</small><b>{money(reportSales.reduce((a,s)=>a+s.items.reduce((b,i)=>b+(i.price-i.cost)*i.qty,0),0))}</b></div></div>
    <div className="nf-sales-report-list">{reportSales.map((sale,i)=><article className="nf-sales-report-card" key={sale.id??sale.createdAt+i}>
     <div className="nf-sales-report-top"><div><span className="nf-sales-report-index">Transaksi {String(reportSales.length-i).padStart(3,'0')}</span><b>{pdfDate(sale.createdAt)}</b><small>{sale.items.length} jenis barang, {sale.items.reduce((n,item)=>n+item.qty,0)} unit</small></div><button className="nf-soft-btn nf-sales-receipt-btn" disabled={pdfBusy} onClick={()=>void downloadReceiptPDF(sale)}><Download size={15}/> Struk PDF</button></div>
     <div className="nf-sales-report-items">{sale.items.map((item,j)=><div className="nf-sales-report-item" key={item.code+'-'+j}><span><b>{item.name}</b><small>{item.code}, {item.qty} × {money(item.price)}</small></span><strong>{money(item.qty*item.price)}</strong></div>)}</div>
     <div className="nf-sales-report-total"><span>Total transaksi</span><b>{money(sale.total)}</b></div>
    </article>)}
    {!reportSales.length&&<div className="nf-sales-report-empty"><img className="nf-empty-illustration" src="/assets/empty-reports.svg" alt="" loading="lazy"/><b>Belum ada penjualan pada periode ini</b><small>Ubah rentang tanggal untuk melihat transaksi lainnya.</small></div>}
   </div>
   </section>
   <section className="nf-panel">
    <div className="nf-panel-head"><h3>Laporan barang masuk</h3><b>Total: {money(incomingTotals.value)}</b></div>
    <div className="nf-report-kpi-grid nf-report-kpi-compact"><div className="nf-report-kpi"><span><ArrowDownToLine size={17}/></span><small>Catatan masuk</small><b>{incoming.length}</b></div><div className="nf-report-kpi"><span><Boxes size={17}/></span><small>Jumlah unit</small><b>{incomingTotals.qty.toLocaleString('id-ID')}</b></div><div className="nf-report-kpi"><span><Wallet size={17}/></span><small>Nilai pembelian</small><b>{money(incomingTotals.value)}</b></div></div>
    <div className="nf-report-tools"><button className="nf-primary" disabled={pdfBusy||!incoming.length||Boolean(reportFrom&&reportTo&&reportFrom>reportTo)} onClick={()=>void downloadInventoryPDF(incoming,'MASUK')}><Download size={16}/> {pdfBusy?'Membuat PDF…':'Unduh laporan barang masuk'}</button></div>
    {inventoryTable(incoming,'Belum ada barang masuk pada periode ini.')}
   </section>
   <section className="nf-panel">
    <div className="nf-panel-head"><h3>Laporan barang keluar</h3><b>Total: {money(outgoingTotals.value)}</b></div>
    <div className="nf-report-kpi-grid nf-report-kpi-compact"><div className="nf-report-kpi"><span><ArrowUpFromLine size={17}/></span><small>Catatan keluar</small><b>{outgoing.length}</b></div><div className="nf-report-kpi"><span><Boxes size={17}/></span><small>Jumlah unit</small><b>{outgoingTotals.qty.toLocaleString('id-ID')}</b></div><div className="nf-report-kpi"><span><Wallet size={17}/></span><small>Nilai barang</small><b>{money(outgoingTotals.value)}</b></div></div>
    <div className="nf-report-tools"><button className="nf-primary" disabled={pdfBusy||!outgoing.length||Boolean(reportFrom&&reportTo&&reportFrom>reportTo)} onClick={()=>void downloadInventoryPDF(outgoing,'KELUAR')}><Download size={16}/> {pdfBusy?'Membuat PDF…':'Unduh laporan barang keluar'}</button></div>
    {inventoryTable(outgoing,'Belum ada barang keluar pada periode ini.')}
   </section>
  </>;
})()}
 {tab==='Pengaturan'&&<div className="nf-settings-layout">
  <section className="nf-panel nf-settings-panel">
   <div className="nf-settings-heading"><span className="nf-settings-icon"><Sun size={20}/></span><div><h3>Tampilan aplikasi</h3><p>Pilih tema yang nyaman digunakan. Pengaturan tersimpan otomatis di perangkat ini.</p></div></div>
   <div className="nf-theme-picker" role="group" aria-label="Pilih tema tampilan">
    <button type="button" className={'nf-theme-option '+(theme==='light'?'nf-selected':'')} aria-pressed={theme==='light'} onClick={()=>setTheme('light')}><span className="nf-theme-option-icon"><Sun size={20}/></span><span className="nf-theme-option-copy"><b>Light mode</b><small>Ivory, sage, emerald</small></span>{theme==='light'&&<ShieldCheck className="nf-theme-check" size={19}/>}</button>
    <button type="button" className={'nf-theme-option '+(theme==='dark'?'nf-selected':'')} aria-pressed={theme==='dark'} onClick={()=>setTheme('dark')}><span className="nf-theme-option-icon"><Moon size={20}/></span><span className="nf-theme-option-copy"><b>Dark mode</b><small>Graphite, teal, mint</small></span>{theme==='dark'&&<ShieldCheck className="nf-theme-check" size={19}/>}</button>
   </div>
  </section>
  <section className="nf-panel nf-settings-panel">
   <div className="nf-settings-heading"><span className="nf-settings-icon"><Cloud size={20}/></span><div><h3>Sinkronisasi database GitHub</h3><p>Master produk tersinkron satu arah dari GitHub ke aplikasi.</p></div></div>
   <div className="nf-sync-status-card"><span className="nf-sync-status-icon"><Cloud size={24}/></span><div className="nf-sync-status-copy"><b>{syncState==='syncing'?'Sedang mengambil CSV dari GitHub…':syncState==='online'?'Terhubung, master produk tersinkron':syncState==='error'?'Sinkronisasi gagal, data lokal tetap aman':'Offline, menggunakan data lokal'}</b><small>{lastSync?'Sinkron terakhir: '+new Date(lastSync).toLocaleString('id-ID'):'Belum ada sinkronisasi berhasil pada sesi ini.'}</small><p>Otomatis saat aplikasi dibuka, koneksi kembali aktif, dan setiap 15 menit. Tidak memerlukan token.</p></div></div>
   <button className="nf-primary nf-settings-primary" disabled={syncing||!navigator.onLine} onClick={()=>void syncCloudCSV(true)}><RefreshCw size={17}/> {syncing?'Menyinkronkan…':'Sinkronkan sekarang'}</button>
  </section>
  <section className="nf-panel nf-settings-panel">
   <div className="nf-settings-heading"><span className="nf-settings-icon"><ShieldCheck size={20}/></span><div><h3>Data lokal</h3><p>Cadangkan dan kelola data pada perangkat ini.</p></div></div>
   <div className="nf-settings-actions">
    <button className="nf-soft-btn" disabled={busy} onClick={()=>void backupAll()}><Download size={17}/> Backup lengkap (JSON)</button>
    <label className="nf-soft-btn nf-upload"><FileUp size={17}/> Pulihkan backup<input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void restoreAll(file);e.currentTarget.value=''}}/></label>
    <button className="nf-soft-btn" disabled={busy} onClick={exportCSV}><Download size={17}/> Ekspor master produk CSV</button>
   </div>
   {busy&&<p className="nf-settings-helper">Memproses data, jangan tutup aplikasi…</p>}
  </section>
 </div>}
 </main>{productDialog&&<UiModal label={editingProduct?'Edit master barang':'Tambah master barang'} onClose={()=>{if(!busy)setProductDialog(false)}}><form className="nf-product-form" onSubmit={e=>{e.preventDefault();void saveProduct()}}><div className="nf-product-form-heading"><span className="nf-settings-icon"><PackageCheck size={21}/></span><div><h3>{editingProduct?'Edit barang':'Tambah barang baru'}</h3><small>Lengkapi data master produk apotek.</small></div></div><div className="nf-product-form-grid">
<label>Kode item *<UiInput required value={productForm.code} onChange={e=>setProductForm(v=>({...v,code:e.target.value}))} placeholder="Contoh: OBAT001"/></label>
<label>Barcode<UiInput value={productForm.barcode} onChange={e=>setProductForm(v=>({...v,barcode:e.target.value}))} placeholder="Nomor barcode"/></label>
<label className="nf-product-form-wide">Nama barang *<UiInput required value={productForm.name} onChange={e=>setProductForm(v=>({...v,name:e.target.value}))} placeholder="Nama produk"/></label>
<label>Kategori<UiInput value={productForm.category} onChange={e=>setProductForm(v=>({...v,category:e.target.value}))} placeholder="Obat / Vitamin"/></label>
<label>Merek<UiInput value={productForm.brand} onChange={e=>setProductForm(v=>({...v,brand:e.target.value}))} placeholder="Merek"/></label>
<label>Stok<UiInput type="number" min="0" step="1" required value={productForm.stock} onChange={e=>setProductForm(v=>({...v,stock:e.target.value}))}/></label>
<label>Satuan<UiInput value={productForm.unit} onChange={e=>setProductForm(v=>({...v,unit:e.target.value}))} placeholder="pcs / strip / box"/></label>
<label>Harga beli<UiInput type="number" min="0" step="1" required value={productForm.buyPrice} onChange={e=>setProductForm(v=>({...v,buyPrice:e.target.value}))}/></label>
<label>Harga jual<UiInput type="number" min="0" step="1" required value={productForm.sellPrice} onChange={e=>setProductForm(v=>({...v,sellPrice:e.target.value}))}/></label>
<label>Stok minimum<UiInput type="number" min="0" step="1" value={productForm.minStock} onChange={e=>setProductForm(v=>({...v,minStock:e.target.value}))}/></label>
<label>Rak<UiInput value={productForm.shelf} onChange={e=>setProductForm(v=>({...v,shelf:e.target.value}))} placeholder="Lokasi rak"/></label>
<label className="nf-product-form-wide">Supplier<UiInput value={productForm.supplier} onChange={e=>setProductForm(v=>({...v,supplier:e.target.value}))} placeholder="Nama pemasok"/></label>
</div><div className="nf-product-form-actions"><UiButton type="button" onClick={()=>setProductDialog(false)} disabled={busy}>Batal</UiButton><UiButton type="submit" variant="primary" disabled={busy}>{busy?'Menyimpan…':editingProduct?'Simpan perubahan':'Tambah barang'}</UiButton></div></form></UiModal>}{stockDialog&&<UiModal label={stockDialog==='MASUK'?'Barang masuk':'Barang keluar'} onClose={()=>setStockDialog(null)}><div className="nf-stock-dialog"><h3>{stockDialog==='MASUK'?'Catat barang masuk':'Catat barang keluar'}</h3><p>{products.find(p=>p.code===query.trim()||p.barcode===query.trim())?.name}</p><UiInput autoFocus type="number" min="1" step="1" inputMode="numeric" placeholder="Jumlah unit" value={stockQty} onChange={e=>setStockQty(e.target.value)}/><UiButton variant="primary" className="nf-full" disabled={busy||!Number.isSafeInteger(Number(stockQty))||Number(stockQty)<1} onClick={()=>void moveStock(stockDialog)}>Simpan mutasi</UiButton></div></UiModal>}{scan&&<UiModal label="Pemindai barcode" onClose={()=>void stopScan()}><div className="nf-scan-card-content"><div id="barcode-reader"/><UiButton className="nf-soft-btn nf-full" onClick={()=>void stopScan()}>Tutup pemindai</UiButton></div></UiModal>}</div>
}
