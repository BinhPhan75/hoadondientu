import fs from 'fs';

const rawHtml = fs.readFileSync('tkj_invoice_raw.html', 'utf8');

// Let's create a complete viewer page that renders tkj_invoice_raw.html
// and test how it behaves with styles and pagination
const fullViewer = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Hóa đơn điện tử EasyInvoice</title>
  <style>
    body {
      background: #525659;
      margin: 0;
      padding: 20px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    }
    .invoice-wrapper {
      background: #ffffff;
      box-shadow: 0 8px 30px rgba(0,0,0,0.35);
      border-radius: 4px;
      overflow: hidden;
      max-width: 860px;
      width: 100%;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="invoice-wrapper">
    ${rawHtml}
  </div>
</body>
</html>`;

fs.writeFileSync('test_viewer.html', fullViewer);
console.log('Saved test_viewer.html');
