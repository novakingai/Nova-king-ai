/**
 * Device Action & Android Native Bridge for Arushi Voice Assistant
 * 
 * Handles safe execution of actions:
 * - openWhatsApp
 * - openApp (allowlisted apps: YouTube, Instagram, Spotify, Chrome, Camera, Settings, etc.)
 * - openUrl (validated HTTPS/HTTP URLs)
 * - makeCall (dialer / phone calling)
 * - callContact (name lookup, single vs multiple disambiguation, calling)
 */

declare global {
  interface Window {
    Android?: {
      openWhatsApp?: () => boolean;
      openApp?: (packageNameOrName: string) => boolean;
      openUrl?: (url: string) => boolean;
      makeCall?: (phoneNumber: string) => boolean;
      searchContacts?: (name: string) => string; // returns JSON array of { name: string, number: string }
      isNative?: () => boolean;
    };
    Capacitor?: any;
  }
}

export interface Contact {
  name: string;
  phoneNumber: string;
  relationship?: string;
  label?: string;
}

export interface ActionResult {
  success: boolean;
  action: string;
  details?: string;
  error?: string;
  matches?: Contact[];
  data?: any;
}

// Default device contact book for browser/sandbox testing and fallback
const DEFAULT_CONTACTS: Contact[] = [
  { name: 'Mom', relationship: 'Mother', phoneNumber: '+919876543210', label: 'Mobile' },
  { name: 'Mummy', relationship: 'Mother', phoneNumber: '+919876543210', label: 'Mobile' },
  { name: 'Dad', relationship: 'Father', phoneNumber: '+919876543211', label: 'Mobile' },
  { name: 'Papa', relationship: 'Father', phoneNumber: '+919876543211', label: 'Mobile' },
  { name: 'Rahul Sharma', phoneNumber: '+919812345678', label: 'Work' },
  { name: 'Rahul Verma', phoneNumber: '+919898765432', label: 'Personal' },
  { name: 'Priya', phoneNumber: '+919823456789', label: 'Mobile' },
  { name: 'Aman', phoneNumber: '+919834567890', label: 'Mobile' },
  { name: 'Dr. Mehta', phoneNumber: '+919845678901', label: 'Clinic' },
];

// App allowlist and scheme mappings
const APP_CONFIGS: Record<
  string,
  {
    webUrl: string;
    androidPackage?: string;
    deepLink?: string;
    name: string;
  }
> = {
  whatsapp: {
    name: 'WhatsApp',
    webUrl: 'https://web.whatsapp.com',
    deepLink: 'whatsapp://send',
    androidPackage: 'com.whatsapp',
  },
  youtube: {
    name: 'YouTube',
    webUrl: 'https://www.youtube.com',
    deepLink: 'vnd.youtube://',
    androidPackage: 'com.google.android.youtube',
  },
  instagram: {
    name: 'Instagram',
    webUrl: 'https://www.instagram.com',
    deepLink: 'instagram://app',
    androidPackage: 'com.instagram.android',
  },
  spotify: {
    name: 'Spotify',
    webUrl: 'https://open.spotify.com',
    deepLink: 'spotify://',
    androidPackage: 'com.spotify.music',
  },
  chrome: {
    name: 'Google Chrome',
    webUrl: 'https://www.google.com',
    androidPackage: 'com.android.chrome',
  },
  maps: {
    name: 'Google Maps',
    webUrl: 'https://maps.google.com',
    deepLink: 'geo:0,0?q=',
    androidPackage: 'com.google.android.apps.maps',
  },
  camera: {
    name: 'Camera',
    webUrl: '',
    androidPackage: 'com.android.camera',
  },
  settings: {
    name: 'Settings',
    webUrl: '',
    androidPackage: 'com.android.settings',
  },
  telegram: {
    name: 'Telegram',
    webUrl: 'https://web.telegram.org',
    deepLink: 'tg://',
    androidPackage: 'org.telegram.messenger',
  },
  twitter: {
    name: 'X (Twitter)',
    webUrl: 'https://twitter.com',
    deepLink: 'twitter://',
    androidPackage: 'com.twitter.android',
  },
  x: {
    name: 'X (Twitter)',
    webUrl: 'https://twitter.com',
    deepLink: 'twitter://',
    androidPackage: 'com.twitter.android',
  },
};

export class DeviceBridge {
  private contacts: Contact[] = [...DEFAULT_CONTACTS];
  private actionListeners: ((result: ActionResult) => void)[] = [];

  constructor() {
    this.loadCustomContacts();
  }

  public onActionExecuted(cb: (result: ActionResult) => void) {
    this.actionListeners.push(cb);
    return () => {
      this.actionListeners = this.actionListeners.filter((l) => l !== cb);
    };
  }

  private notify(result: ActionResult) {
    console.log('[DeviceBridge] Action result:', result);
    this.actionListeners.forEach((l) => l(result));
  }

  public isNativeAndroid(): boolean {
    return Boolean(window.Android && (typeof window.Android.isNative === 'function' ? window.Android.isNative() : true));
  }

  private loadCustomContacts() {
    try {
      const stored = localStorage.getItem('arushi_contacts');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.contacts = parsed;
        }
      }
    } catch (e) {
      console.warn('[DeviceBridge] Could not load stored contacts', e);
    }
  }

  public getContacts(): Contact[] {
    return this.contacts;
  }

  public addContact(contact: Contact) {
    this.contacts.push(contact);
    try {
      localStorage.setItem('arushi_contacts', JSON.stringify(this.contacts));
    } catch (e) {
      // ignore
    }
  }

  /**
   * Action: openWhatsApp
   */
  public async openWhatsApp(): Promise<ActionResult> {
    console.log('[DeviceBridge] Executing openWhatsApp');
    try {
      if (this.isNativeAndroid() && window.Android?.openWhatsApp) {
        const res = window.Android.openWhatsApp();
        const actionResult: ActionResult = {
          success: res,
          action: 'openWhatsApp',
          details: res ? 'WhatsApp opened via native Android bridge' : 'Native WhatsApp launch failed',
        };
        this.notify(actionResult);
        return actionResult;
      }

      // Browser mode: deep link attempt then web fallback
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = 'whatsapp://send';
      } else {
        window.open('https://web.whatsapp.com', '_blank', 'noopener,noreferrer');
      }

      const result: ActionResult = {
        success: true,
        action: 'openWhatsApp',
        details: isMobile ? 'Launched WhatsApp deep link' : 'Opened WhatsApp Web in new tab',
      };
      this.notify(result);
      return result;
    } catch (err: any) {
      const result: ActionResult = {
        success: false,
        action: 'openWhatsApp',
        error: err?.message || 'Failed to open WhatsApp',
      };
      this.notify(result);
      return result;
    }
  }

  /**
   * Action: openApp
   */
  public async openApp(rawAppName: string): Promise<ActionResult> {
    const appKey = (rawAppName || '').trim().toLowerCase();
    console.log(`[DeviceBridge] Executing openApp for: "${rawAppName}" (key: "${appKey}")`);

    const appConfig = APP_CONFIGS[appKey];
    if (!appConfig) {
      const allowedNames = Object.values(APP_CONFIGS)
        .map((c) => c.name)
        .join(', ');
      const result: ActionResult = {
        success: false,
        action: 'openApp',
        error: `App "${rawAppName}" is not in the allowed apps list (${allowedNames}).`,
      };
      this.notify(result);
      return result;
    }

    try {
      if (this.isNativeAndroid() && window.Android?.openApp) {
        const target = appConfig.androidPackage || rawAppName;
        const res = window.Android.openApp(target);
        const result: ActionResult = {
          success: res,
          action: 'openApp',
          details: res ? `Opened ${appConfig.name} on native Android` : `Could not open ${appConfig.name} on native Android`,
        };
        this.notify(result);
        return result;
      }

      // Browser fallback
      if (appConfig.webUrl) {
        window.open(appConfig.webUrl, '_blank', 'noopener,noreferrer');
        const result: ActionResult = {
          success: true,
          action: 'openApp',
          details: `Opened ${appConfig.name} website`,
        };
        this.notify(result);
        return result;
      }

      const result: ActionResult = {
        success: false,
        action: 'openApp',
        error: `${appConfig.name} is a native system application and cannot be opened directly from a web browser without the native Android app.`,
      };
      this.notify(result);
      return result;
    } catch (err: any) {
      const result: ActionResult = {
        success: false,
        action: 'openApp',
        error: err?.message || `Failed to open ${rawAppName}`,
      };
      this.notify(result);
      return result;
    }
  }

  /**
   * Action: openUrl
   */
  public async openUrl(url: string): Promise<ActionResult> {
    console.log(`[DeviceBridge] Executing openUrl: "${url}"`);
    try {
      let targetUrl = (url || '').trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
      }

      // Security validate URL
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        const result: ActionResult = {
          success: false,
          action: 'openUrl',
          error: 'Only HTTP and HTTPS URLs are permitted.',
        };
        this.notify(result);
        return result;
      }

      if (this.isNativeAndroid() && window.Android?.openUrl) {
        const res = window.Android.openUrl(targetUrl);
        const result: ActionResult = {
          success: res,
          action: 'openUrl',
          details: `Opened URL ${targetUrl} via Android browser`,
        };
        this.notify(result);
        return result;
      }

      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      const result: ActionResult = {
        success: true,
        action: 'openUrl',
        details: `Opened ${targetUrl} in a new tab`,
      };
      this.notify(result);
      return result;
    } catch (err: any) {
      const result: ActionResult = {
        success: false,
        action: 'openUrl',
        error: err?.message || 'Invalid URL provided',
      };
      this.notify(result);
      return result;
    }
  }

  /**
   * Action: makeCall
   */
  public async makeCall(phoneNumber: string): Promise<ActionResult> {
    console.log(`[DeviceBridge] Executing makeCall: "${phoneNumber}"`);
    const sanitized = (phoneNumber || '').replace(/[^\d+*#]/g, '');

    if (!sanitized || sanitized.length < 3) {
      const result: ActionResult = {
        success: false,
        action: 'makeCall',
        error: `Invalid phone number: "${phoneNumber}".`,
      };
      this.notify(result);
      return result;
    }

    try {
      if (this.isNativeAndroid() && window.Android?.makeCall) {
        const res = window.Android.makeCall(sanitized);
        const result: ActionResult = {
          success: res,
          action: 'makeCall',
          details: res ? `Initiated call to ${sanitized} via Android dialer` : 'Native call launch failed',
        };
        this.notify(result);
        return result;
      }

      // Browser mode: tel: protocol
      window.location.href = `tel:${sanitized}`;
      const result: ActionResult = {
        success: true,
        action: 'makeCall',
        details: `Dialer launched for ${sanitized}`,
      };
      this.notify(result);
      return result;
    } catch (err: any) {
      const result: ActionResult = {
        success: false,
        action: 'makeCall',
        error: err?.message || 'Failed to place call',
      };
      this.notify(result);
      return result;
    }
  }

  /**
   * Action: callContact
   * Handles:
   * 1. Exact or fuzzy match on contacts
   * 2. Single match -> places call
   * 3. Multiple matches -> returns candidate list so Arushi asks: "I found two contacts named Rahul. Which one should I call?"
   * 4. Zero matches -> returns not found
   */
  public async callContact(contactName: string): Promise<ActionResult> {
    console.log(`[DeviceBridge] Executing callContact for: "${contactName}"`);
    const query = (contactName || '').trim().toLowerCase();

    if (!query) {
      const result: ActionResult = {
        success: false,
        action: 'callContact',
        error: 'Please provide a contact name to call.',
      };
      this.notify(result);
      return result;
    }

    let searchPool = this.contacts;

    // Check if native Android bridge provides contact search
    if (this.isNativeAndroid() && window.Android?.searchContacts) {
      try {
        const nativeResults = window.Android.searchContacts(query);
        if (nativeResults) {
          const parsed = JSON.parse(nativeResults);
          if (Array.isArray(parsed) && parsed.length > 0) {
            searchPool = parsed;
          }
        }
      } catch (e) {
        console.warn('[DeviceBridge] Error querying native contacts:', e);
      }
    }

    // Matching logic
    const normalizedQuery = query.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
    const matches = searchPool.filter((c) => {
      const name = c.name.toLowerCase();
      const rel = (c.relationship || '').toLowerCase();
      return (
        name === normalizedQuery ||
        name.includes(normalizedQuery) ||
        normalizedQuery.includes(name) ||
        (rel && (rel === normalizedQuery || normalizedQuery.includes(rel)))
      );
    });

    if (matches.length === 0) {
      const result: ActionResult = {
        success: false,
        action: 'callContact',
        error: `No contact found matching "${contactName}" in your contacts.`,
      };
      this.notify(result);
      return result;
    }

    if (matches.length > 1) {
      // Multiple matches! As required, prompt user for disambiguation
      console.log(`[DeviceBridge] Multiple matches found for "${contactName}":`, matches);
      const result: ActionResult = {
        success: false,
        action: 'callContact',
        error: `Found ${matches.length} contacts matching "${contactName}": ${matches.map((m) => `${m.name} (${m.label || m.phoneNumber})`).join(', ')}. Please specify which one to call.`,
        matches,
      };
      this.notify(result);
      return result;
    }

    // Exactly one match found!
    const target = matches[0];
    console.log(`[DeviceBridge] Calling matched contact: ${target.name} (${target.phoneNumber})`);
    const callRes = await this.makeCall(target.phoneNumber);

    const result: ActionResult = {
      success: callRes.success,
      action: 'callContact',
      details: `Calling ${target.name} (${target.phoneNumber})`,
      error: callRes.error,
      data: target,
    };
    this.notify(result);
    return result;
  }

  /**
   * Universal tool call router
   */
  public async executeTool(name: string, args: Record<string, any>): Promise<ActionResult> {
    console.log(`[DeviceBridge] executeTool: ${name}`, args);
    switch (name) {
      case 'openWhatsApp':
        return this.openWhatsApp();
      case 'openApp':
        return this.openApp(args.appName);
      case 'openUrl':
        return this.openUrl(args.url);
      case 'makeCall':
        return this.makeCall(args.phoneNumber);
      case 'callContact':
        return this.callContact(args.contactName);
      default:
        const unrecResult: ActionResult = {
          success: false,
          action: name,
          error: `Unrecognized device action: "${name}"`,
        };
        this.notify(unrecResult);
        return unrecResult;
    }
  }
}

export const deviceBridge = new DeviceBridge();
