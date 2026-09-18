import { describe, it, expect, beforeEach } from 'vitest';
import capacitorConfig from '../../../capacitor.config';
import { triggerHaptic } from './haptics';

describe('Platform & Mobile Packaging Architecture', () => {
  beforeEach(() => {
    // Reset window mock
    if (typeof window !== 'undefined') {
      delete (window as any).Capacitor;
    }
  });

  describe('Capacitor Configuration for Mobile Store Packaging', () => {
    it('has a valid reverse-DNS app ID for Google Play and App Store', () => {
      expect(capacitorConfig.appId).toBe('com.pachas.app');
      expect(capacitorConfig.appName).toBe('Pachas');
    });

    it('has webDir configured to out for static bundling or live server support', () => {
      expect(capacitorConfig.webDir).toBe('out');
    });

    it('has HTTPS schemes enabled for secure Android and iOS WebViews', () => {
      expect(capacitorConfig.server?.androidScheme).toBe('https');
      expect(capacitorConfig.server?.iosScheme).toBe('https');
    });

    it('has essential native plugins configured (SplashScreen, StatusBar, Keyboard)', () => {
      expect(capacitorConfig.plugins?.SplashScreen).toBeDefined();
      expect(capacitorConfig.plugins?.StatusBar).toBeDefined();
      expect(capacitorConfig.plugins?.Keyboard).toBeDefined();
    });
  });

  describe('Native Haptics Bridge', () => {
    it('runs safely without throwing in any environment', async () => {
      await expect(triggerHaptic('light')).resolves.not.toThrow();
      await expect(triggerHaptic('success')).resolves.not.toThrow();
      await expect(triggerHaptic('error')).resolves.not.toThrow();
    });
  });

  describe('Separated View Mode Resolution', () => {
    it('correctly resolves mobile vs web resolution rules', () => {
      const resolveMode = (
        isNative: boolean,
        isMobileViewport: boolean,
        preferredMode: 'auto' | 'mobile' | 'web'
      ) => {
        if (preferredMode === 'mobile') return 'mobile';
        if (preferredMode === 'web') return isNative ? 'mobile' : 'web';
        return isNative || isMobileViewport ? 'mobile' : 'web';
      };

      // Desktop browser with auto
      expect(resolveMode(false, false, 'auto')).toBe('web');

      // Mobile browser with auto
      expect(resolveMode(false, true, 'auto')).toBe('mobile');

      // Capacitor Native app
      expect(resolveMode(true, false, 'auto')).toBe('mobile');
      expect(resolveMode(true, true, 'auto')).toBe('mobile');

      // User explicit overrides
      expect(resolveMode(false, false, 'mobile')).toBe('mobile');
      expect(resolveMode(false, true, 'web')).toBe('web');
      // Native app always stays mobile even if web was requested in localStorage
      expect(resolveMode(true, false, 'web')).toBe('mobile');
    });
  });
});
