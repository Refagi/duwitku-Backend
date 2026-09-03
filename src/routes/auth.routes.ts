import { Hono } from "hono";
import { AuthController } from "@/controllers/index.js";
import { auth } from "@/middlewares/auth.js";
import { validateMiddlewares } from "@/middlewares/validate.js";
import { loginSchema, registerSchema, forgotPassordSchema  } from "@/validations/auth.js";
import googleAuthRoutes from "@/middlewares/auth.google.js";

const authRoute = new Hono();

authRoute.post('/register', validateMiddlewares.validateJson(registerSchema), AuthController.register);
authRoute.post('/login', validateMiddlewares.validateJson(loginSchema), AuthController.login);
authRoute.post('/logout', AuthController.logout);
authRoute.post('/refresh-token',AuthController.refreshToken);
authRoute.get('/me', auth(), AuthController.getCurrentUser)

authRoute.route("/google", googleAuthRoutes);

export default authRoute;
