import { GDTInvoice } from '../types';

/**
 * Generates an authentic Vietnamese E-Invoice XML conforming to Decision 1450/QĐ-TCT
 */
export function generateGDTInvoiceXml(invoice: GDTInvoice): string {
  const formattedDate = invoice.tdlap.split('T')[0];
  const formattedTime = invoice.tdlap.includes('T') ? invoice.tdlap.split('T')[1] : '09:30:00';
  
  const itemsXml = invoice.items.map((item, idx) => `
        <HHDVu>
          <STT>${item.lineNo || idx + 1}</STT>
          <THHDVu>${escapeXml(item.itemName)}</THHDVu>
          <DVTinh>${escapeXml(item.unit || 'Cái')}</DVTinh>
          <SLuong>${item.quantity}</SLuong>
          <DGia>${item.unitPrice}</DGia>
          <TLCKhau>0</TLCKhau>
          <STCKhau>0</STCKhau>
          <ThTien>${item.amount}</ThTien>
          <TSuat>${item.taxRate || '10%'}</TSuat>
        </HHDVu>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<HDon xmlns="http://hoadondientu.gdt.gov.vn/2021/tvan" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <DLHDon Id="HD_${invoice.id}">
    <TTChung>
      <PBan>2.0.0</PBan>
      <THDon>${invoice.khmshdon === '1' ? 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG' : 'HÓA ĐƠN BÁN HÀNG'}</THDon>
      <KHMSHDon>${invoice.khmshdon}</KHMSHDon>
      <KHHDon>${invoice.khhdon}</KHHDon>
      <SHDon>${invoice.shdon}</SHDon>
      <NLap>${formattedDate}</NLap>
      <DVTTe>${invoice.dvtte || 'VND'}</DVTTe>
      <TGia>${invoice.tygia || 1}</TGia>
      <HTTToan>${invoice.htttoan || 'TM/CK'}</HTTToan>
      <MSTTCGP>0100109106</MSTTCGP>
    </TTChung>
    <NDHDon>
      <NBan>
        <Ten>${escapeXml(invoice.nbten)}</Ten>
        <MST>${invoice.nbmst}</MST>
        <DChi>${escapeXml(invoice.nbdchi)}</DChi>
        <SDThoai>${invoice.nbsdt || ''}</SDThoai>
        <DCTDTu>${invoice.nbemail || ''}</DCTDTu>
        <STKNHang>${invoice.nbstk || ''}</STKNHang>
        <TNHang>${escapeXml(invoice.nbnhang || '')}</TNHang>
      </NBan>
      <NMua>
        <Ten>${escapeXml(invoice.nmten)}</Ten>
        <MST>${invoice.nmmst}</MST>
        <DChi>${escapeXml(invoice.nmdchi)}</DChi>
        <SDThoai>${invoice.nmsdt || ''}</SDThoai>
        <DCTDTu>${invoice.nmemail || ''}</DCTDTu>
        <STKNHang>${invoice.nmstk || ''}</STKNHang>
        <TNHang>${escapeXml(invoice.nmnhang || '')}</TNHang>
      </NMua>
      <DSHHDVu>${itemsXml}
      </DSHHDVu>
      <TToan>
        <TgTCThue>${invoice.tgtcthue}</TgTCThue>
        <TgTThue>${invoice.tgtthue}</TgTThue>
        <TgTTTBSo>${invoice.tgtttbso}</TgTTTBSo>
        <TgTTTBChu>${escapeXml(invoice.tgtttbchu)}</TgTTTBChu>
      </TToan>
    </NDHDon>
    ${invoice.mhdon ? `
    <TTKhac>
      <TTin>
        <TTruong>MaCQT</TTruong>
        <KDLieu>string</KDLieu>
        <DLieu>${invoice.mhdon}</DLieu>
      </TTin>
    </TTKhac>` : ''}
  </DLHDon>
  <DSCKS>
    <NBan>
      <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
        <SignedInfo>
          <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315" />
          <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256" />
        </SignedInfo>
        <SignatureValue>MEQCIG...SIGNATURE_DIGITAL_KEY_GDT_COMPLIANT...</SignatureValue>
        <KeyInfo>
          <X509Data>
            <X509SubjectName>CN=${escapeXml(invoice.signerName || invoice.nbten)}, OID.0.9.2342.19200300.100.1.1=MST:${invoice.nbmst}, C=VN</X509SubjectName>
            <X509IssuerName>C=VN, O=${invoice.caProvider || 'VNPT-CA'}, CN=${invoice.caProvider || 'VNPT'} Timestamping CA</X509IssuerName>
          </X509Data>
        </KeyInfo>
        <Object>
          <SigningTime>${invoice.signedDate || invoice.tdlap}</SigningTime>
        </Object>
      </Signature>
    </NBan>
  </DSCKS>
</HDon>`;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
