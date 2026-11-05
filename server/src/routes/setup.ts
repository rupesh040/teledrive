import { appConfigRepo, loginFlow, phoneSignupCredentials } from '../telegram/runtimeLogin.js';
import { createSetupRouter } from '../auth/setupRoutes.js';

export const setupRouter = createSetupRouter({ repo: appConfigRepo, loginFlow, credentials: phoneSignupCredentials });
