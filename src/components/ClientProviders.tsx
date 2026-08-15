'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { TwilioProvider } from '@/contexts/TwilioContext';

/**
 * Only wraps children in TwilioProvider on authenticated pages.
 * The login page doesn't need a Twilio device.
 */
export function ClientProviders({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const isAuthPage = pathname === '/login';

    if (isAuthPage) {
        return <>{children}</>;
    }

    return (
        <TwilioProvider>
            {children}
        </TwilioProvider>
    );
}
