import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

export const FIREBASE_ADMIN_MESSAGING = 'FIREBASE_ADMIN_MESSAGING';

function buildFirebaseApp(configService: ConfigService): App | null {
  const projectId = configService.get<string>('FIREBASE_PROJECT_ID');
  const clientEmail = configService.get<string>('FIREBASE_CLIENT_EMAIL');
  const privateKey = configService.get<string>('FIREBASE_PRIVATE_KEY')
    ?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase Admin config missing');

  const existing = getApps().find((app) => app.name === 'cms-noti-push');
  if (existing) {
    return existing;
  }

  return initializeApp(
    {
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    },
    'cms-noti-push',
  );
}

export const firebaseAdminMessagingProvider: Provider = {
  provide: FIREBASE_ADMIN_MESSAGING,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Messaging | null => {
    const app = buildFirebaseApp(configService);

    if (!app) {
      return null;
    }

    return getMessaging(app);
  },
};
