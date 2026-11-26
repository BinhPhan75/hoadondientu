import React,{useState,useRef} from 'react';
import JSZip from 'jszip';
import type {GDTInvoice} from '../types';

// This origin is injected by the deployment configuration, never hard-coded.
const configuredParentOrigin = import.meta.env.VITE_PMKT_ORIGIN?.trim() || '';
function getParentOrigin(): string | null {
 try {
  const parsed = new URL(configuredParentOrigin);
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.origin !== configuredParentOrigin || parsed.username || parsed.password) return null;
  return parsed.origin;
 } catch { return null; }
}
export function PmktPurchaseTransfer({selected,invoices}:{selected:GDTInvoice[];invoices:GDTInvoice[]}){
 const [status,setStatus]=useState('');
 const [busy,setBusy]=useState(false),lock=useRef(false);
 const parentOrigin = getParentOrigin();
 const embedded=Boolean(parentOrigin)&&new URLSearchParams(window.location.search).get('pmkt')==='purchase'&&window.parent!==window;
 if(!embedded)return null;
 const collect=()=>{
  if(!selected.length)throw Error('Chọn ít nhất một hóa đơn mua vào.');
  const items=selected.map(s=>invoices.find(i=>i.id===s.id)||s);
  if(items.some(i=>i.loaiHdon!=='purchase'))throw Error('Chỉ chọn hóa đơn mua vào.');
  if(items.some(i=>!i.rawXml))throw Error('Một số hóa đơn chưa tải được XML chi tiết. Chờ tải chi tiết hoặc mở hóa đơn rồi thử lại.');
  const files=items.map(i=>({name:`HD_${i.khhdon}_${i.shdon}_${i.nbmst}.xml`,xml:i.rawXml!}));
  if(files.some(f=>!f.xml.length||f.xml.length>4*1024*1024||f.name.length>250))throw Error('Có tệp XML không hợp lệ hoặc vượt giới hạn an toàn của từng tệp.');
  return files;
 };
 async function transfer(download:boolean){
  if(lock.current)return;lock.current=true;setBusy(true);
  try{
   const files=collect();
   if(download){const zip=new JSZip();files.forEach((f,i)=>zip.file(`${i+1}_${f.name.replace(/[^\w.-]/g,'_')}`,f.xml));const blob=await zip.generateAsync({type:'blob'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Hoa_don_mua_vao_XML.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('Đã tải XML đã chọn.');}
   else{
    if(!parentOrigin)throw Error('Chưa cấu hình origin PMKT.');
    const batches:typeof files[]=[];let batch:typeof files=[],size=0;
    for(const file of files){
     if(batch.length>=20||size+file.xml.length>10*1024*1024){batches.push(batch);batch=[];size=0;}
     batch.push(file);size+=file.xml.length;
    }
    if(batch.length)batches.push(batch);
    const id=crypto.randomUUID();
    let sent=0;
    for(let index=0;index<batches.length;index++){
     setStatus('Đang chuyển '+sent+'/'+files.length+' hóa đơn · lô '+(index+1)+'/'+batches.length);
     await new Promise<void>((resolve,reject)=>{
      const receive=(e:MessageEvent)=>{
       if(e.origin!==parentOrigin||e.source!==window.parent||e.data?.type!=='PMKT_PURCHASE_XML_ACK_V2'||e.data.id!==id||e.data.index!==index)return;
       cleanup();if(e.data.error)reject(new Error(String(e.data.error)));else resolve();
      };
      const timeout=window.setTimeout(()=>{cleanup();reject(new Error('PMKT chưa xác nhận nhận lô XML. Hãy tải lại cả hai ứng dụng sau khi deploy và chuyển lại danh sách.'));},30000);
      const cleanup=()=>{window.clearTimeout(timeout);window.removeEventListener('message',receive);};
      window.addEventListener('message',receive);
      try{window.parent.postMessage({type:'PMKT_PURCHASE_XML_BATCH_V2',id,index,total:batches.length,files:batches[index]},parentOrigin);}catch(e){cleanup();reject(e);}
     });
     sent+=batches[index].length;
    }
    setStatus('PMKT đã nhận đủ '+files.length+' hóa đơn. Kiểm tra danh sách và bấm Tự động nhập kho tại PMKT.');
   }
  }catch(e){setStatus(e instanceof Error?e.message:'Không chuyển được XML.');}finally{lock.current=false;setBusy(false);}
 }
 return <section className="bg-blue-50 border p-3 text-sm"><div className="flex gap-3"><button className="px-3 py-2 bg-white border rounded" disabled={busy} onClick={()=>void transfer(true)}>Tải XML đã chọn</button><button className="px-3 py-2 bg-blue-600 text-white rounded" disabled={busy} onClick={()=>void transfer(false)}>Chuyển hóa đơn đã chọn sang PMKT</button></div>{status&&<p role="status">{status}</p>}</section>;
}
