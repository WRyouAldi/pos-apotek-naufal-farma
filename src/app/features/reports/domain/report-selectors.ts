import type {Movement,Sale} from '../../../domain/entities';
export type DateRange={from:string;to:string};
export const isInDateRange=(date:string,range:DateRange,toLocalDate:(value:Date)=>string)=> (!range.from||toLocalDate(new Date(date))>=range.from)&&(!range.to||toLocalDate(new Date(date))<=range.to);
export const summarizeInventoryMovements=(items:Movement[])=>({qty:items.reduce((sum,item)=>sum+Math.abs(item.qty),0),value:items.reduce((sum,item)=>sum+Math.abs(item.qty)*item.unitCost,0)});
export const summarizeSales=(items:Sale[])=>({transactions:items.length,revenue:items.reduce((sum,item)=>sum+item.total,0),profit:items.reduce((sum,item)=>sum+item.items.reduce((subtotal,line)=>subtotal+(line.price-line.cost)*line.qty,0),0)});
export const filterSalesByRange=(items:Sale[],range:DateRange,toLocalDate:(value:Date)=>string)=>items.filter(item=>isInDateRange(item.createdAt,range,toLocalDate)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
export const filterMovementsByRange=(items:Movement[],type:'MASUK'|'KELUAR',range:DateRange,toLocalDate:(value:Date)=>string)=>items.filter(item=>item.type===type&&isInDateRange(item.createdAt,range,toLocalDate)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
