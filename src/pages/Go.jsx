// =============================================================================
// /go — THE PERMANENT QR CODE DESTINATION.
// =============================================================================
// Print QR codes that point at:   https://nomoco.com/go
//
// Nothing else should ever be printed on a door hanger. Because the QR code
// points here and this file decides what happens next, you can change where
// people land — forever — by editing this one file. No reprinting.
//
// TODAY: everyone goes to the landing page.
// LATER: send iPhone users to the App Store, Android users to Google Play, and
//        everyone else to the website. The device check is already written
//        below — you only have to fill in the two store links and flip
//        SEND_TO_APP_STORES to true.
// =============================================================================

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from '../components/UI';

// --- Flip this to true once the mobile apps are published --------------------
const SEND_TO_APP_STORES = false;
const IOS_APP_URL = 'https://apps.apple.com/app/idYOUR_APP_ID';
const ANDROID_APP_URL =
  'https://play.google.com/store/apps/details?id=com.nomoco.app';

function detectPlatform() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'web';
}

export default function Go() {
  const navigate = useNavigate();

  useEffect(() => {
    const platform = detectPlatform();

    if (SEND_TO_APP_STORES && platform === 'ios') {
      window.location.replace(IOS_APP_URL);
      return;
    }
    if (SEND_TO_APP_STORES && platform === 'android') {
      window.location.replace(ANDROID_APP_URL);
      return;
    }

    // Default for now: the website landing page. The ?src tag lets you see in
    // analytics later how many people came from a physical door hanger.
    navigate('/?src=doorhanger', { replace: true });
  }, [navigate]);

  return <Loader label="Taking you to NO MO CO.…" />;
}
