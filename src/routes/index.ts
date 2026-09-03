import { Hono } from 'hono';
import authRoutes from './auth.routes.js';
import accountRoutes from './account.routes.js';
import categoryRoutes from './category.routes.js';
import transactionRoutes from './transaction.routes.js';
import transferRoutes from './transfer.route.js';
import dashboardRoutes from './dashboard.routes.js';
import reportRoutes from './report.routes.js';
import savingRoute from './saving.routes.js';


const app = new Hono();

app.route("/auth", authRoutes);
app.route("/accounts", accountRoutes);
app.route("/categories", categoryRoutes);
app.route("/transactions", transactionRoutes);
app.route("/transfers", transferRoutes);
app.route("/dashboard", dashboardRoutes);
app.route("/reports", reportRoutes);
app.route("/savings", savingRoute);


export default app;