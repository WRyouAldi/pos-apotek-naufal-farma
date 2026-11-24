/** Independent route metadata; app shell owns responsive navigation. */
export type FeatureId='dashboard'|'cashier'|'price-check'|'catalog'|'inventory-in'|'inventory-out'|'reports'|'settings';
export type FeatureDefinition={id:FeatureId;label:string;group:'primary'|'inventory'|'system';path:string;icon:string;enabled:boolean};
export const featureRegistry:FeatureDefinition[]=[
{id:'dashboard',label:'Dashboard',group:'primary',path:'/dashboard',icon:'layout-dashboard',enabled:true},
{id:'cashier',label:'Kasir',group:'primary',path:'/cashier',icon:'shopping-cart',enabled:true},
{id:'price-check',label:'Cek Harga',group:'primary',path:'/price-check',icon:'scan',enabled:true},
{id:'catalog',label:'Master Barang',group:'primary',path:'/catalog',icon:'package',enabled:true},
{id:'inventory-in',label:'Barang Masuk',group:'inventory',path:'/inventory/in',icon:'package-plus',enabled:true},
{id:'inventory-out',label:'Barang Keluar',group:'inventory',path:'/inventory/out',icon:'package-minus',enabled:true},
{id:'reports',label:'Laporan',group:'primary',path:'/reports',icon:'chart-no-axes-combined',enabled:true},
{id:'settings',label:'Pengaturan',group:'system',path:'/settings',icon:'settings',enabled:true}];
