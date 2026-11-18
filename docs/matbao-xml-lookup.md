# Matbao / Mifi original PDF lookup (MSTTCGP 0302712571)

## Confirmed behavior

- Supplier invoices like `C26MLS` use XML upload as the public lookup input.
- The XML does **not** contain a traditional lookup code or Fkey.
- Official portal: https://matbao.in/tra-cuu-hoa-don
- For a manual lookup, select **Tra cứu dùng file XML**, upload the original XML, then download the issuer PDF.
- The provider's *published* issuing APIs (`/api/v2/invoice/DownloadPdf`) require credentials and a separate Fkey. **Do not** call these with seller MST or tax authority MCCQT as a fabricated Fkey.

## Driver integration

`src/services/invoice-engine/drivers/MatbaoDriver.ts` detects `MSTTCGP=0302712571` or trusted Matbao/Mifi portal metadata, and extracts `rawXml` as the lookup input.

For *automatic* upload, first verify an actual successful XML-upload request on the provider website (Network -> Headers and Payload). Supply these server-side environment variables only after verifying exact endpoint and form contract:

- `MATBAO_XML_UPLOAD_URL`: exact HTTPS upload endpoint on `matbao.in` or `mifi.vn` (subdomains allowed); no redirects or arbitrary hosts
- `MATBAO_XML_UPLOAD_MODE`: `multipart` (default) or `raw`, to match the observed request
- `MATBAO_XML_UPLOAD_FIELD`: verified file field name if multipart (defaults to `file`)

The driver rejects untrusted hosts, sends the original XML, searches the resulting JSON/HTML for an official download URL, and checks that the received PDF identifies the expected invoice before returning it.

**Current status:** No verified XML upload endpoint/field has been supplied, so automatic download is **not yet operational**. The driver raises `OriginalInvoiceError` with the correct portal URL and guidance rather than fabricating a PDF.

In HoangMySoft, use **Tải XML gốc**, then **Tra cứu Mắt Bão (Upload XML)**.

## Testing

`npx tsx --test tests/matbao-driver.test.ts`

Never commit real customer XML, credentials, cookie headers or invoice files to repository fixtures.
