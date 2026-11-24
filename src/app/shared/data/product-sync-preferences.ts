import type {Product} from '../../domain/entities';
const OVERRIDES_KEY='naufal-farma:product-overrides',DELETED_KEY='naufal-farma:deleted-product-codes';
export function readProductOverrides():Record<string,Partial<Product>>{try{return JSON.parse(localStorage.getItem(OVERRIDES_KEY)||'{}')}catch{return {};}}
export function writeProductOverrides(value:Record<string,Partial<Product>>){try{localStorage.setItem(OVERRIDES_KEY,JSON.stringify(value))}catch{}}
export function readDeletedProductCodes():string[]{try{return JSON.parse(localStorage.getItem(DELETED_KEY)||'[]')}catch{return [];}}
export function writeDeletedProductCodes(value:string[]){try{localStorage.setItem(DELETED_KEY,JSON.stringify([...new Set(value)]))}catch{}}

export function clearProductSyncPreferences(){try{localStorage.removeItem(OVERRIDES_KEY);localStorage.removeItem(DELETED_KEY)}catch{}}
