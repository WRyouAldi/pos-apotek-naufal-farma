export const localDate=(d=new Date())=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+day;};
export const money=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
export const num=(v:unknown)=>Number(String(v??'0').replace(/[^0-9-]/g,''))||0;
