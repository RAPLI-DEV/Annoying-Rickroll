const fs = require('fs');
const path = require('path');
const { minify: minifyJS } = require('terser');
const JavaScriptObfuscator = require('javascript-obfuscator');
const CleanCSS = require('clean-css');
const { minify: minifyHTML } = require('html-minifier-terser');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const ASSETS = ['RickRoll.webm', 'sus.mp3', 'qrcode.webp'];

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

(async () => {
	const js = fs.readFileSync(path.join(ROOT, 'i.js'), 'utf8');
	const css = fs.readFileSync(path.join(ROOT, 's.css'), 'utf8');
	const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

	const jsMin = await minifyJS(js, {
		compress: { drop_console: true, drop_debugger: true, passes: 3 },
		mangle: { toplevel: true },
		format: { comments: false }
	});

	const jsObf = JavaScriptObfuscator.obfuscate(jsMin.code, {
		compact: true,
		identifierNamesGenerator: 'hexadecimal',
		stringArray: true,
		stringArrayThreshold: 0.75,
		stringArrayEncoding: ['base64'],
		stringArrayRotate: true,
		stringArrayShuffle: true,
		splitStrings: true,
		splitStringsChunkLength: 10,
		controlFlowFlattening: false,
		deadCodeInjection: false,
		debugProtection: false,
		selfDefending: false,
		disableConsoleOutput: false,
		renameGlobals: false
	}).getObfuscatedCode();

	const cssMin = new CleanCSS({ level: 2 }).minify(css).styles;

	let final = html
		.replace(/<link[^>]*s\.css[^>]*>/, `<style>${cssMin}</style>`)
		.replace(/<script[^>]*i\.js[^>]*><\/script>/, `<script>${jsObf}</script>`);

	final = await minifyHTML(final, {
		collapseWhitespace: true,
		removeComments: true,
		minifyCSS: false,
		minifyJS: false
	});

	fs.writeFileSync(path.join(DIST, 'index.html'), final);

	for (const a of ASSETS) {
		const src = path.join(ROOT, a);
		if (fs.existsSync(src)) {
			fs.copyFileSync(src, path.join(DIST, a));
			console.log('copied:', a);
		} else {
			console.warn('missing:', a);
		}
	}

	console.log('Original JS:', (js.length / 1024).toFixed(2), 'KB');
	console.log('Minified JS:', (jsMin.code.length / 1024).toFixed(2), 'KB');
	console.log('Obfuscated JS:', (jsObf.length / 1024).toFixed(2), 'KB');
	console.log('Final HTML:', (final.length / 1024).toFixed(2), 'KB');
	console.log('Output:', DIST);
})();
