import type {ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode} from 'react';
import {X} from 'lucide-react';
type ButtonProps=ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'soft'|'ghost'};
export function UiButton({variant='soft',className='',type='button',...props}:ButtonProps){return <button type={type} className={['ui-button',variant==='primary'?'primary':variant==='soft'?'soft-btn':'ui-ghost',className].filter(Boolean).join(' ')} {...props}/>;}
export function UiCard({className='',...props}:HTMLAttributes<HTMLElement>){return <section className={['panel',className].filter(Boolean).join(' ')} {...props}/>;}
export function UiInput({className='',...props}:InputHTMLAttributes<HTMLInputElement>){return <input className={['ui-input',className].filter(Boolean).join(' ')} {...props}/>;}
export function UiModal({children,onClose,label='Dialog'}:{children:ReactNode;onClose:()=>void;label?:string}){return <div className="ui-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="ui-modal" role="dialog" aria-modal="true" aria-label={label}><button className="ui-modal-close" type="button" onClick={onClose} aria-label="Tutup"><X size={18}/></button>{children}</section></div>;}
