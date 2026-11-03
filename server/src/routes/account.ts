import { appConfigRepo } from '../telegram/runtimeLogin.js';
import { resetClient } from '../telegram/client.js';
import { createAccountRouter } from '../auth/routes.js';

export const accountRouter = createAccountRouter({ repo: appConfigRepo, disconnectClient: resetClient });
