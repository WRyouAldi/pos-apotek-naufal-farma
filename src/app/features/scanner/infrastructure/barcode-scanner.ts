import {Html5Qrcode} from 'html5-qrcode';
/** Owns the camera lifecycle; UI decides when to open/close its scanner surface. */
export class BarcodeScanner {
 private instance:Html5Qrcode|null=null;
 async start(elementId:string,onDetected:(value:string)=>void):Promise<void>{
  const reader=document.getElementById(elementId);if(!reader)throw new Error('Area pemindai belum siap. Coba buka kembali.');
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('Akses kamera memerlukan koneksi aplikasi yang aman. Perbarui aplikasi dan coba lagi.');
  const cameras=await Html5Qrcode.getCameras();if(!cameras.length)throw new Error('Kamera tidak ditemukan pada perangkat ini.');
  const camera=cameras.find(c=>/back|rear|environment|belakang/i.test(c.label))||cameras[cameras.length-1];
  const scanner=new Html5Qrcode(elementId,{verbose:false});this.instance=scanner;
  const width=Math.max(180,Math.min(280,reader.clientWidth-32));
  await scanner.start(camera.id,{fps:12,qrbox:{width,height:Math.round(width*.48)},aspectRatio:16/9},value=>{if(this.instance===scanner)onDetected(value.trim())},()=>{});
 }
 async stop():Promise<void>{const scanner=this.instance;this.instance=null;if(scanner){try{if(scanner.isScanning)await scanner.stop();scanner.clear()}catch{}}}
}
