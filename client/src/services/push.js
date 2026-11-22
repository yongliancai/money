export function pushCapabilities() {
  return {
    secure: isSecureContext,
    serviceWorker: 'serviceWorker' in navigator,
    push: 'PushManager' in window,
    notification: 'Notification' in window,
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      navigator.standalone === true,
  };
}
export async function subscribePush(
  sync,
  config,
  basePath = import.meta.env?.BASE_URL || '/',
) {
  if (!config) throw new Error('尚未連接可用後端，無法訂閱通知');
  if (!config.pushReady) throw new Error('後端尚未啟用推播服務，無法訂閱通知');
  const capabilities = pushCapabilities();
  if (
    !capabilities.secure ||
    !capabilities.serviceWorker ||
    !capabilities.push ||
    !capabilities.notification
  )
    throw new Error('此瀏覽器尚不支援推播；iPhone 請先加入主畫面後開啟。');
  // Invoked directly from the user's button click, before any network await.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    throw new Error('尚未允許通知，可至系統設定調整。');
  const registration = await navigator.serviceWorker.getRegistration(basePath);
  if (!registration?.active)
    throw new Error('離線服務尚未就緒，請重新載入建置版再試');
  const bytes = Uint8Array.from(
    atob(config.pushPublicKey.replaceAll('-', '+').replaceAll('_', '/')),
    (c) => c.charCodeAt(0),
  );
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription)
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: bytes,
    });
  await sync.request('/api/push/subscribe', 'POST', subscription.toJSON());
  return subscription;
}
export async function unsubscribePush(
  sync,
  basePath = import.meta.env?.BASE_URL || '/',
) {
  // Revoke server delivery first; do not claim success if the server is unreachable.
  await sync.request('/api/push/subscribe', 'DELETE');
  if ('serviceWorker' in navigator) {
    const registration =
      await navigator.serviceWorker.getRegistration(basePath);
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe();
  }
}
