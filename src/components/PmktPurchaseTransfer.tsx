import React,{useState} from 'react';
import JSZip from 'jszip';
import type {GDTInvoice} from '../types';

const parentOrigin='https://pmkt.nghiatingold.com';
export function PmktPurchaseTransfer({selected,invoices}:{selected:GDTInvoice[];invoices:GDTInvoice[]}){
 const [status,setStatus]=useState('');
 const embedded=new URLSearchParams(window.location.search).get('pmkt')==='purchase'&&window.parent!==window;
 if(!embedded)return null;
 const collect=()=>{
  if(!selected.length||selected.length>20)throw Error('Chọn từ 1 đến 20 hóa đơn mua vào mỗi lần.');
  const items=selected.map(s=>invoices.find(i=>i.id===s.id)||s);
  if(items.some(i=>i.loaiHdon!=='purchase'))throw Error('Chỉ chọn hóa đơn mua vào.');
  if(items.some(i=>!i.rawXml))throw Error('Một số hóa đơn chưa tải được XML chi tiết. Chờ tải chi tiết hoặc mở hóa đơn rồi thử lại.');
  const files=items.map(i=>({name:`HD_${i.khhdon}_${i.shdon}_${i.nbmst}.xml`,xml:i.rawXml!}));
  if(files.some(f=>f.xml.length>4*1024*1024)||files.reduce((n,f)=>n+f.xml.length,0)>10*1024*1024)throw Error('Dung lượng lớn, hãy chọn ít hóa đơn hơn.');
  return files;
 };
 async function transfer(download:boolean){
  try{
   const files=collect();
   if(download){const zip=new JSZip();files.forEach((f,i)=>zip.file(`${i+1}_${f.name.replace(/[^\w.-]/g,'_')}`,f.xml));const blob=await zip.generateAsync({type:'blob'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Hoa_don_mua_vao_XML.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('Đã tải XML đã chọn.');}
   else{window.parent.postMessage({type:'PMKT_PURCHASE_XML_V1',files},parentOrigin);setStatus('Đã chuyển XML sang PMKT. Kiểm tra danh sách và bấm Tự động nhập kho tại PMKT.');}
  }catch(e){setStatus(e instanceof Error?e.message:'Không chuyển được XML.');}
 }
 return <section className="bg-blue-50 border p-3 text-sm"><div className="flex gap-3"><button className="px-3 py-2 bg-white border rounded" onClick={()=>void transfer(true)}>Tải XML đã chọn</button><button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={()=>void transfer(false)}>Chuyển hóa đơn đã chọn sang PMKT</button></div>{status&&<p role="status">{status}</p>}</section>;
}
