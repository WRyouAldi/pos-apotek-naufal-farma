import {useEffect,useMemo,useRef,useState} from 'react';
import Papa from 'papaparse';
import {jsPDF} from 'jspdf';
import {db,type Product,type Sale,type Movement} from './db';
import {Activity,ArrowDownToLine,ArrowUpFromLine,BarChart3,Boxes,Camera,ChevronDown,Home,Package,Search,Settings,ShoppingCart,ShoppingBag,Upload,WifiOff,Download,FileUp,Sparkles,Pill,TrendingUp,AlertTriangle,PackageCheck,ScanLine,ClipboardList,ShieldCheck} from 'lucide-react';
import {Html5Qrcode} from 'html5-qrcode';
import {UiButton,UiInput,UiModal} from './ui';
type Tab='Dashboard'|'Kasir'|'Cek Harga'|'Barang'|'Barang Masuk'|'Barang Keluar'|'Laporan'|'Pengaturan';
const localDate=(d=new Date())=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+day};
const money=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
const num=(v:unknown)=>Number(String(v??'0').replace(/[^0-9-]/g,''))||0;
export default function App(){
 const [tab,setTab]=useState<Tab>('Dashboard'),[reportFrom,setReportFrom]=useState(''),[reportTo,setReportTo]=useState(''),[pdfBusy,setPdfBusy]=useState(false),[openMenu,setOpenMenu]=useState<'Produk'|'Persediaan'|null>(null),[products,setProducts]=useState<Product[]>([]),[sales,setSales]=useState<Sale[]>([]),[moves,setMoves]=useState<Movement[]>([]),[query,setQuery]=useState(''),[cart,setCart]=useState<{p:Product,qty:number}[]>([]),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[scan,setScan]=useState(false); const scannerRef=useRef<Html5Qrcode|null>(null),scanTimerRef=useRef<number|undefined>(undefined);
 async function refresh(){setProducts(await db.products.toArray());setSales(await db.sales.toArray());setMoves(await db.movements.toArray())}
 async function seedProductsFromCSV(){
  if(await db.products.count()>0)return;
  const response=await fetch('data/xReport2.csv');
  if(!response.ok)throw new Error('File master CSV belum tersedia di aplikasi.');
  const raw=await response.text(),lines=raw.split(/\r?\n/);
  const headerAt=lines.findIndex(line=>/Kode Item/i.test(line)&&/Nama Item/i.test(line));
  if(headerAt<0)throw new Error('Header Kode Item dan Nama Item tidak ditemukan.');
  const parsed=Papa.parse<Record<string,string>>(lines.slice(headerAt).join('\n'),{header:true,delimiter:';',skipEmptyLines:'greedy',transformHeader:h=>h.replace(/^\uFEFF/,'').trim().toLowerCase()});
  if(parsed.errors.length)throw new Error('Format master CSV tidak valid.');
  const seen=new Set<string>(),items:Product[]=[];
  for(const row of parsed.data){
   const get=(...keys:string[])=>{const k=Object.keys(row).find(x=>keys.includes(x));return k?String(row[k]??'').trim():''};
   const code=get('kode item','kode'),name=get('nama item','nama');
   if(!code||!name||(code==='.'&&name==='.')||seen.has(code))continue;
   seen.add(code);
   const value=(...keys:string[])=>{const v=get(...keys);return Number(v.replace(/[^0-9-]/g,''))||0};
   const stock=value('stok'),buyPrice=value('harga beli'),sellPrice=value('harga jual'),minStock=value('stok min');
   if(buyPrice<0||sellPrice<0||minStock<0)continue;
   items.push({code,barcode:get('kode barcode','barcode'),name,category:get('jenis','kategori'),brand:get('merek','brand'),stock,unit:get('satuan')||'pcs',buyPrice,sellPrice,minStock,shelf:get('rak'),supplier:get('supplier')});
  }
  if(!items.length)throw new Error('Tidak ada produk valid pada master CSV.');
  await db.transaction('rw',db.products,async()=>{if(await db.products.count()===0)await db.products.bulkAdd(items)});
 }
 useEffect(()=>{void (async()=>{try{await seedProductsFromCSV()}catch(e){setNotice('Master CSV: '+(e instanceof Error?e.message:String(e)))}finally{await refresh()}})()},[]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3200);return()=>clearTimeout(t)},[notice]);
 const filtered=useMemo(()=>products.filter(p=>[p.name,p.code,p.barcode].some(v=>(v||'').toLowerCase().includes(query.trim().toLowerCase()))),[products,query]);
 const today=localDate(),todaySales=sales.filter(s=>localDate(new Date(s.createdAt))===today),revenue=todaySales.reduce((a,s)=>a+s.total,0),profit=todaySales.reduce((a,s)=>a+s.items.reduce((b,i)=>b+(i.price-i.cost)*i.qty,0),0);
 function add(p:Product){setCart(c=>{const old=c.find(x=>x.p.code===p.code);return old?c.map(x=>x.p.code===p.code?{...x,qty:x.qty+1}:x):[...c,{p,qty:1}]})}
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
  const raw=prompt('Jumlah '+(type==='MASUK'?'barang masuk':'barang keluar')+' untuk '+p.name);
  if(raw===null)return;
  const qty=Number(raw.trim());
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
  finally{setBusy(false)}
 }
 async function importCSV(file:File){
  if(busy)return;setBusy(true);
  Papa.parse<Record<string,string>>(file,{header:true,skipEmptyLines:'greedy',transformHeader:h=>h.replace(/^\uFEFF/,'').trim().toLowerCase(),complete:async r=>{
   try{
    if(r.errors.length)throw new Error('CSV memiliki kesalahan format. Periksa pemisah dan tanda kutip.');
    const rows=r.data.filter(row=>Object.values(row).some(v=>String(v??'').trim()!==''));
    if(!rows.length)throw new Error('File CSV kosong.');
    const headers=Object.keys(rows[0]??{});
    if(!headers.some(h=>['kode item','kode'].includes(h))||!headers.some(h=>['nama item','nama'].includes(h)))throw new Error('Kolom Kode Item/Kode dan Nama Item/Nama wajib tersedia.');
    const seen=new Set<string>();
    const list:Product[]=rows.map((x,i)=>{
     const get=(...keys:string[])=>{const k=Object.keys(x).find(a=>keys.includes(a));return k?String(x[k]??'').trim():''};
     const code=get('kode item','kode'),name=get('nama item','nama');
     if(!code||!name)throw new Error('Baris '+(i+2)+': kode dan nama wajib diisi.');
     if(seen.has(code))throw new Error('Kode duplikat di CSV: '+code);seen.add(code);
     const val=(label:string,...keys:string[])=>{const raw=get(...keys);if(!raw)return 0;const n=Number(raw.replace(/[^0-9-]/g,''));if(!Number.isSafeInteger(n))throw new Error(label+' tidak valid pada baris '+(i+2));return n};
     const stock=val('Stok','stok'),buyPrice=val('Harga Beli','harga beli'),sellPrice=val('Harga Jual','harga jual'),minStock=val('Stok Min','stok min');
     if(buyPrice<0||sellPrice<0||minStock<0)throw new Error('Harga/stok minimum negatif pada baris '+(i+2));
     return{code,barcode:get('kode barcode','barcode'),name,category:get('jenis','kategori'),brand:get('merek','brand'),stock,unit:get('satuan')||'pcs',buyPrice,sellPrice,minStock,shelf:get('rak'),supplier:get('supplier')};
    });
    const existing=await db.products.toArray(),byCode=new Map(existing.map(p=>[p.code,p]));
    await db.transaction('rw',db.products,async()=>{
     for(const p of list){const old=byCode.get(p.code);if(old?.id)await db.products.update(old.id,p);else await db.products.add(p)}
    });
    await refresh();setNotice('Impor berhasil: '+list.length+' produk. Kode yang sama diperbarui; produk lain dipertahankan.');
   }catch(e){setNotice('Impor CSV dibatalkan: '+(e instanceof Error?e.message:String(e)))}
   finally{setBusy(false)}
  },error:()=>{setBusy(false);setNotice('File CSV tidak dapat dibaca.')}});
 }
 async function stopScan(){if(scanTimerRef.current!==undefined)window.clearTimeout(scanTimerRef.current);scanTimerRef.current=undefined;const q=scannerRef.current;scannerRef.current=null;if(q){try{if(q.isScanning)await q.stop();q.clear()}catch{}}setScan(false)}
 async function startScan(){setScan(true);scanTimerRef.current=window.setTimeout(async()=>{const q=new Html5Qrcode('barcode-reader');scannerRef.current=q;try{await q.start({facingMode:'environment'},{fps:10,qrbox:{width:240,height:120}},async v=>{setQuery(v);await stopScan()},()=>{});if(scannerRef.current!==q&&q.isScanning)await q.stop()}catch{if(scannerRef.current===q)scannerRef.current=null;setNotice('Kamera tidak tersedia atau izin belum diberikan.');setScan(false)}},180)}
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
   doc.save('struk-naufal-farma-'+(sale.id??Date.now())+'.pdf');
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
   doc.save('laporan-penjualan-naufal-farma-'+(reportFrom||'semua')+'-'+(reportTo||'terkini')+'.pdf');
  }catch(e){setNotice('PDF laporan gagal dibuat: '+String(e))}finally{setPdfBusy(false)}
 }
 const exportCSV=()=>{const csv=Papa.unparse(products.map(p=>({'Kode Item':p.code,'Kode Barcode':p.barcode,'Nama Item':p.name,'Jenis':p.category,'Merek':p.brand,'Stok':p.stock,'Satuan':p.unit,'Harga Beli':p.buyPrice,'Harga Jual':p.sellPrice,'Stok Min':p.minStock,'Rak':p.shelf,'Supplier':p.supplier})));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='backup-produk.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)};
 return <div className="app"><nav className="topbar" aria-label="Navigasi utama">
 <div className="brand"><span className="brandmark">N</span><div><b>NAUFAL FARMA</b><small>POINT OF SALE</small></div></div>
 <span className="top-status"><span className="dot"/>Lokal</span>
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
 <main className="main"><header><div><span className="eyebrow">APOTEK NAUFAL FARMA</span><h1>{tab}</h1></div><span className="online"><WifiOff size={15}/> Data lokal</span></header>{notice&&<div className="toast">{notice}</div>}
 {tab==='Dashboard'&&<><section className="welcome"><div><span className="eyebrow"><Sparkles size={13}/> RINGKASAN</span><h2>Apotek dalam<br/>satu sentuhan.</h2><div className="welcome-badges"><span><ShieldCheck size={13}/> Lokal</span><span><Activity size={13}/> Aktif</span></div></div><div className="welcome-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-capsule"><Pill size={48}/></div><span className="art-spark spark-one">✦</span><span className="art-spark spark-two">✧</span></div></section><div className="stats">{[['Produk',products.length,PackageCheck],['Omzet',money(revenue),TrendingUp],['Laba',money(profit),Activity],['Stok tipis',products.filter(p=>p.stock<=p.minStock).length,AlertTriangle]].map(([a,b,Icon]:any,i)=><div className="stat" key={String(a)}><div className="stat-top"><span>{a}</span><i className={"stat-icon stat-icon-"+i}><Icon size={18}/></i></div><strong>{b}</strong></div>)}</div><section className="panel"><div className="panel-head"><h3><AlertTriangle size={17}/> Stok perlu dicek</h3><span className="section-count">{products.filter(p=>p.stock<=p.minStock).length}</span></div>{products.filter(p=>p.stock<=p.minStock).slice(0,12).map(p=><p className="row" key={p.code}>{p.name} <b>{p.stock} {p.unit}</b></p>)}</section></>}
 {tab==='Kasir'&&<div className="grid-two"><section className="panel"><div className="panel-head"><h3><ShoppingBag size={17}/> Produk</h3><UiButton className="soft-btn" aria-label="Scan barcode" onClick={()=>void startScan()}><ScanLine size={17}/></UiButton></div><UiInput className="search" placeholder="Cari nama, kode, barcode..." value={query} onChange={e=>setQuery(e.target.value)}/>{filtered.slice(0,40).map(p=><button className="product-pick" key={p.code} onClick={()=>add(p)}><span>{p.name}<small>{p.code} · Stok {p.stock}</small></span><b>{money(p.sellPrice)}</b></button>)}</section><section className="panel"><h3><ShoppingCart size={17}/> Keranjang <span className="section-count">{cart.length}</span></h3>{cart.map(x=><div className="cart-row" key={x.p.code}><div className="cart-info"><b>{x.p.name}</b><small>{money(x.p.sellPrice)} / {x.p.unit}</small></div><div className="qty-control"><button aria-label={'Kurangi '+x.p.name} onClick={()=>setCart(c=>c.map(y=>y.p.code===x.p.code?{...y,qty:Math.max(0,y.qty-1)}:y).filter(y=>y.qty>0))}>−</button><b>{x.qty}</b><button aria-label={'Tambah '+x.p.name} onClick={()=>add(x.p)}>+</button></div><strong>{money(x.qty*x.p.sellPrice)}</strong></div>)}<h2>{money(cart.reduce((a,x)=>a+x.qty*x.p.sellPrice,0))}</h2><button className="primary full checkout-btn" disabled={!cart.length||busy} onClick={()=>void checkout()}><ShoppingCart size={17}/>{busy?'Memproses…':'Bayar sekarang'}</button></section></div>}
 {(tab==='Cek Harga'||tab==='Barang')&&<section className="panel"><div className="panel-head"><h3>{tab==='Barang'?'Master barang':'Pencarian harga produk'}</h3>{tab==='Barang'&&<label className="soft-btn upload"><Upload size={16}/> Impor CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.currentTarget.value='';if(file)void importCSV(file)}}/></label>}</div><UiInput className="search" placeholder="Cari nama, kode, atau barcode..." value={query} onChange={e=>setQuery(e.target.value)}/><div className="table-wrap"><table><thead><tr><th>Nama</th><th>Kode</th><th>Stok</th><th>Harga beli</th><th>Harga jual</th></tr></thead><tbody>{filtered.slice(0,60).map(p=><tr key={p.code}><td>{p.name}</td><td>{p.code}</td><td>{p.stock} {p.unit}</td><td>{tab==='Barang'?money(p.buyPrice):'—'}</td><td>{money(p.sellPrice)}</td></tr>)}</tbody></table></div></section>}
 {(tab==='Barang Masuk'||tab==='Barang Keluar')&&<section className="panel"><h3>{tab}</h3><UiInput className="search" placeholder="Kode item atau barcode" value={query} onChange={e=>setQuery(e.target.value)}/><p>{products.find(p=>p.code===query||p.barcode===query)?.name||'Masukkan kode produk yang tepat.'}</p><button className="primary" onClick={()=>void moveStock(tab==='Barang Masuk'?'MASUK':'KELUAR')}>Catat mutasi</button><h3>Riwayat mutasi</h3>{moves.filter(m=>m.type===(tab==='Barang Masuk'?'MASUK':'KELUAR')).slice(-30).reverse().map((m,i)=><p className="row" key={i}>{m.createdAt.slice(0,16)} · {m.name} · {m.qty}</p>)}</section>}
 {tab==='Laporan'&&(()=>{const reportSales=sales.filter(s=>(!reportFrom||localDate(new Date(s.createdAt))>=reportFrom)&&(!reportTo||localDate(new Date(s.createdAt))<=reportTo)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));const total=reportSales.reduce((a,s)=>a+s.total,0);return <section className="panel"><div className="panel-head"><h3>Riwayat penjualan</h3><b>Omzet: {money(total)}</b></div><div className="report-tools"><label>Dari tanggal<input type="date" value={reportFrom} onChange={e=>setReportFrom(e.target.value)}/></label><label>Sampai tanggal<input type="date" value={reportTo} onChange={e=>setReportTo(e.target.value)}/></label><button className="primary" disabled={pdfBusy||!reportSales.length} onClick={()=>void downloadReportPDF(reportSales)}><Download size={16}/> {pdfBusy?'Membuat PDF…':'Cetak laporan PDF'}</button></div><p className="report-summary">{reportSales.length} transaksi · Omzet {money(total)} · Estimasi laba {money(reportSales.reduce((a,s)=>a+s.items.reduce((b,i)=>b+(i.price-i.cost)*i.qty,0),0))}</p>{reportSales.map((sale,i)=><div className="report-row" key={sale.id??sale.createdAt+i}><div><b>{pdfDate(sale.createdAt)}</b><small>{sale.items.map(x=>x.name+' ×'+x.qty).join(', ')}</small><strong>{money(sale.total)}</strong></div><button className="soft-btn" disabled={pdfBusy} onClick={()=>void downloadReceiptPDF(sale)}><Download size={15}/> Struk PDF</button></div>)}</section>})()}
 {tab==='Pengaturan'&&<section className="panel"><h3><ShieldCheck size={18}/> Data</h3><div className="panel-head"><button className="primary" disabled={busy} onClick={()=>void backupAll()}><Download size={16}/> Backup lengkap (JSON)</button><label className="soft-btn upload"><FileUp size={16}/> Pulihkan backup<input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void restoreAll(file);e.currentTarget.value=''}}/></label></div><button className="soft-btn" disabled={busy} onClick={exportCSV}><Download size={16}/> Ekspor master produk CSV</button>{busy&&<p>Memproses data, jangan tutup aplikasi...</p>}<div className="notice"><WifiOff/><div><b>Lokal · Offline</b></div></div></section>}
 </main>{scan&&<UiModal label="Pemindai barcode" onClose={()=>void stopScan()}><div className="scan-card-content"><div id="barcode-reader"/><UiButton className="soft-btn full" onClick={()=>void stopScan()}>Tutup pemindai</UiButton></div></UiModal>}</div>
}
