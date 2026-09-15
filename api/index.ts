// Vercel uses the complete Express application so the production API has the
// same GDT, authentication, Neon, XML, and invoice-download routes as local.
import app from '../server';

export default app;
